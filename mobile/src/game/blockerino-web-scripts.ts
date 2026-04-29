const BLOCKERINO_VIEWPORT_IIFE = `
(function () {
  var head = document.head || document.getElementsByTagName('head')[0] || document.documentElement;
  var meta = document.querySelector('meta[name="viewport"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'viewport');
    head.appendChild(meta);
  }

  meta.setAttribute(
    'content',
    'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
  );

  if (!document.getElementById('blockerino-mobile-fit')) {
    var style = document.createElement('style');
    style.id = 'blockerino-mobile-fit';
    style.textContent = [
      'html,body,#root{width:100%;height:100%;min-height:100%;margin:0;overflow:hidden;background:#000;}',
      'body{overscroll-behavior:none;position:fixed;inset:0;}',
      '#root{position:fixed;inset:0;}',
      '*{-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;}'
    ].join('');
    head.appendChild(style);
  }
})();
`;

const BLOCKERINO_READY_IIFE = `
(function () {
  var hasPostedReady = false;

  function postReady() {
    if (hasPostedReady) return;
    hasPostedReady = true;

    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
      type: "BLOCKERINO_READY"
    }));
  }

  function hasRenderedGame() {
    var root = document.getElementById("root");
    if (!root) return false;

    var rect = root.getBoundingClientRect();
    if (!rect || rect.width < 20 || rect.height < 20) return false;

    var text = (root.textContent || "").replace(/\\s+/g, "");
    var interactiveElement = root.querySelector("button,[role='button'],canvas,svg");
    return text.length > 0 || Boolean(interactiveElement);
  }

  function checkReady() {
    if (hasRenderedGame()) {
      postReady();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(checkReady, 250);
    });
  } else {
    setTimeout(checkReady, 250);
  }

  window.addEventListener("load", function () {
    setTimeout(checkReady, 250);
  });

  setTimeout(checkReady, 1000);
  setTimeout(checkReady, 2500);
})();
`;

export const BLOCKERINO_VIEWPORT_SCRIPT = `
${BLOCKERINO_VIEWPORT_IIFE}
true;
`;

export const BLOCKERINO_READY_BRIDGE_SCRIPT = `
${BLOCKERINO_VIEWPORT_IIFE}
${BLOCKERINO_READY_IIFE}
true;
`;

export const BLOCKERINO_SCORE_BRIDGE_SCRIPT = `
${BLOCKERINO_VIEWPORT_IIFE}
${BLOCKERINO_READY_IIFE}
(function () {
  var lastPayload = "";

  function readScores() {
    try {
      var rawIds = window.localStorage && window.localStorage.getItem("HIGH_SCORES");
      var ids = rawIds ? JSON.parse(rawIds) : [];
      if (!Array.isArray(ids)) return [];

      return ids.map(function (id) {
        try {
          var rawScore = window.localStorage.getItem(String(id));
          if (!rawScore) return null;

          var parsed = JSON.parse(rawScore);
          var score = Number(parsed.score);
          if (!isFinite(score) || score <= 0) return null;
          var mode = typeof parsed.type === "string" ? parsed.type : "classic";
          if (mode !== "classic") return null;

          return {
            score: Math.floor(score),
            mode: "classic",
            date: Number(parsed.date) || Date.now()
          };
        } catch (error) {
          return null;
        }
      }).filter(Boolean);
    } catch (error) {
      return [];
    }
  }

  setInterval(function () {
    var scores = readScores();
    if (!scores.length) return;

    scores.sort(function (a, b) {
      return b.score - a.score || b.date - a.date;
    });

    var best = scores[0];
    var payload = JSON.stringify({
      type: "BLOCKERINO_SCORE",
      score: best.score,
      mode: best.mode,
      date: best.date
    });

    if (payload !== lastPayload) {
      lastPayload = payload;
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(payload);
    }
  }, 2500);
})();
true;
`;
