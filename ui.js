// Shared on-page card, fonts and statistics for all supported sites.
(() => {
  "use strict";
  const FF = globalThis.FF;

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
    nav.actions { flex-wrap: wrap; margin-top: 14px; }
    .text p.multiline { white-space: normal; }
    [hidden] { display: none !important; }
    button, a.action {
      all: unset; box-sizing: border-box; cursor: pointer; white-space: nowrap;
      display: inline-flex; align-items: center; gap: 10px;
      padding: 11px 16px; border: 1.5px solid var(--ink); border-radius: 999px;
      font: 700 11px/1 "FF Mono", ui-monospace, Menlo, monospace;
      letter-spacing: .12em; text-transform: uppercase;
      background: var(--ink); color: var(--paper);
      transition: transform .15s ease;
    }
    button:hover, a.action:hover { transform: translate(-1px, -1px); }
    button:active, a.action:active { transform: translate(1px, 1px); }
    button:focus-visible, a.action:focus-visible { outline: 2px solid var(--signal); outline-offset: 3px; }
    button .tag { color: var(--signal); }
    @media (prefers-color-scheme: light) { button .tag { color: #8da0ff; } }
    button.ghost, a.action.ghost { background: transparent; color: var(--ink); }
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
      button, a.action, .bar > i { transition: none; }
    }
  `;

  FF.createCard = (tag, onClick) => {
    const host = document.createElement(tag);
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = CARD_CSS;
    const wrap = document.createElement("div");
    wrap.className = "wrap";
    wrap.setAttribute("role", "status");
    wrap.hidden = true;
    if (onClick) wrap.addEventListener("click", onClick);
    shadow.append(style, wrap);
    loadFonts();
    return { host, shadow, wrap };
  };

  FF.cardMeta = (label, end = "") =>
    `<div class="meta"><span class="dot"></span>Focus Feed<span class="dim">/ ${label}</span>${
      end ? `<span class="end">${end}</span>` : ""
    }</div>`;

  FF.cardStats = (today) => `<div class="stats">
    <div><b>${today.blocked}</b><span>Blocked today</span></div>
    <div><b>${FF.formatMinutes(today.minutes)}</b><span>Won back</span></div>
  </div>`;
})();
