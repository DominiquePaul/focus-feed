// Run in a real browser with the extension's actual scripts and CSS.
// No Instagram data, credentials, or requests are used by these fixtures.
(async () => {
  "use strict";
  const frame = document.querySelector("iframe");
  const results = document.getElementById("results");
  document.getElementById("narrow").addEventListener("change", (event) => {
    frame.style.width = event.target.checked ? "360px" : "100%";
  });
  let passed = 0;
  let failed = 0;
  const source = async (file) => (await fetch(`../${file}`)).text();
  const [css, shared, ui, instagram, focusCSS, popup, popupHTML] = await Promise.all(
    ["instagram.css", "shared.js", "ui.js", "instagram.js", "focus.css", "popup.js", "popup.html"].map(source)
  );
  const delay = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const visible = (el) => !!el && !el.closest("[hidden]") &&
    frame.contentWindow.getComputedStyle(el).visibility !== "hidden" &&
    frame.contentWindow.getComputedStyle(el).display !== "none" &&
    [...ancestors(el)].every((p) => frame.contentWindow.getComputedStyle(p).display !== "none");
  function* ancestors(el) { for (let p = el.parentElement; p; p = p.parentElement) yield p; }
  const $ = (selector) => frame.contentDocument.querySelector(selector);
  const mode = () => frame.contentDocument.documentElement.getAttribute("data-ff-ig-mode");
  const storageMock = `
    window.testData = {};
    window.storageListeners = [];
    window.chrome = { runtime: {getManifest: () => ({version: 'test'}), getURL: p => '/' + p},
      storage: {local: {get: (keys, cb) => cb(structuredClone(window.testData)),
        set: items => {
          const changes = Object.fromEntries(Object.entries(items).map(([key, value]) =>
            [key, {oldValue: window.testData[key], newValue: structuredClone(value)}]));
          Object.assign(window.testData, structuredClone(items));
          window.storageListeners.forEach(listener => listener(changes, 'local'));
        }}, onChanged: {addListener(listener) { window.storageListeners.push(listener); }} } };
  `;
  const shell = `
    <aside><a href="/">Home</a> <a href="/explore/" id="search-link">Search</a>
      <a href="/reels/" id="reels-link">Reels</a>
      <a href="/notifications/" id="notifications-link">Notifications</a>
      <a href="/direct/inbox/" id="messages-link">Messages <span>2</span></a>
      <a href="/test.user/" id="profile-link">My profile</a></aside>`;
  const searchPanel = `<nav><div><input aria-label="Search input" placeholder="Search">
    <div id="results"><a href="/nasa/" id="account-result">NASA</a></div></div></nav>`;
  const feed = `<main>${searchPanel}<div id="feed"><article>Recommended post</article>
    <a href="/p/UNWANTED/">Suggested photo</a><video id="feed-video"></video>
    <button>Story by someone</button></div></main>`;
  const profile = `<main><header><h1>NASA</h1><button id="message-profile">Message</button></header>
    <a href="/nasa/reels/" id="profile-reels">Reels</a><a href="/nasa/tagged/">Tagged</a>
    <a href="/stories/nasa/123/" id="story">Story</a>
    <a href="/nasa/p/PHOTO1/" id="photo">Profile photo</a>
    <a href="/nasa/p/PHOTO2/">Another profile photo</a></main>`;
  const write = async (path, content, scripts = [shared, ui, instagram], styles = css, before = "") => {
    const loaded = new Promise((resolve) => frame.onload = resolve);
    frame.src = "/tests/frame.html";
    await loaded;
    frame.contentDocument.open();
    frame.contentDocument.write( `<!doctype html><html><head><style>${styles}</style></head><body>${content}
      <script>history.replaceState(null, '', ${JSON.stringify(path)});${storageMock}${before}<\/script>
      ${scripts.map(s => `<script>${s}<\/script>`).join("")}</body></html>`);
    frame.contentDocument.close();
    await delay();
  };
  const navigate = async (path, content) => {
    const win = frame.contentWindow;
    win.history.pushState(null, "", path);
    win.document.body.innerHTML = shell + content;
    await delay();
  };
  async function test(name, run) {
    const item = document.createElement("li");
    try {
      await run();
      item.className = "pass";
      item.textContent = `PASS: ${name}`;
      passed++;
    } catch (error) {
      item.className = "fail";
      item.textContent = `FAIL: ${name}: ${error.message}`;
      failed++;
    }
    results.append(item);
  }

  await test("Home feed, stories, notifications and Reels stay hidden; search and messages remain visible", async () => {
    await write("/", shell + feed);
    assert(mode() === "blocked", "home must be blocked");
    assert(!visible($("#feed")), "feed leaked");
    assert(!visible($("#reels-link")), "Reels link leaked");
    assert(!visible($("#notifications-link")), "notifications leaked");
    for (const selector of ["#messages-link", "#search-link", "#profile-link", "input", "#account-result"])
      assert(visible($(selector)), `${selector} should remain available`);
    assert($("focus-feed-instagram").shadowRoot.querySelectorAll("button").length === 0, "no unlock button");
    assert(frame.contentWindow.testData.stats[frame.contentWindow.FF.dayKey()].ig.b === 1, "blocked visit not counted");
  });
  await test("Explore search keeps accounts while hiding recommended media and tags", async () => {
    await navigate("/explore/search/", feed);
    assert(visible($("input")) && visible($("#account-result")), "search hidden");
    assert(!visible($("#feed")), "Explore grid leaked");
    $("#results").insertAdjacentHTML("beforeend", '<a id="tag-result" href="/explore/tags/space/">#space</a>');
    await delay();
    assert(!visible($("#tag-result")), "hashtag result leaked");
    assert(visible($("#account-result")), "account result lost after mutation");
  });
  await test("The Focus Feed card does not cover active account search results", async () => {
    await navigate("/explore/search/", feed);
    $("input").value = "nasa";
    $("input").dispatchEvent(new frame.contentWindow.Event("input", { bubbles: true }));
    assert($("focus-feed-instagram").hidden && visible($("#account-result")), "card covers search results");
    $("input").value = "";
    $("input").dispatchEvent(new frame.contentWindow.Event("input", { bubbles: true }));
    assert(!$("focus-feed-instagram").hidden && !visible($("#feed")), "clearing search exposed feed");
  });
  await test("Mixed search results preserve accounts but never reveal media", async () => {
    await navigate("/explore/search/", feed);
    $("#results").insertAdjacentHTML("beforeend", '<a id="media-result" href="/p/OTHER/">Photo</a>');
    await delay();
    assert(visible($("input")) && visible($("#account-result")), "mixed results hid accounts");
    assert(!visible($("#media-result")), "media result leaked");
  });
  await test("Search works in older side-panel layouts without exposing the underlying feed", async () => {
    await navigate("/", `<div id="search-panel">${searchPanel}</div><main><article id="post">Feed</article></main>`);
    assert(visible($("input")) && visible($("#account-result")), "side-panel search hidden");
    assert(!visible($("#post")), "post behind search leaked");
  });
  await test("Dynamically inserted feed items stay hidden before the next frame", async () => {
    await navigate("/explore/", feed);
    $("#feed").insertAdjacentHTML("beforeend", '<article id="late-post">Late recommendation</article>');
    assert(!visible($("#late-post")), "late post flashed");
  });
  await test("Reels, Stories, standalone posts, tags, locations and unknown routes fail closed", async () => {
    for (const path of ["/reels/", "/reels/123/", "/reel/123/", "/stories/nasa/123/", "/p/PHOTO1/",
      "/nasa/p/PHOTO1/", "/accounts/activity/", "/explore/tags/space/", "/explore/locations/123/", "/new/unknown/route/"]) {
      await navigate(path, '<main><article id="content">Content</article></main><div role="dialog" id="dialog">More content</div>');
      assert(mode() === "blocked" && !visible($("#content")) && !visible($("#dialog")), `${path} leaked`);
    }
  });
  await test("Inbox and conversation controls, attachments and unread badges stay usable", async () => {
    for (const path of ["/direct/inbox/", "/direct/t/123/", "/direct/requests/"]) {
      await navigate(path, '<main><textarea id="composer" aria-label="Message"></textarea><button id="send">Send</button><img id="attachment" alt="Shared photo"></main>');
      assert(mode() === "messages", "messaging route blocked");
      for (const selector of ["#composer", "#send", "#attachment", "#messages-link span"])
        assert(visible($(selector)), `${selector} hidden`);
      $("#composer").value = "Local fixture only";
      assert($("#composer").value === "Local fixture only", "composer not editable");
    }
  });
  await test("Profiles and their tabs remain available without Stories or global Reels", async () => {
    for (const path of ["/nasa/", "/nasa/reels/", "/nasa/tagged/", "/nasa/followers/"]) {
      await navigate(path, profile);
      assert(mode() === "profile", `${path} blocked`);
      assert(visible($("#photo")) && visible($("#message-profile")) && visible($("#profile-reels")), "profile content hidden");
      assert(!visible($("#story")) && !visible($("#reels-link")), "global content leaked");
    }
  });
  await test("A profile URL never reveals stale Home content while the profile loads", async () => {
    await navigate("/", feed);
    frame.contentWindow.history.pushState(null, "", "/nasa/");
    await delay();
    assert(mode() === "blocked" && !visible($("#feed")), "stale Home content revealed");
    await navigate("/p/UNWANTED/", '<div role="dialog"><article id="stale-post">Stale recommendation</article></div>');
    assert(mode() === "blocked" && !visible($("#stale-post")), "stale Home post entered profile allowlist");
  });
  await test("Only posts from the viewed profile can open in a modal", async () => {
    await navigate("/nasa/", profile);
    await navigate("/p/PHOTO1/", profile + '<div role="dialog"><button>Close</button><article id="selected">Selected profile post</article></div>');
    assert(mode() === "post" && visible($("#selected")), "selected post hidden");
    assert(!visible($("#photo")), "background profile should be hidden");
    await navigate("/p/PHOTO2/", '<div role="dialog"><article id="selected">Next profile post</article></div>');
    assert(visible($("#selected")), "next known profile post hidden");
    await navigate("/p/RECOMMENDATION/", '<div role="dialog"><article id="suggested">Unrelated post</article></div>');
    assert(mode() === "blocked" && !visible($("#suggested")), "unrelated recommendation leaked");
  });
  await test("A selected post without a profile modal fails closed", async () => {
    await navigate("/nasa/", profile);
    await navigate("/p/PHOTO1/", '<main><article id="selected">Standalone post</article></main>');
    assert(!visible($("#selected")), "standalone content leaked");
    assert(!$("focus-feed-instagram").hidden, "recovery shortcuts missing");
  });
  await test("Reloading a post clears profile context", async () => {
    await write("/p/PHOTO1/", '<div role="dialog"><article id="selected">Post</article></div>');
    assert(mode() === "blocked" && !visible($("#selected")), "post context survived reload");
  });
  await test("SPA navigation and back/forward restore the correct visibility", async () => {
    await navigate("/nasa/", profile);
    await navigate("/", feed);
    assert(!visible($("#feed")), "home leaked after profile");
    await navigate("/direct/t/123/", '<main id="conversation">Conversation</main>');
    assert(visible($("#conversation")), "conversation hidden after feed");
    frame.contentWindow.history.replaceState(null, "", "/reels/");
    frame.contentWindow.dispatchEvent(new frame.contentWindow.PopStateEvent("popstate"));
    assert(mode() === "blocked" && !visible($("#conversation")), "popstate not handled");
    frame.contentWindow.history.replaceState(null, "", "/direct/inbox/");
    await delay(300);
    assert(mode() === "messages", "URL-only navigation not detected");
  });
  await test("Login, two-factor checks and account settings remain accessible", async () => {
    for (const path of ["/accounts/login/", "/auth_platform/codeentry/", "/challenge/", "/checkpoint/", "/accounts/edit/", "/settings/"]) {
      await navigate(path, '<main><input id="account-control"></main>');
      assert(mode() === "account" && visible($("#account-control")), `${path} blocked`);
    }
  });
  await test("Blocked video playback is paused, messaging video is left alone", async () => {
    await navigate("/reels/", '<main><video id="video"></video></main>');
    let pauses = 0;
    $("#video").pause = () => pauses++;
    $("#video").dispatchEvent(new frame.contentWindow.Event("play"));
    assert(pauses === 1, "hidden video not paused");
    await navigate("/direct/t/123/", '<main><video id="video"></video></main>');
    $("#video").pause = () => pauses++;
    $("#video").dispatchEvent(new frame.contentWindow.Event("play"));
    assert(pauses === 1, "message video was paused");
  });
  await test("Instagram ignores saved unlocks and search does not count as a blocked visit", async () => {
    await write("/explore/", shell + feed, [shared, ui, instagram], css,
      'window.testData["unlocked-ig"] = Date.now();');
    assert(mode() === "blocked" && !visible($("#feed")), "saved unlock exposed feed");
    assert(!frame.contentWindow.testData.stats, "search inflated blocked count");
  });
  await test("Popup lists Instagram as always hidden even with an old unlock timestamp", async () => {
    const content = popupHTML.match(/<body>([\s\S]*?)<script/)[1];
    await write("/popup.html", content, [shared, popup], "",
      'window.testData["unlocked-ig"] = Date.now(); window.testData["unlocked-x"] = Date.now();');
    const rows = [...frame.contentDocument.querySelectorAll(".site")];
    const ig = rows.find(r => r.textContent.includes("Instagram"));
    assert(ig.textContent.includes("Always hidden") && !ig.querySelector("button"), "Instagram can unlock");
    assert(rows.find(r => r.textContent.startsWith("X")).querySelector("button"), "X relock control missing");
  });
  await test("Instagram card reuses the shared daily statistics and updates when storage changes", async () => {
    await write("/", shell + feed);
    const stats = () => $("focus-feed-instagram").shadowRoot.querySelector("#stats").textContent;
    assert(stats().includes("1") && stats().includes("7m"), "first block missing from card");
    const win = frame.contentWindow;
    const day = win.FF.dayKey();
    win.FF.set({stats: {[day]: {li: {b: 2, u: 1}, x: {b: 1, u: 0}, ig: {b: 3, u: 0}}}});
    assert(stats().includes("6") && stats().includes("35m"), "shared storage update missing from card");
    await navigate("/direct/inbox/", '<main>Messages</main>');
    await navigate("/", feed);
    assert(win.testData.stats[day].ig.b === 3, "repeat visit inflated count");
  });
  await test("Popup totals, daily tiles and 14-day chart include Instagram and refresh live", async () => {
    const content = popupHTML.match(/<body>([\s\S]*?)<script/)[1];
    await write("/popup.html", content, [shared, popup], "");
    const win = frame.contentWindow;
    const today = win.FF.dayKey();
    const yesterday = win.FF.lastDays(2)[0];
    win.FF.set({stats: {
      [yesterday]: {li: {b: 2, u: 1}, x: {b: 1, u: 0}, ig: {b: 3, u: 0}},
      [today]: {li: {b: 1, u: 0}, x: {b: 2, u: 1}, ig: {b: 4, u: 0}},
    }});
    await delay();
    assert($("#total").textContent === "1h 17m", "all-time minutes omit a site");
    assert($("#today-blocked").textContent === "7", "daily blocked total wrong");
    assert($("#today-saved").textContent === "42m", "daily time saved wrong");
    assert($("#week-blocked").textContent === "13", "weekly total wrong");
    assert($("#plot").children.length === 14, "chart day count changed");
    assert($("#plot").lastElementChild.querySelector("i").style.height === "100%", "today chart bar wrong");
    assert($("#plot").getAttribute("aria-label").endsWith(" 7"), "chart accessible summary omits Instagram");
    assert($("#foot").textContent.includes("Instagram stays hidden"), "footer implies Instagram unlocks");
  });
  await test("Existing X feed CSS and messaging remain unchanged", async () => {
    await write("/home", '<main data-testid="primaryColumn"><section role="region" id="x-feed">Timeline</section><textarea id="x-compose"></textarea></main>',
      [], focusCSS, 'document.documentElement.dataset.ffSite="x"; document.documentElement.dataset.ffPage="feed";');
    assert(!visible($("#x-feed")) && visible($("#x-compose")), "X feed/composer regression");
    frame.contentDocument.documentElement.setAttribute("data-ff-unlocked", "");
    assert(visible($("#x-feed")), "X unlock regression");
  });
  await test("Existing LinkedIn feed hiding still keeps the marked composer visible", async () => {
    await write("/feed/", '<main><button id="li-compose">Start a post</button><article data-ff-hide id="li-feed">Feed</article></main>',
      [], focusCSS, 'Object.assign(document.documentElement.dataset, {ffSite:"li", ffPage:"feed", ffLiReady:""});');
    assert(visible($("#li-compose")) && !visible($("#li-feed")), "LinkedIn feed regression");
  });
  // Leave a representative Instagram search view visible for manual checks.
  await write("/explore/", shell + feed);
  document.getElementById("status").textContent = `${passed} passed, ${failed} failed`;
  document.documentElement.dataset.testResult = failed ? "fail" : "pass";
})();
