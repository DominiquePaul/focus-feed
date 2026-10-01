// The toolbar popup: time won back, blocked sessions and per-site status.
(() => {
  "use strict";

  const FF = globalThis.FF;
  const $ = (id) => document.getElementById(id);
  const resetLabel = `${String(FF.RESET_HOUR).padStart(2, "0")}:00`;
  const shortDate = (key) =>
    new Date(`${key}T12:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  $("version").textContent = `v${chrome.runtime.getManifest().version}`;
  $("foot").textContent =
    `Estimate: ${FF.MINUTES_PER_SESSION} min per blocked session, minus sessions you unlocked. Feeds hide again at ${resetLabel} daily.`;

  function renderStats(stats = {}) {
    const all = FF.summarize(stats);
    const today = FF.summarize(stats, 1);
    const week = FF.summarize(stats, 7);
    const first = Object.keys(stats).sort()[0];

    $("total").textContent = FF.formatMinutes(all.minutes);
    $("since").textContent = first
      ? `${all.blocked} sessions blocked since ${shortDate(first)}.`
      : "Counting starts with your next visit.";
    $("today-blocked").textContent = today.blocked;
    $("today-saved").textContent = FF.formatMinutes(today.minutes);
    $("week-blocked").textContent = week.blocked;

    const days = FF.lastDays(14).map((key) => ({ key, ...FF.summarize({ [key]: stats[key] || {} }) }));
    const max = Math.max(1, ...days.map((d) => d.blocked));
    const plot = $("plot");
    plot.replaceChildren();
    plot.setAttribute(
      "aria-label",
      `Sessions blocked per day, last 14 days: ${days.map((d) => `${shortDate(d.key)} ${d.blocked}`).join(", ")}`
    );
    days.forEach((d, i) => {
      const col = document.createElement("div");
      col.className = "col" + (i === days.length - 1 ? " today" : "") + (d.blocked ? "" : " empty");
      const bar = document.createElement("i");
      bar.style.height = `${(d.blocked / max) * 100}%`;
      col.append(bar);
      col.addEventListener("mouseenter", () => showTip(col, d));
      col.addEventListener("mouseleave", () => ($("tip").hidden = true));
      plot.append(col);
    });
    $("axis-start").textContent = shortDate(days[0].key);
  }

  function showTip(col, d) {
    const tip = $("tip");
    const chart = col.closest(".chart").getBoundingClientRect();
    const r = col.getBoundingClientRect();
    tip.textContent = `${shortDate(d.key)} · ${d.blocked} blocked · ${FF.formatMinutes(d.minutes)} saved`;
    tip.hidden = false;
    const half = tip.offsetWidth / 2;
    const x = Math.min(Math.max(r.left - chart.left + r.width / 2, half), chart.width - half);
    tip.style.left = `${x}px`;
  }

  function renderSites(items) {
    const box = $("sites");
    box.replaceChildren();
    for (const [site, name] of Object.entries(FF.SITES)) {
      const open = site !== "ig" && FF.isUnlockValid(items[`unlocked-${site}`]);
      const row = document.createElement("div");
      row.className = "site" + (open ? " open" : "");
      row.innerHTML = `<span class="name"></span><span class="state"><span class="dot"></span><span></span></span>`;
      row.querySelector(".name").textContent = name;
      row.querySelector(".state span:last-child").textContent = site === "ig" ? "Always hidden" : open ? `Open → ${resetLabel}` : "Hidden";
      if (open) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = "Hide now";
        btn.addEventListener("click", () => FF.set({ [`unlocked-${site}`]: false }));
        row.append(btn);
      }
      box.append(row);
    }
  }

  const keys = ["stats", ...Object.keys(FF.SITES).map((s) => `unlocked-${s}`)];
  const refresh = () =>
    FF.get(keys).then((items) => {
      renderStats(items.stats);
      renderSites(items);
    });
  refresh();
  chrome.storage.onChanged.addListener(refresh);
})();
