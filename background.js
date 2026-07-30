/**
 * Browser Manager - Background Service Worker (Manifest V3)
 * -----------------------------------------------------------------
 * Responsibilities:
 *   1. Apply managed defaults on install.
 *   2. On Chrome startup, clear cache if `clearOnStartup` is enabled and
 *      re-apply all stored privacy / performance settings.
 *   3. Run a periodic alarm for Tab Hibernation.
 *
 * Managed by IT Help Desk.
 */

/* ------------------------------------------------------------------ *
 * Default settings (everything OFF by default).
 * ------------------------------------------------------------------ */
const DEFAULT_SETTINGS = {
  clearOnStartup: false, // Auto-clear cache on Chrome startup.
  tabHibernation: false, // Discard tabs inactive > HIBERNATION_MINUTES.
  preloadPages: false, // chrome.privacy.websites.networkPredictionEnabled.
  doNotTrack: false, // chrome.privacy.websites.doNotTrackEnabled.
  blockThirdPartyCookies: false, // chrome.privacy.websites.thirdPartyCookiesAllowed (false = block).
  webRTCProtection: false, // chrome.privacy.network.webRTCIPHandlingPolicy.
  lastCleared: null // Timestamp of last successful cache clear.
};

const HIBERNATION_MINUTES = 60; // Tabs inactive longer than this are hibernated.

const HIBERNATION_ALARM = "bm-tab-hibernation";

/* Tracks the last time each tab was activated (in-memory, best effort). */
const tabLastActive = {};

/* ------------------------------------------------------------------ *
 * Storage helpers
 * ------------------------------------------------------------------ */
async function getSettings() {
  try {
    const stored = await chrome.storage.local.get(DEFAULT_SETTINGS);
    return { ...DEFAULT_SETTINGS, ...stored };
  } catch (e) {
    // console.debug("BM: getSettings failed", e);
    return { ...DEFAULT_SETTINGS };
  }
}

async function setSetting(key, value) {
  try {
    await chrome.storage.local.set({ [key]: value });
  } catch (e) {
    // console.debug("BM: setSetting failed", e);
  }
}

/* ------------------------------------------------------------------ *
 * Cache clearing
 * ------------------------------------------------------------------ */
async function clearCache() {
  try {
    await chrome.browsingData.removeCache({ since: 0 });
    await setSetting("lastCleared", Date.now());
    return true;
  } catch (e) {
    // console.debug("BM: clearCache failed", e);
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * Cookie clearing (triggered from the popup's quick-action menu)
 * ------------------------------------------------------------------ */
async function clearCookies() {
  try {
    await chrome.browsingData.removeCookies({ since: 0 });
    return true;
  } catch (e) {
    // console.debug("BM: clearCookies failed", e);
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * Privacy / performance appliers
 * Each wraps a Chrome API call in try/catch so one failure can't break
 * the rest of the startup sequence.
 * ------------------------------------------------------------------ */
async function applyPreloadPages(enabled) {
  try {
    await chrome.privacy.websites.networkPredictionEnabled.set({
      value: !!enabled
    });
  } catch (e) {
    // console.debug("BM: applyPreloadPages failed", e);
  }
}

async function applyDoNotTrack(enabled) {
  try {
    await chrome.privacy.websites.doNotTrackEnabled.set({ value: !!enabled });
  } catch (e) {
    // console.debug("BM: applyDoNotTrack failed", e);
  }
}

async function applyThirdPartyCookies(block) {
  try {
    // `thirdPartyCookiesAllowed = false` blocks third-party cookies.
    await chrome.privacy.websites.thirdPartyCookiesAllowed.set({
      value: !block
    });
  } catch (e) {
    // console.debug("BM: applyThirdPartyCookies failed", e);
  }
}

async function applyWebRTCProtection(enabled) {
  try {
    await chrome.privacy.network.webRTCIPHandlingPolicy.set({
      value: enabled ? "disable_non_proxied_udp" : "default"
    });
  } catch (e) {
    // console.debug("BM: applyWebRTCProtection failed", e);
  }
}

/**
 * Re-apply every stored privacy/performance setting. Called on startup and
 * on install so the managed configuration survives browser restarts.
 */
async function applyAllSettings(settings) {
  const s = settings || (await getSettings());
  await applyPreloadPages(s.preloadPages);
  await applyDoNotTrack(s.doNotTrack);
  await applyThirdPartyCookies(s.blockThirdPartyCookies);
  await applyWebRTCProtection(s.webRTCProtection);
  await syncAlarms(s);
}

/* ------------------------------------------------------------------ *
 * Alarm for Tab Hibernation
 * ------------------------------------------------------------------ */
async function syncAlarms(settings) {
  const s = settings || (await getSettings());
  try {
    if (s.tabHibernation) {
      await chrome.alarms.create(HIBERNATION_ALARM, { periodInMinutes: 10 });
    } else {
      await chrome.alarms.clear(HIBERNATION_ALARM);
    }
  } catch (e) {
    // console.debug("BM: syncAlarms failed", e);
  }
}

/**
 * Discard tabs that have been inactive longer than `thresholdMinutes`.
 * Skips the active tab, audible tabs, pinned tabs, and already-discarded tabs.
 */
async function discardInactiveTabs(thresholdMinutes) {
  const now = Date.now();
  const thresholdMs = thresholdMinutes * 60 * 1000;
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (
        tab.active ||
        tab.audible ||
        tab.pinned ||
        tab.discarded ||
        typeof tab.id !== "number"
      ) {
        continue;
      }
      const lastActive = tabLastActive[tab.id] || now;
      if (now - lastActive >= thresholdMs) {
        try {
          await chrome.tabs.discard(tab.id);
        } catch (inner) {
          // console.debug("BM: discard failed for tab", tab.id, inner);
        }
      }
    }
  } catch (e) {
    // console.debug("BM: discardInactiveTabs failed", e);
  }
}

/* ------------------------------------------------------------------ *
 * Event listeners
 * ------------------------------------------------------------------ */

// Seed defaults on first install / upgrade, then apply managed settings.
chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(null);
  const merged = { ...DEFAULT_SETTINGS, ...current };
  await chrome.storage.local.set(merged);
  await applyAllSettings(merged);
});

// On Chrome startup: clear cache (if enabled) and re-apply all settings.
chrome.runtime.onStartup.addListener(async () => {
  const settings = await getSettings();
  if (settings.clearOnStartup) {
    await clearCache();
  }
  await applyAllSettings(settings);
});

// Track tab activity for Memory Saver / Hibernation.
chrome.tabs.onActivated.addListener((info) => {
  tabLastActive[info.tabId] = Date.now();
});
chrome.tabs.onUpdated.addListener((tabId) => {
  tabLastActive[tabId] = Date.now();
});
chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabLastActive[tabId];
});

// Alarm handler for Tab Hibernation sweeps.
chrome.alarms.onAlarm.addListener(async (alarm) => {
  const settings = await getSettings();
  if (alarm.name === HIBERNATION_ALARM && settings.tabHibernation) {
    await discardInactiveTabs(HIBERNATION_MINUTES);
  }
});

/* ------------------------------------------------------------------ *
 * Message bridge (used by popup for actions that benefit from the
 * service worker context, e.g. clearing cache and syncing alarms).
 * ------------------------------------------------------------------ */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      switch (message?.type) {
        case "CLEAR_CACHE": {
          const ok = await clearCache();
          const { lastCleared } = await chrome.storage.local.get("lastCleared");
          sendResponse({ ok, lastCleared });
          break;
        }
        case "CLEAR_COOKIES": {
          const ok = await clearCookies();
          sendResponse({ ok });
          break;
        }
        case "SYNC_ALARMS": {
          await syncAlarms();
          sendResponse({ ok: true });
          break;
        }
        case "APPLY_ALL": {
          await applyAllSettings();
          sendResponse({ ok: true });
          break;
        }
        default:
          sendResponse({ ok: false, error: "Unknown message type" });
      }
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  })();
  return true; // Keep the message channel open for the async response.
});
