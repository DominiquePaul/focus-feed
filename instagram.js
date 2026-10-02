// Instagram stays focused: messages, account search, and profiles only.
(() => {
  "use strict";

  const root = document.documentElement;
  const FF = globalThis.FF;
  const RESERVED = new Set([
    "accounts", "about", "api", "auth_platform", "challenge", "checkpoint",
    "developer", "direct", "directory", "emails", "explore", "legal", "notifications",
    "p", "press", "privacy", "push", "reel", "reels", "session", "settings",
    "static", "stories", "terms", "web", "your_activity",
  ]);
  const SEARCH = 'nav input[type="text"], [role="search"] input, input[type="search"], input[placeholder="Search"], input[aria-label="Search input"], [role="searchbox"]';
  const MEDIA_LINK = 'a[href*="/p/"], a[href*="/reel/"], a[href*="/reels/"], a[href*="/stories/"]';
  const profilePosts = new Set();
  let profilePath = "";
  let counted = false;
  let card;
  let today = { blocked: 0, minutes: 0 };
  let statsKey = "";

  function parts(path) {
    return path.split("/").filter(Boolean);
  }

  function isProfile(path) {
    const [user, tab, ...rest] = parts(path);
    return !!user && /^[\w.]+$/.test(user) && !RESERVED.has(user.toLowerCase()) &&
      !rest.length && (!tab || ["reels", "tagged", "saved", "followers", "following"].includes(tab));
  }

  function profileReady(path) {
    const user = parts(path)[0];
    return [...document.querySelectorAll('main a[href], [role="main"] a[href]')].some((link) => {
      const target = linkPath(link).toLowerCase();
      const base = `/${user.toLowerCase()}/`;
      return target === `${base}reels/` || target === `${base}tagged/` ||
        (target === base && link.closest("header") && !link.closest("article"));
    });
  }

  function postId(path) {
    // Instagram rewrites /username/p/id/ to /p/id/ when opening a modal.
    const match = path.match(/^\/(?:[\w.]+\/)?p\/([\w-]+)\/?$/);
    return match?.[1];
  }

  function mode() {
    const path = location.pathname;
    if (/^\/accounts\/activity(?:\/|$)/.test(path)) return "blocked";
    if (/^\/direct(?:\/|$)/.test(path)) return "messages";
    if (/^\/(accounts|auth_platform|challenge|checkpoint|settings|privacy|legal|terms|your_activity)(\/|$)/.test(path)) return "account";
    if (isProfile(path)) return profileReady(path) ? "profile" : "blocked";
    if (postId(path) && profilePosts.has(postId(path))) return "post";
    return "blocked";
  }

  function linkPath(link) {
    try {
      const url = new URL(link.getAttribute("href"), location.href);
      return url.origin === location.origin ? url.pathname : "";
    } catch {
      return "";
    }
  }

  function showCard(show) {
    if (!document.body) return;
    if (!card) {
      const ui = FF.createCard("focus-feed-instagram");
      card = ui.host;
      ui.wrap.hidden = false;
      ui.wrap.innerHTML = `
        <section class="card" aria-label="Focus Feed">
          ${FF.cardMeta(FF.SITES.ig.name)}
          <div class="row">
            <div class="text">
              <h1>The feed is <em>off</em>.</h1>
              <p class="multiline">Messages and account search stay available. View posts on a profile.</p>
            </div>
            <div id="stats"></div>
          </div>
          <nav class="actions" aria-label="Instagram shortcuts">
            <a class="action" href="${FF.SITES.ig.messagesURL}">Open messages</a>
            <a class="action ghost" href="/explore/">Search accounts</a>
            <a class="action ghost" id="profile" hidden>Back to profile</a>
          </nav>
        </section>`;
    }
    card.hidden = !show;
    const key = `${today.blocked}:${today.minutes}`;
    if (key !== statsKey) {
      card.shadowRoot.getElementById("stats").innerHTML = FF.cardStats(today);
      statsKey = key;
    }
    const back = card.shadowRoot.getElementById("profile");
    back.hidden = !profilePath;
    if (profilePath) back.setAttribute("href", profilePath);
    if (!card.isConnected) root.append(card);
  }

  // Reveal only navigation and the search panel on blocked pages. Current
  // Instagram puts search in a <nav> inside <main>; older layouts use a
  // separate panel. Never reveal an ancestor containing the post grid.
  function markSearchAndNavigation() {
    for (const el of document.querySelectorAll("[data-ff-ig-keep]")) {
      el.removeAttribute("data-ff-ig-keep");
    }
    for (const link of document.querySelectorAll("a[href]")) {
      const path = linkPath(link);
      if (path === "/direct/inbox/" || path === "/explore/" ||
          (isProfile(path) && !link.closest('main, [role="main"], article'))) {
        link.setAttribute("data-ff-ig-keep", "");
      }
    }
    for (const input of document.querySelectorAll(SEARCH)) {
      let panel = input;
      while (panel.parentElement && panel.parentElement !== document.body &&
          !panel.parentElement.matches('main, [role="main"]') &&
          !panel.parentElement.querySelector(`${MEDIA_LINK}, article, video, main, [role="main"]`)) {
        panel = panel.parentElement;
      }
      panel.setAttribute("data-ff-ig-keep", "");
      const searchNav = input.closest('nav, [role="search"]');
      if (searchNav) {
        for (const link of searchNav.querySelectorAll("a[href]")) {
          if (isProfile(linkPath(link))) link.setAttribute("data-ff-ig-keep", "");
        }
      }
    }
  }

  function applyStats(stats) {
    today = FF.summarize(stats, 1);
    update();
  }
  FF.get("stats").then(({ stats }) => applyStats(stats));
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && "stats" in changes) applyStats(changes.stats.newValue);
    });
  } catch {
    // Extension context gone; nothing to sync.
  }

  function silenceHiddenVideo(video) {
    const current = root.getAttribute("data-ff-ig-mode");
    if (current === "blocked" || (current === "post" && !video.closest('[role="dialog"] article'))) {
      video.pause();
    }
  }

  function update() {
    const current = mode();
    if (root.getAttribute("data-ff-ig-mode") !== current) root.setAttribute("data-ff-ig-mode", current);
    if (current === "profile") {
      if (profilePath !== location.pathname) {
        profilePosts.clear();
        profilePath = location.pathname;
      }
      for (const link of document.querySelectorAll('main a[href], [role="main"] a[href]')) {
        const id = postId(linkPath(link));
        if (id) profilePosts.add(id);
      }
    } else if (current !== "post") {
      profilePosts.clear();
    }
    if (current === "blocked") markSearchAndNavigation();
    // A post is available only as a modal over the profile it came from.
    // Direct links and reloads remain blocked, as does the infinite Reel viewer.
    const blocked = current === "blocked" || (current === "post" && !document.querySelector('[role="dialog"] article'));
    const search = /^\/explore\/?(?:search\/?)?$/.test(location.pathname);
    const searching = search && [...document.querySelectorAll(SEARCH)].some((input) => input.value?.trim());
    showCard(blocked && !searching);
    if (blocked && !search && !isProfile(location.pathname) && !counted) {
      counted = true;
      void FF.countBlockedVisit("ig");
    } else if (!blocked || search) {
      counted = false;
    }
    for (const video of document.querySelectorAll("video")) silenceHiddenVideo(video);
  }

  // React replaces page content on client navigation. Mutation callbacks run
  // before paint; polling also catches URL changes without a DOM mutation.
  new MutationObserver(update).observe(root, { childList: true, subtree: true });
  document.addEventListener("play", (event) => {
    if (event.target instanceof HTMLVideoElement) silenceHiddenVideo(event.target);
  }, true);
  window.navigation?.addEventListener("currententrychange", update);
  window.addEventListener("popstate", update);
  window.addEventListener("pageshow", update);
  document.addEventListener("DOMContentLoaded", update);
  document.addEventListener("input", update);
  setInterval(update, 250);
  update();
})();
