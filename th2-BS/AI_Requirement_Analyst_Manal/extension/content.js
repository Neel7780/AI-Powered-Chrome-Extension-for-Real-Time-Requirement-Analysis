(() => {
  let previous = "";
  const selectors = [
    '[aria-label*="transcript" i]',
    '[aria-label*="caption" i]',
    '[class*="transcript" i]',
    '[class*="caption" i]'
  ];

  function readMeetingText() {
    const fragments = [];
    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach(node => {
        const value = (node.innerText || node.textContent || "").trim();
        if (value) fragments.push(value);
      });
    }
    const merged = [...new Set(fragments)].join("\n").trim();
    if (merged && merged !== previous) {
      previous = merged;
      window.__REQUIREMENT_LENS_TRANSCRIPT__ = merged;
    }
  }

  new MutationObserver(readMeetingText).observe(document.documentElement, {
    childList: true, subtree: true, characterData: true
  });
  readMeetingText();
})();
