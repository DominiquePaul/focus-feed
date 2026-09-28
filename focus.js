// Focus Feed: hides the X and LinkedIn feeds + notifications while leaving
// posting and messages alone. Unlocking a feed brings its notifications back. The feed is unlocked by keeping the page open
// and focused for FF.UNLOCK_SECONDS. It then stays unlocked (across reloads
// and tabs) until the floating "Hide feed" button is pressed or the next
// FF.RESET_HOUR (6 AM) comes around. Shared helpers live in shared.js.
(() => {
  "use strict";

  const FF = globalThis.FF;
  const root = document.documentElement;

  const host = location.hostname;
  const site = /(^|\.)linkedin\.com$/.test(host) ? "li" : "x";
  const SITE_NAME = FF.SITES[site];
  const MESSAGES_URL = site === "x" ? "/messages" : "/messaging/";
  // LinkedIn sometimes renders its top bar in a frame. Frames only get the
  // notification hiding: no card, no feed, no stats.
  const IS_FRAME = window !== window.top;

  function pageType() {
    const path = location.pathname;
    if (IS_FRAME) return "frame";
    if (site === "x") {
      if (path === "/" || path === "/home" || path.startsWith("/explore")) return "feed";
      if (path.startsWith("/notifications")) return "notifications";
    } else {
      if (path === "/" || path === "/feed" || path === "/feed/") return "feed";
      if (path.startsWith("/notifications")) return "notifications";
    }
    return "other";
  }

  // "locked" -> "counting" -> "unlocked". The unlock time is saved per site;
  // it applies to every tab and expires at the next 6 AM.
  let state = "locked";
  let unlockedAt = 0;
  let ready = false; // the saved state has been read
  let countdownStart = 0;
  let resetNotice = false;
  let lastUrl = "";
  let lastRender = "";
  let countedVisit = false;
  let today = { blocked: 0, minutes: 0 };

  root.setAttribute("data-ff-site", site);
  root.setAttribute("data-ff-page", pageType());

  // ---------- fonts ----------
  // Loaded from the extension as bytes, so the sites' font CSP doesn't apply.
  // System fonts are the fallback.

  const FONTS = [
    ["FF Serif", "fonts/instrument-serif-latin-400-normal.woff2", { style: "normal" }],
    ["FF Serif", "fonts/instrument-serif-latin-400-italic.woff2", { style: "italic" }],
    ["FF Mono", "fonts/jetbrains-mono-latin-500-normal.woff2", { weight: "500" }],
    ["FF Mono", "fonts/jetbrains-mono-latin-700-normal.woff2", { weight: "700" }],
  ];
  let fontsLoaded = false;
  function loadFonts() {
    if (fontsLoaded) return;
    fontsLoaded = true;
    for (const [family, path, desc] of FONTS) {
      fetch(chrome.runtime.getURL(path))
        .then((r) => r.arrayBuffer())
        .then((buf) => new FontFace(family, buf, desc).load())
        .then((face) => document.fonts.add(face))
        .catch(() => {});
    }
  }

  // ---------- card UI (shadow DOM, so the sites' CSS can't reach it) ----------

  const CARD_CSS = `
    :host { all: initial; }
    .wrap {
      --paper: #eeeeea; --ink: #0c0c0d; --muted: #62626a; --line: rgba(12,12,13,.14);
      --signal: #1c3fff; --shadow: #0c0c0d;
      position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
      z-index: 2147483647;
      font: 500 12px/1.5 "FF Mono", ui-monospace, "SF Mono", Menlo, monospace;
      color: var(--ink);
      -webkit-font-smoothing: antialiased;
    }
    @media (prefers-color-scheme: dark) {
      .wrap { --paper: #0c0c0d; --ink: #eeeeea; --muted: #9a9aa3; --line: rgba(238,238,234,.16); --signal: #5b78ff; --shadow: #5b78ff; }
    }
    .card {
      box-sizing: border-box; width: min(680px, calc(100vw - 32px));
      padding: 14px 18px 16px; background: var(--paper);
      border: 1.5px solid var(--ink); border-radius: 2px;
      box-shadow: 6px 6px 0 var(--shadow);
      animation: rise .32s cubic-bezier(.2,.8,.2,1) both;
    }
    @keyframes rise { from { opacity: 0; transform: translateY(14px); } }
    .meta {
      display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
      font-size: 10px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase;
    }
    .meta .dim { color: var(--muted); font-weight: 500; }
    .meta .end { margin-left: auto; color: var(--muted); font-weight: 500; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--signal); flex: none; }
    .row { display: flex; align-items: center; gap: 20px; }
    .text { flex: 1; min-width: 0; }
    .text p { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .num + .text p { white-space: normal; }
    h1 {
      margin: 0 0 4px; font: 400 30px/1 "FF Serif", "Instrument Serif", Georgia, serif;
      letter-spacing: -.015em; white-space: nowrap;
    }
    h1 em { font-style: italic; color: var(--signal); }
    p { margin: 0; color: var(--muted); font-size: 11px; line-height: 1.5; }
    .stats { display: flex; flex: none; border-left: 1px solid var(--line); }
    .stats > div { padding: 0 16px; border-right: 1px solid var(--line); }
    .stats b {
      display: block; font: italic 400 28px/1 "FF Serif", Georgia, serif;
      letter-spacing: -.02em; font-variant-numeric: tabular-nums;
    }
    .stats span {
      display: block; margin-top: 4px; font-size: 9px; letter-spacing: .12em;
      text-transform: uppercase; color: var(--muted); white-space: nowrap;
    }
    .actions { display: flex; gap: 8px; flex: none; }
    button {
      all: unset; box-sizing: border-box; cursor: pointer; white-space: nowrap;
      display: inline-flex; align-items: center; gap: 10px;
      padding: 11px 16px; border: 1.5px solid var(--ink); border-radius: 999px;
      font: 700 11px/1 "FF Mono", ui-monospace, Menlo, monospace;
      letter-spacing: .12em; text-transform: uppercase;
      background: var(--ink); color: var(--paper);
      transition: transform .15s ease;
    }
    button:hover { transform: translate(-1px, -1px); }
    button:active { transform: translate(1px, 1px); }
    button:focus-visible { outline: 2px solid var(--signal); outline-offset: 3px; }
    button .tag { color: var(--signal); }
    @media (prefers-color-scheme: light) { button .tag { color: #8da0ff; } }
    button.ghost { background: transparent; color: var(--ink); }
    .num {
      flex: none; min-width: 64px; font: italic 400 72px/.8 "FF Serif", Georgia, serif;
      letter-spacing: -.04em; font-variant-numeric: tabular-nums;
    }
    .bar { height: 3px; background: var(--line); margin-top: 10px; overflow: hidden; }
    .bar > i { display: block; height: 100%; width: 0; background: var(--signal); transition: width .25s linear; }
    .pill {
      padding: 12px 18px 12px 14px;
      box-shadow: 4px 4px 0 var(--signal);
      animation: rise .32s cubic-bezier(.2,.8,.2,1) both;
    }
    .pill .dot { animation: breathe 2.4s ease-in-out infinite; }
    @keyframes breathe { 50% { opacity: .35; transform: scale(.7); } }
    @media (max-width: 640px) {
      .row { flex-wrap: wrap; gap: 12px; }
      .text { flex-basis: 100%; }
      .stats { border-left: 0; }
      .stats > div:first-child { padding-left: 0; }
      h1 { white-space: normal; }
    }
    @media (prefers-reduced-motion: reduce) {
      .card, .pill, .pill .dot { animation: none; }
      button, .bar > i { transition: none; }
    }
  `;

  let host_ = null;
  let shadow = null;
  let wrap = null;

  function ensureCard() {
    if (!document.body) return null;
    if (!host_) {
      host_ = document.createElement("focus-feed-ui");
      shadow = host_.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = CARD_CSS;
      wrap = document.createElement("div");
      wrap.className = "wrap";
      wrap.setAttribute("role", "status");
      wrap.hidden = true;
      wrap.addEventListener("click", onCardClick);
      shadow.append(style, wrap);
      loadFonts();
    }
    if (!host_.isConnected) document.documentElement.appendChild(host_);
    return wrap;
  }

  function onCardClick(event) {
    const action = event.target.closest("button")?.dataset.action;
    if (action === "start") startCountdown();
    else if (action === "cancel") cancelCountdown(false);
    else if (action === "relock") relock();
    else if (action === "messages") location.assign(MESSAGES_URL);
    else if (action === "compose") location.assign("/feed/?shareActive=true");
  }

  const resetLabel = () => `${String(FF.RESET_HOUR).padStart(2, "0")}:00`;
  const meta = (label, end = "") =>
    `<div class="meta"><span class="dot"></span>Focus Feed<span class="dim">/ ${label}</span>${
      end ? `<span class="end">${end}</span>` : ""
    }</div>`;

  function remainingSeconds() {
    return Math.max(0, FF.UNLOCK_SECONDS - (Date.now() - countdownStart) / 1000);
  }

  function render() {
    if (IS_FRAME) return;
    const el = ensureCard();
    if (!el) return;
    const page = root.getAttribute("data-ff-page");

    let key;
    let html = "";

    if (!ready) {
      key = "none";
    } else if (page === "notifications" && state !== "unlocked") {
      key = "notifications";
      html = `<div class="card">
        ${meta("Notifications")}
        <div class="row">
          <div class="text"><h1>Notifications are <em>off</em>.</h1><p>They come back when you unlock the feed.</p></div>
          <div class="actions"><button type="button" data-action="messages">Open messages</button></div>
        </div>
      </div>`;
    } else if (page !== "feed") {
      key = "none";
    } else if (state === "unlocked") {
      key = "unlocked";
      html = `<button type="button" class="pill" data-action="relock" title="Feed is open until ${resetLabel()}"><span class="dot"></span>Hide feed</button>`;
    } else if (state === "counting") {
      key = "counting";
      html = `<div class="card">
        ${meta("Unlocking", SITE_NAME)}
        <div class="row">
          <span class="num">${Math.ceil(remainingSeconds())}</span>
          <div class="text">
            <h1>seconds to <em>go</em>.</h1>
            <p>Stay on this page. Switching tabs or apps resets the timer.</p>
            <div class="bar"><i></i></div>
          </div>
          <div class="actions"><button type="button" class="ghost" data-action="cancel">Never mind</button></div>
        </div>
      </div>`;
    } else {
      key = `locked:${resetNotice}:${liFallback}:${today.blocked}:${today.minutes}`;
      const sessions = "Blocked today";
      html = `<div class="card">
        ${meta(SITE_NAME, `Resets ${resetLabel()}`)}
        <div class="row">
          <div class="text">
            <h1>The feed is <em>quiet</em>.</h1>
            <p>${
              resetNotice
                ? "You left the page, so the timer reset."
                : "Posting and messages still work."
            }</p>
          </div>
          <div class="stats">
            <div><b>${today.blocked}</b><span>${sessions}</span></div>
            <div><b>${FF.formatMinutes(today.minutes)}</b><span>Won back</span></div>
          </div>
          <div class="actions">
            <button type="button" data-action="start">Show feed <span class="tag">${FF.UNLOCK_SECONDS}s</span></button>${
              liFallback ? '<button type="button" class="ghost" data-action="compose">Write a post</button>' : ""
            }
          </div>
        </div>
      </div>`;
    }

    if (key === lastRender) {
      // Only the countdown changes between renders; update it in place so
      // the progress bar animates smoothly.
      if (state === "counting") {
        const num = el.querySelector(".num");
        const bar = el.querySelector(".bar > i");
        const remaining = remainingSeconds();
        if (num) num.textContent = Math.ceil(remaining);
        if (bar) bar.style.width = `${100 - (remaining / FF.UNLOCK_SECONDS) * 100}%`;
      }
      return;
    }
    lastRender = key;
    el.hidden = key === "none";
    el.innerHTML = html;
  }

  // ---------- unlock flow ----------

  function startCountdown() {
    if (document.visibilityState !== "visible") return;
    state = "counting";
    countdownStart = Date.now();
    resetNotice = false;
    render();
  }

  function cancelCountdown(leftPage) {
    if (state !== "counting") return;
    state = "locked";
    resetNotice = leftPage;
    render();
  }

  function unlock(at, save = true) {
    state = "unlocked";
    unlockedAt = at;
    root.setAttribute("data-ff-unlocked", "");
    if (save) {
      FF.set({ [`unlocked-${site}`]: at });
      FF.bump(site, "u");
    }
    render();
  }

  function relock(save = true) {
    state = "locked";
    unlockedAt = 0;
    resetNotice = false;
    root.removeAttribute("data-ff-unlocked");
    if (save) FF.set({ [`unlocked-${site}`]: false });
    render();
  }

  const leftPage = () => cancelCountdown(true);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") leftPage();
  });
  window.addEventListener("blur", leftPage);
  window.addEventListener("pagehide", leftPage);

  // ---------- saved state + stats ----------

  function applySaved(value) {
    if (FF.isUnlockValid(value)) {
      if (state !== "unlocked" || unlockedAt !== value) unlock(value, false);
    } else if (state === "unlocked") {
      relock(false);
    }
  }

  function applyStats(stats) {
    const s = FF.summarize(stats, 1);
    today = { blocked: s.blocked, minutes: s.minutes };
    render();
  }

  // One blocked session per visit to the feed, and no new one until the
  // site has been quiet for FF.SESSION_GAP_MS.
  async function countBlockedVisit() {
    countedVisit = true;
    const key = `lastBlock-${site}`;
    const now = Date.now();
    const { [key]: last = 0 } = await FF.get(key);
    FF.set({ [key]: now });
    if (now - last > FF.SESSION_GAP_MS) await FF.bump(site, "b");
  }

  FF.get([`unlocked-${site}`, "stats"]).then((items) => {
    ready = true;
    applySaved(items[`unlocked-${site}`]);
    applyStats(items.stats);
    tick();
  });
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (`unlocked-${site}` in changes) applySaved(changes[`unlocked-${site}`].newValue);
      if ("stats" in changes) applyStats(changes.stats.newValue);
    });
  } catch {
    // Extension context gone; nothing to sync.
  }

  // ---------- LinkedIn feed (class-name independent) ----------
  // LinkedIn's class names are randomized, so find the "Start a post" box
  // by its text, then mark every sibling along the path from it up to
  // <main> with data-ff-hide. If the box can't be found, <main> simply
  // stays hidden and the card offers a "Write a post" button instead.

  const COMPOSER_TEXT =
    /^(start a post|beitrag (beginnen|starten|verfassen)|commencer un post|empezar una publicaci[oó]n|iniciar publicaci[oó]n|crea un post|comece uma publica[cç][aã]o|begin een bericht)/i;
  const COMPOSER_MAX_HEIGHT = 300;
  const FALLBACK_AFTER_MS = 4000;

  let liFeedSince = 0;
  let liFallback = false;

  function findComposer(main) {
    const candidates = main.querySelectorAll(
      'button, [role="button"], [aria-label], [placeholder], [contenteditable="true"]'
    );
    for (const el of candidates) {
      const text = (
        el.getAttribute("aria-label") ||
        el.getAttribute("placeholder") ||
        el.textContent ||
        ""
      ).trim();
      if (text.length < 80 && COMPOSER_TEXT.test(text)) return el;
    }
    return null;
  }

  function hideLinkedInFeed() {
    const main = document.querySelector('main, [role="main"]');
    if (!main) return;
    const trigger = findComposer(main);

    if (!trigger) {
      if (!liFeedSince) liFeedSince = Date.now();
      if (!liFallback && Date.now() - liFeedSince > FALLBACK_AFTER_MS) {
        liFallback = true;
        lastRender = "";
      }
      return;
    }
    liFallback = false;

    // The share box is the largest ancestor that is still compact. Hide
    // every sibling on the path from it up to <main>: the posts, the
    // "New posts" pill and both sidebars.
    let box = trigger;
    while (
      box.parentElement &&
      box.parentElement !== main &&
      box.parentElement.getBoundingClientRect().height <= COMPOSER_MAX_HEIGHT
    ) {
      box = box.parentElement;
    }

    for (let node = box; node && node !== main; node = node.parentElement) {
      for (const sibling of node.parentElement.children) {
        if (sibling !== node && !sibling.hasAttribute("data-ff-hide")) {
          sibling.setAttribute("data-ff-hide", "");
        }
      }
    }
    root.setAttribute("data-ff-li-ready", "");
  }

  // The notifications bell and invitation/request entries, wherever
  // LinkedIn's top bar puts them. The feed and messaging pages render
  // different headers (the messaging one sometimes inside a shadow root or
  // an iframe), so this works from links, icons, labels and badges rather
  // than class names. Nav labels read like "Jobs, 0 new notifications", so
  // only match labels that *start* with a notification word.
  const NOTIF_LABEL =
    /^\s*(notification|request|invitation|benachrichtigung|mitteilung|anfrage|einladung|notificaci|notifiche|notifica|demande)/i;
  const NOTIF_HREF = /\/notifications|\/invitation-manager|\/invitations?\b/;
  const BELL = 'svg[id^="bell"], [data-test-icon^="bell"], li-icon[type^="bell"], [data-test-global-nav-link="notifications"]';
  const TOP_BAR_PX = 120;

  // Injected into shadow roots, where focus.css can't reach.
  const SHADOW_CSS = `
    [data-ff-hide-notif], a[href*="/notifications"],
    a[data-test-global-nav-link="notifications"],
    li:has(> a[href*="/notifications"]) { display: none !important; }`;

  const inTopBar = (el) => {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < TOP_BAR_PX;
  };
  const isMessaging = (el) => {
    const item = el.closest("li") || el;
    return !!(
      el.closest('[href*="messaging"]') ||
      item.querySelector('[href*="messaging"]') ||
      /messag|nachricht/i.test(el.getAttribute("aria-label") || "")
    );
  };
  const hideNotif = (el) => {
    const item = el.closest("li");
    const target = item && !item.querySelector('[href*="messaging"]') ? item : el;
    target.setAttribute("data-ff-hide-notif", "");
  };
  // Text directly inside the element, ignoring children like a
  // visually-hidden "1 new notification" span.
  const ownText = (el) => {
    let t = "";
    for (const n of el.childNodes) if (n.nodeType === 3) t += n.data;
    return t.trim();
  };

  function hideNotificationsIn(scope) {
    // Links to the notifications or invitations pages, anywhere.
    for (const el of scope.querySelectorAll("a[href]")) {
      if (el.hasAttribute("data-ff-hide-notif")) continue;
      if (NOTIF_HREF.test(el.getAttribute("href")) && !isMessaging(el)) hideNotif(el);
    }

    // Top-bar entries labelled "Notifications" (or with a bell icon) that
    // aren't plain links, e.g. buttons or dropdowns.
    const controls = scope.querySelectorAll(
      `header a, header button, nav a, nav button, [role="navigation"] a, [role="navigation"] button, ${BELL}`
    );
    for (let el of controls) {
      if (!el.matches("a, button")) el = el.closest("a, button") || el;
      if (el.hasAttribute("data-ff-hide-notif") || isMessaging(el) || !inTopBar(el)) continue;
      const label = el.getAttribute("aria-label") || el.textContent || "";
      if (el.matches(BELL) || el.querySelector(BELL) || NOTIF_LABEL.test(label)) hideNotif(el);
    }

    // Unread-count badges ("11", "99+") on the remaining top-bar items,
    // except Messaging.
    for (const bar of scope.querySelectorAll('header, nav, [role="navigation"], #global-nav')) {
      if (!inTopBar(bar)) continue;
      for (const el of bar.querySelectorAll("span, div, sup, b, .notification-badge")) {
        if (el.hasAttribute("data-ff-hide-notif") || isMessaging(el)) continue;
        if (!el.matches(".notification-badge") && !/^\d+\+?$/.test(ownText(el))) continue;
        el.setAttribute("data-ff-hide-notif", "");
      }
    }
  }

  // Open shadow roots are found by a full scan, which is too slow for every
  // tick, so it runs once a second.
  let shadowRoots = [];
  let lastShadowScan = 0;
  function findShadowRoots() {
    const found = [];
    const walk = (scope) => {
      for (const el of scope.querySelectorAll("*")) {
        if (!el.shadowRoot || el === host_) continue;
        found.push(el.shadowRoot);
        walk(el.shadowRoot);
      }
    };
    walk(document);
    return found;
  }

  function hideLinkedInNotifications() {
    if (state !== "unlocked") hideNotificationsIn(document);
    if (Date.now() - lastShadowScan > 1000) {
      lastShadowScan = Date.now();
      shadowRoots = findShadowRoots();
    }
    for (const sr of shadowRoots) {
      let style = sr.querySelector("style[data-ff]");
      if (!style) {
        style = document.createElement("style");
        style.setAttribute("data-ff", "");
        style.textContent = SHADOW_CSS;
        sr.append(style);
      }
      // focus.css shows notifications again once the feed is unlocked;
      // shadow roots follow along here.
      style.disabled = state === "unlocked";
      if (state !== "unlocked") hideNotificationsIn(sr);
    }
  }

  // X's right sidebar: trends, "What's happening", "Live on X", who to
  // follow. Its modules aren't consistently wrapped in <section>, so find
  // each module by its heading and hide the largest block around it that
  // doesn't also hold the search box. The search box and its dropdown stay.
  const X_SIDE_TITLE =
    /^\s*(what.s happening|live on x|who to follow|trends? for you|trending|today.s news|subscribe to premium|relevant people|you might like)/i;
  const X_SEARCH = '[data-testid="SearchBox_Search_Input"], form[role="search"], input[type="search"]';
  const X_POPUP = '[role="listbox"], [id^="typeaheadDropdown"], [data-testid*="typeahead"]';

  function hideXSidebar() {
    const side = document.querySelector('[data-testid="sidebarColumn"]');
    if (!side) return;
    const titles = side.querySelectorAll('h2, [role="heading"], span');
    for (const title of titles) {
      if (title.matches("span") && (title.childElementCount || !X_SIDE_TITLE.test(title.textContent))) continue;
      if (title.closest("[data-ff-hide-side]") || title.closest(X_POPUP)) continue;
      let block = title;
      while (block.parentElement && block.parentElement !== side && !block.parentElement.querySelector(X_SEARCH)) {
        block = block.parentElement;
      }
      if (!block.querySelector(X_SEARCH)) block.setAttribute("data-ff-hide-side", "");
    }
  }

  // ---------- main loop ----------
  // Both sites are single-page apps, so poll for URL changes rather than
  // relying on page loads. This also strips the "(3) " unread count that
  // both sites prepend to the tab title.

  // Everything that hides page content. Runs on every tick and also straight
  // from a MutationObserver, which fires before the browser paints, so new
  // content is hidden before it's ever on screen.
  function hideNow() {
    const page = pageType();
    if (root.getAttribute("data-ff-page") !== page) root.setAttribute("data-ff-page", page);
    if (site === "li") hideLinkedInNotifications();
    if (site === "li" && page === "feed" && state !== "unlocked") hideLinkedInFeed();
    if (site === "x" && state !== "unlocked") hideXSidebar();
  }

  // Busy pages mutate constantly, so run at most every 50 ms and catch the
  // rest in the next animation frame, which is still before paint.
  let lastHide = 0;
  let hideQueued = false;
  new MutationObserver(() => {
    if (Date.now() - lastHide > 50) {
      lastHide = Date.now();
      hideNow();
    } else if (!hideQueued) {
      hideQueued = true;
      requestAnimationFrame(() => {
        hideQueued = false;
        lastHide = Date.now();
        hideNow();
      });
    }
  }).observe(root, { childList: true, subtree: true });

  function tick() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      root.setAttribute("data-ff-page", pageType());
      if (state === "counting") cancelCountdown(true);
    }
    const onFeed = root.getAttribute("data-ff-page") === "feed";
    if (!onFeed) countedVisit = false;

    if (state === "counting" && Date.now() - countdownStart >= FF.UNLOCK_SECONDS * 1000) {
      unlock(Date.now());
    }
    // The daily reset, for tabs left open overnight.
    if (state === "unlocked" && !FF.isUnlockValid(unlockedAt)) relock();

    if (ready && onFeed && state === "locked" && !countedVisit) countBlockedVisit();

    hideNow();

    if (state !== "unlocked") {
      const title = document.title;
      const cleaned = title.replace(/^\(\d+\+?\)\s*/, "");
      if (cleaned !== title) document.title = cleaned;
    }

    render();
  }

  setInterval(tick, 250);
  document.addEventListener("DOMContentLoaded", tick);
  tick();
})();
