/**
 * MCK Browser Manager - Options page controller.
 * Mirrors the "Auto-clear cache on startup" setting from the popup.
 * Changing it requires the administrator password.
 * Managed by McKinney IT Help Desk.
 */

const DEFAULT_CLEAR_ON_STARTUP = true;

/* Administrator password required to change protected settings.
 * NOTE: Client-side extensions cannot truly hide a secret — this gate is a
 * deterrent against casual/accidental changes, not a security boundary. */
const ADMIN_PASSWORD = "YOUR_PASSWORD_HERE";

/* ------------------------------------------------------------------ *
 * Admin password modal. Resolves true on correct password, false on cancel.
 * ------------------------------------------------------------------ */
function promptAdmin() {
  return new Promise((resolve) => {
    const modal = document.getElementById("adminModal");
    const input = document.getElementById("adminPassword");
    const error = document.getElementById("adminError");
    const confirmBtn = document.getElementById("adminConfirm");
    const cancelBtn = document.getElementById("adminCancel");
    const backdrop = modal.querySelector(".modal__backdrop");

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

document.addEventListener("DOMContentLoaded", async () => {
  const toggle = document.getElementById("clearOnStartup");
  const versionEl = document.getElementById("versionNumber");

  // Show extension version.
  try {
    versionEl.textContent = chrome.runtime.getManifest().version;
  } catch (e) {
    /* leave default */
  }

  // Restore stored value.
  try {
    const { clearOnStartup } = await chrome.storage.local.get({
      clearOnStartup: DEFAULT_CLEAR_ON_STARTUP
    });
    toggle.checked = !!clearOnStartup;
  } catch (e) {
    toggle.checked = DEFAULT_CLEAR_ON_STARTUP;
  }

  // Changing this setting requires the admin password. We listen on "change"
  // (reliable across label/checkbox interactions) with a re-entrancy guard,
  // prompt for the password, and only commit if authorized. Reverting via
  // `.checked = ...` does not re-fire "change", so there is no loop.
  let gateBusy = false;
  toggle.addEventListener("change", async () => {
    if (gateBusy) return;
    const desired = toggle.checked;
    const previous = !desired;

    gateBusy = true;
    const ok = await promptAdmin();
    gateBusy = false;

    if (ok) {
      try {
        await chrome.storage.local.set({ clearOnStartup: desired });
      } catch (err) {
        // console.debug("MCK options: save failed", err);
      }
    } else {
      toggle.checked = previous;
    }
  });
});
