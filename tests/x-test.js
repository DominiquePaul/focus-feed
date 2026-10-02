(async () => {
  "use strict";
  // Only shorten the timer. Run the unmodified content script at top level.
  FF.UNLOCK_SECONDS = 0;
  const script = document.createElement("script");
  script.src = "/focus.js";
  const loaded = new Promise((resolve) => script.onload = resolve);
  document.head.append(script);
  await loaded;
  const result = document.getElementById("result");
  const feed = document.getElementById("feed");
  const hidden = () => getComputedStyle(feed).display === "none";
  const assert = (value, message) => { if (!value) throw new Error(message); };
  try {
    assert(hidden(), "Home feed must start hidden");
    assert(getComputedStyle(document.getElementById("compose")).display !== "none", "Composer is hidden");
    const shadow = document.querySelector("focus-feed-ui").shadowRoot;
    shadow.querySelector('[data-action="start"]').click();
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert(!hidden() && window.testData["unlocked-x"], "Unlock failed");
    shadow.querySelector('[data-action="relock"]').click();
    assert(hidden() && window.testData["unlocked-x"] === false, "Relock failed");
    result.textContent = "PASS: X starts hidden, keeps its composer, unlocks and relocks.";
    document.documentElement.dataset.testResult = "pass";
  } catch (error) {
    result.textContent = `FAIL: ${error.message}`;
    document.documentElement.dataset.testResult = "fail";
  }
})();
