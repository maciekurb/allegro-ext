// Initialize sensible defaults at install/update
chrome.runtime.onInstalled.addListener(async () => {
  const defaults = {
    enabled: true,
    minRating: 4.9,
    minOpinions: 100,
    autoPagination: false,
    maxPages: 100
  };
  const current = await chrome.storage.sync.get(Object.keys(defaults));
  const toSet = {};
  for (const k of Object.keys(defaults)) {
    if (current[k] === undefined) toSet[k] = defaults[k];
  }
  if (Object.keys(toSet).length) {
    await chrome.storage.sync.set(toSet);
  }
});

// Optional: badge shows ON/OFF
async function updateBadge(tabId) {
  try {
    const { enabled } = await chrome.storage.sync.get("enabled");
    chrome.action.setBadgeText({ tabId, text: enabled ? "ON" : "OFF" });
  } catch {}
}
chrome.tabs.onActivated.addListener(({ tabId }) => updateBadge(tabId));
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === "complete") updateBadge(tabId);
});

// Toggle from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "SET_ENABLED") {
    chrome.storage.sync.set({ enabled: !!msg.enabled }).then(() => sendResponse({ ok: true }));
    return true;
  }
});
