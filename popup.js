/**
 * Browser Manager - Popup controller
 * -----------------------------------------------------------------
 * - Restores UI state from chrome.storage.local and the live chrome.privacy /
 *   chrome.contentSettings values on open.
 * - Persists and applies each change immediately.
 * - Handles the Clear Cache action with loading + success states.
 *
 * Managed by IT Help Desk.
 */

/* ------------------------------------------------------------------ *
 * Defaults (kept in sync with background.js)
 * ------------------------------------------------------------------ */
const DEFAULT_SETTINGS = {
  clearOnStartup: false,
  tabHibernation: false,
  preloadPages: false,
  doNotTrack: false,
  blockThirdPartyCookies: false,
  webRTCProtection: false,
  lastCleared: null
};

/* ------------------------------------------------------------------ *
 * Administrator password required to change protected settings.
 * NOTE: Client-side extensions cannot truly hide a secret — a
 * determined user can read this value from the source. This gate is a
 * deterrent against casual/accidental changes, not a security boundary.
 * ------------------------------------------------------------------ */
const ADMIN_PASSWORD = "YOUR_PASSWORD_HERE";

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */
const $ = (id) => document.getElementById(id);

function sendMessage(message) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(response || { ok: false });
        }
      });
    } catch (e) {
      resolve({ ok: false, error: String(e) });
    }
  });
}

async function getStored() {
  try {
    const stored = await chrome.storage.local.get(DEFAULT_SETTINGS);
    return { ...DEFAULT_SETTINGS, ...stored };
  } catch (e) {
    return { ...DEFAULT_SETTINGS };
  }
}

async function saveSetting(key, value) {
  try {
    await chrome.storage.local.set({ [key]: value });
  } catch (e) {
    // console.debug("BM popup: saveSetting failed", e);
  }
}

function formatTimestamp(ts) {
  if (!ts) return "Never";
  try {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  } catch (e) {
    return "Never";
  }
}

/* ------------------------------------------------------------------ *
 * Read live Chrome privacy / content settings so toggles reflect the
 * actual browser state, not just what we stored.
 * ------------------------------------------------------------------ */
function getPref(pref) {
  return new Promise((resolve) => {
    try {
      pref.get({}, (details) => {
        if (chrome.runtime.lastError) resolve(null);
        else resolve(details ? details.value : null);
      });
    } catch (e) {
      resolve(null);
    }
  });
}

/* ------------------------------------------------------------------ *
 * Tab navigation
 * ------------------------------------------------------------------ */
function initTabs() {
  const tabs = document.querySelectorAll(".tab");
  const panels = document.querySelectorAll(".panel");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      tabs.forEach((t) => {
        const active = t === tab;
        t.classList.toggle("is-active", active);
        t.setAttribute("aria-selected", active ? "true" : "false");
      });
      panels.forEach((p) => {
        p.classList.toggle("is-active", p.dataset.panel === target);
      });
    });
  });
}

/* ------------------------------------------------------------------ *
 * Admin password modal
 * Returns a Promise that resolves true if the correct password was
 * entered, false if the user cancelled.
 * ------------------------------------------------------------------ */
function promptAdmin() {
  return new Promise((resolve) => {
    const modal = $("adminModal");
    const input = $("adminPassword");
    const error = $("adminError");
    const confirmBtn = $("adminConfirm");
    const cancelBtn = $("adminCancel");
    const backdrop = modal.querySelector(".modal__backdrop");

    // Reset state each time the modal opens.
    input.value = "";
    input.classList.remove("is-error");
    error.hidden = true;
    modal.hidden = false;
    setTimeout(() => input.focus(), 50);

    function cleanup(result) {
      modal.hidden = true;
      confirmBtn.removeEventListener("click", onConfirm);
      cancelBtn.removeEventListener("click", onCancel);
      backdrop.removeEventListener("click", onCancel);
      input.removeEventListener("keydown", onKey);
      resolve(result);
    }

    function onConfirm() {
      if (input.value === ADMIN_PASSWORD) {
        cleanup(true);
      } else {
        input.classList.add("is-error");
        error.hidden = false;
        input.value = "";
        input.focus();
      }
    }

    function onCancel() {
      cleanup(false);
    }

    function onKey(e) {
      if (e.key === "Enter") onConfirm();
      else if (e.key === "Escape") onCancel();
    }

    confirmBtn.addEventListener("click", onConfirm);
    cancelBtn.addEventListener("click", onCancel);
    backdrop.addEventListener("click", onCancel);
    input.addEventListener("keydown", onKey);
  });
}

/* ------------------------------------------------------------------ *
 * Admin Settings reveal (cog icon in header)
 * Keeps the popup clean by default: only the Cache view shows. Clicking
 * the cog prompts for the administrator password; only on success are the
 * Performance / Privacy / Settings tabs revealed.
 * ------------------------------------------------------------------ */
function initAdvanced() {
  const cog = $("advancedCog");
  const tabBar = $("tabBar");
  if (!cog || !tabBar) return;

  cog.addEventListener("click", async () => {
    // If already unlocked this session, just jump back to the tabs.
    if (!tabBar.classList.contains("is-hidden")) {
      const perfTab = document.querySelector('.tab[data-tab="performance"]');
      if (perfTab) perfTab.click();
      return;
    }

    const ok = await promptAdmin();
    if (!ok) return;

    tabBar.classList.remove("is-hidden");

    // Jump straight to the first admin tab (Performance).
    const perfTab = document.querySelector('.tab[data-tab="performance"]');
    if (perfTab) perfTab.click();
  });
}

/* ------------------------------------------------------------------ *
 * Clear Cache action
 * ------------------------------------------------------------------ */
function initClearCache() {
  const btn = $("clearCacheBtn");
  const success = $("clearSuccess");

  btn.addEventListener("click", async () => {
    btn.classList.add("is-loading");
    success.hidden = true;

    // Minimum visible spinner time for a polished feel.
    const [response] = await Promise.all([
      sendMessage({ type: "CLEAR_CACHE" }),
      new Promise((r) => setTimeout(r, 550))
    ]);

    btn.classList.remove("is-loading");

    if (response && response.ok) {
      success.hidden = false;
      $("lastCleared").textContent = formatTimestamp(response.lastCleared);
      setTimeout(() => {
        success.hidden = true;
      }, 2000);
    } else {
      // Surface a lightweight error inline via the success container.
      success.hidden = false;
      success.querySelector("span:last-child").textContent =
        "Could not clear cache. Contact IT Help Desk.";
      setTimeout(() => {
        success.hidden = true;
        success.querySelector("span:last-child").textContent =
          "Cache cleared successfully";
      }, 2500);
    }
  });
}

/* ------------------------------------------------------------------ *
 * Clear Cookies quick action (dropdown next to Clear Cache)
 * ------------------------------------------------------------------ */
function initClearCookies() {
  const toggle = $("clearMenuToggle");
  const menu = $("clearMenu");
  const cookiesBtn = $("clearCookiesBtn");
  const success = $("clearSuccess");
  if (!toggle || !menu || !cookiesBtn) return;

  function closeMenu() {
    menu.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
  }

  function openMenu() {
    menu.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
  }

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    if (menu.hidden) openMenu();
    else closeMenu();
  });

  // Close the menu when clicking anywhere else.
  document.addEventListener("click", (e) => {
    if (!menu.hidden && !menu.contains(e.target) && e.target !== toggle) {
      closeMenu();
    }
  });

  cookiesBtn.addEventListener("click", async () => {
    closeMenu();

    const [response] = await Promise.all([
      sendMessage({ type: "CLEAR_COOKIES" }),
      new Promise((r) => setTimeout(r, 300))
    ]);

    const label = success.querySelector("span:last-child");
    if (response && response.ok) {
      label.textContent = "Cookies cleared successfully";
    } else {
      label.textContent = "Could not clear cookies. Contact IT Help Desk.";
    }
    success.hidden = false;
    setTimeout(() => {
      success.hidden = true;
      label.textContent = "Cache cleared successfully";
    }, 2500);
  });
}

/* ------------------------------------------------------------------ *
 * Memory Saver: opens Chrome's built-in performance settings page.
 * (Chrome's built-in Memory Saver cannot be toggled via an extension API,
 * so we deep-link the user straight to the setting.)
 * ------------------------------------------------------------------ */
function initMemorySaver() {
  const btn = $("openMemorySaver");
  if (!btn) return;
  btn.addEventListener("click", () => {
    try {
      chrome.tabs.create({ url: "chrome://settings/performance" });
    } catch (e) {
      /* no-op */
    }
  });
}

/* ------------------------------------------------------------------ *
 * Toggle wiring
 * Each toggle: (1) restores state, (2) on change saves + applies.
 * ------------------------------------------------------------------ */
function bindToggle(id, onChange) {
  const el = $(id);
  if (!el) return;
  el.addEventListener("change", async () => {
    await onChange(el.checked);
  });
}

async function initToggles() {
  const stored = await getStored();

  /* ---- Performance ---- */
  // Tab Hibernation lives only in storage (driven by an alarm).
  setChecked("tabHibernation", stored.tabHibernation);

  // Preload Pages reflects live Chrome pref when available.
  const livePreload = await getPref(
    chrome.privacy.websites.networkPredictionEnabled
  );
  setChecked(
    "preloadPages",
    livePreload === null ? stored.preloadPages : livePreload
  );

  /* ---- Privacy ---- */
  const liveDnt = await getPref(chrome.privacy.websites.doNotTrackEnabled);
  setChecked("doNotTrack", liveDnt === null ? stored.doNotTrack : liveDnt);

  const liveThird = await getPref(
    chrome.privacy.websites.thirdPartyCookiesAllowed
  );
  // Toggle ON = block, so invert the "allowed" pref.
  setChecked(
    "blockThirdPartyCookies",
    liveThird === null ? stored.blockThirdPartyCookies : liveThird === false
  );

  const liveRtc = await getPref(chrome.privacy.network.webRTCIPHandlingPolicy);
  setChecked(
    "webRTCProtection",
    liveRtc === null
      ? stored.webRTCProtection
      : liveRtc === "disable_non_proxied_udp"
  );

  /* ---- Settings ---- */
  setChecked("clearOnStartup", stored.clearOnStartup);

  /* ---- Bindings ---- */
  bindToggle("tabHibernation", async (v) => {
    await saveSetting("tabHibernation", v);
    await sendMessage({ type: "SYNC_ALARMS" });
  });

  bindToggle("preloadPages", async (v) => {
    await saveSetting("preloadPages", v);
    await setPref(chrome.privacy.websites.networkPredictionEnabled, v);
  });

  bindToggle("doNotTrack", async (v) => {
    await saveSetting("doNotTrack", v);
    await setPref(chrome.privacy.websites.doNotTrackEnabled, v);
  });

  bindToggle("blockThirdPartyCookies", async (v) => {
    await saveSetting("blockThirdPartyCookies", v);
    // ON = block, so allowed = !v.
    await setPref(chrome.privacy.websites.thirdPartyCookiesAllowed, !v);
  });

  bindToggle("webRTCProtection", async (v) => {
    await saveSetting("webRTCProtection", v);
    await setPref(
      chrome.privacy.network.webRTCIPHandlingPolicy,
      v ? "disable_non_proxied_udp" : "default"
    );
  });

  // Auto-clear on startup is a plain toggle (this whole Settings tab is
  // already behind the admin-password gate on the cog).
  bindToggle("clearOnStartup", async (v) => {
    await saveSetting("clearOnStartup", v);
  });
}

function setChecked(id, value) {
  const el = $(id);
  if (el) el.checked = !!value;
}

/* ---- Chrome pref setters (promisified, with error handling) ---- */
function setPref(pref, value) {
  return new Promise((resolve) => {
    try {
      pref.set({ value }, () => {
        // Read lastError to avoid unchecked warnings.
        void chrome.runtime.lastError;
        resolve();
      });
    } catch (e) {
      resolve();
    }
  });
}

/* ------------------------------------------------------------------ *
 * Footer / misc
 * ------------------------------------------------------------------ */
function initFooter() {
  try {
    const manifest = chrome.runtime.getManifest();
    $("versionNumber").textContent = manifest.version;
  } catch (e) {
    /* leave default */
  }

  // Ensure the Help Desk link opens in a new tab reliably.
  const link = $("helpDeskLink");
  if (link) {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: link.href });
    });
  }
}

async function initLastCleared() {
  const stored = await getStored();
  $("lastCleared").textContent = formatTimestamp(stored.lastCleared);
}

/* ------------------------------------------------------------------ *
 * Boot
 * ------------------------------------------------------------------ */
document.addEventListener("DOMContentLoaded", async () => {
  initTabs();
  initAdvanced();
  initClearCache();
  initClearCookies();
  initMemorySaver();
  initFooter();
  await initLastCleared();
  await initToggles();
});
