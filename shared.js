// Shared by the content script (focus.js) and the popup (popup.js).
// Everything lives in chrome.storage.local:
//   unlocked-li / unlocked-x   timestamp the feed was unlocked, or false
//   lastBlock-li / lastBlock-x timestamp of the last blocked session
//   stats                      { "YYYY-MM-DD": { li: {b, u}, x: {b, u} } }
//                              b = sessions blocked, u = feed unlocked
(() => {
  "use strict";

  const FF = {
    UNLOCK_SECONDS: 15,
    // Unlocks expire at this local hour every day, so each day starts focused.
    RESET_HOUR: 6,
    // A new blocked session starts after this much quiet time on a site, so
    // reloading or clicking around doesn't inflate the count.
    SESSION_GAP_MS: 10 * 60 * 1000,
    // Estimated scrolling time avoided per blocked session.
    MINUTES_PER_SESSION: 7,
    SITES: { li: "LinkedIn", x: "X" },
  };

  FF.store = globalThis.chrome?.storage?.local;

  // The most recent RESET_HOUR at or before `now`.
  FF.lastReset = (now = Date.now()) => {
    const d = new Date(now);
    d.setHours(FF.RESET_HOUR, 0, 0, 0);
    if (d.getTime() > now) d.setDate(d.getDate() - 1);
    return d.getTime();
  };

  // `true` from older versions has no timestamp, so it counts as expired.
  FF.isUnlockValid = (value, now = Date.now()) =>
    typeof value === "number" && value >= FF.lastReset(now);

  FF.dayKey = (t = Date.now()) => {
    const d = new Date(t);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  FF.get = (keys) =>
    new Promise((resolve) => {
      try {
        FF.store.get(keys, (items) => resolve(items || {}));
      } catch {
        resolve({});
      }
    });

  FF.set = (items) => {
    try {
      FF.store?.set(items);
    } catch {
      // The extension was reloaded and this page's script is stale.
    }
  };

  // field: "b" (blocked) or "u" (unlocked)
  FF.bump = async (site, field) => {
    const { stats = {} } = await FF.get("stats");
    const day = (stats[FF.dayKey()] ||= {});
    const entry = (day[site] ||= { b: 0, u: 0 });
    entry[field] = (entry[field] || 0) + 1;
    FF.set({ stats });
  };

  // The last `days` calendar days, oldest first.
  FF.lastDays = (days, now = Date.now()) => {
    const d = new Date(now);
    d.setHours(12, 0, 0, 0);
    const keys = [];
    for (let i = 0; i < days; i++) {
      keys.unshift(FF.dayKey(d.getTime()));
      d.setDate(d.getDate() - 1);
    }
    return keys;
  };

  // Time saved counts sessions blocked minus those where the feed was
  // unlocked anyway.
  FF.summarize = (stats = {}, days = null) => {
    const pick = (days ? FF.lastDays(days) : Object.keys(stats)).filter((k) => stats[k]);
    let blocked = 0;
    let unlocked = 0;
    for (const k of pick) {
      for (const s of Object.values(stats[k])) {
        blocked += s.b || 0;
        unlocked += s.u || 0;
      }
    }
    const minutes = Math.max(0, blocked - unlocked) * FF.MINUTES_PER_SESSION;
    return { blocked, unlocked, minutes };
  };

  FF.formatMinutes = (m) => {
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const rest = m % 60;
    return rest ? `${h}h ${rest}m` : `${h}h`;
  };

  globalThis.FF = FF;
})();
