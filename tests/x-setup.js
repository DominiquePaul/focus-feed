// A top-level page is required: focus.js intentionally skips cards in frames.
history.replaceState(null, "", "/home");
window.testData = {};
window.chrome = {
  runtime: { getURL: (path) => `/${path}` },
  storage: {
    local: {
      get: (keys, callback) => callback(window.testData),
      set: (items) => Object.assign(window.testData, items),
    },
    onChanged: { addListener() {} },
  },
};
