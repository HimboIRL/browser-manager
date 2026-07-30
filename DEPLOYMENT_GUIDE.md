# Browser Manager — Deployment Guide

This guide explains how to install and deploy the **Browser Manager** Chrome
extension — locally for testing, via the Chrome Web Store, or across an
organization with the Google Admin Console.

---

## Prerequisites

- **Chrome 110+** (the extension targets Manifest V3).
- For Web Store publishing: a **Chrome Web Store developer account**
  ($5 one-time registration fee).
- For managed rollout: **Google Workspace admin access** with permission to
  manage Chrome apps & extensions.

---

## 1. Configure the admin password

The advanced settings (Performance / Privacy / Settings tabs) are protected by
a simple password gate. Before packaging, set your own password:

- `popup.js` — `const ADMIN_PASSWORD = "YOUR_PASSWORD_HERE";`
- `options.js` — `const ADMIN_PASSWORD = "YOUR_PASSWORD_HERE";`

> **Note:** A client-side extension cannot truly hide a secret — a determined
> user can read this value in the source. The gate is a deterrent against
> casual/accidental changes, not a security boundary. For hard enforcement,
> use Chrome Enterprise policies via the Admin Console.

---

## 2. Load locally for testing (unpacked)

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select this project folder.
4. The extension appears in your toolbar. Pin it for quick access.

This is the fastest way to try changes — no packaging or signing required.

---

## 3. Package the extension

Create a `.zip` of the extension's **contents** (not the parent folder):

```bash
# From the project directory
zip -r browser-manager.zip \
  manifest.json background.js \
  popup.html popup.css popup.js \
  options.html options.js \
  assets/ icons/ \
  -x "*.DS_Store" "*/.git/*"
```

> When you unzip the archive, `manifest.json` must sit at the root — not inside
> a nested folder.

A helper script, `package-for-deployment.sh`, is included and produces the same
archive automatically.

---

## 4. Publish to the Chrome Web Store (recommended)

1. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Sign in and pay the one-time $5 registration fee if you haven't already.
3. Click **New Item** and upload `browser-manager.zip`.
4. Fill in the store listing:
   - **Name:** Browser Manager
   - **Summary:** One-click cache clearing plus performance and privacy controls.
   - **Category:** Productivity
   - **Screenshots:** at least one (1280×800 or 640×400).
5. Under **Privacy**, justify each permission:
   - `browsingData` — clear cache and cookies
   - `storage` — persist settings
   - `tabs` — Tab Hibernation and quick actions
   - `privacy` — Do Not Track and WebRTC settings
   - `contentSettings` — block third-party cookies
   - `alarms` — schedule automated tab management
6. Choose a **visibility** level:
   - **Unlisted** — installable only via a direct link (not searchable).
   - **Private** — restricted to a specific Google Workspace domain.
   - **Public** — listed publicly (only if you intend a general release).
7. Click **Submit for Review**. Review usually takes 1–3 business days. Once
   approved, note the **Extension ID**.

---

## 5. Managed rollout via Google Admin Console (optional)

Once the item is live in the Web Store:

1. Sign in to [admin.google.com](https://admin.google.com).
2. Go to **Devices → Chrome → Apps & extensions**.
3. Click **Add Chrome app or extension**, paste the **Extension ID**, and select it.
4. Choose the target **organizational unit** (all users or specific groups).
5. Set the **installation policy**:
   - **Force install** — installs automatically; users cannot remove it.
   - **Allow install** — users may add it themselves.
6. (Optional) Set **Toolbar pin → Force pinned** so the icon is always visible.
7. Click **Save**. Policy changes can take up to 24 hours to propagate; users can
   speed this up via `chrome://policy` → **Reload policies**.

---

## 6. Self-hosted deployment (advanced)

If you prefer not to use the Web Store:

1. Pack a signed `.crx` via `chrome://extensions` → **Pack extension**.
2. Host the `.crx` and an `update.xml` manifest on an HTTPS server:

   ```xml
   <?xml version='1.0' encoding='UTF-8'?>
   <gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
     <app appid='YOUR_EXTENSION_ID'>
       <updatecheck codebase='https://your-host.example/browser-manager.crx' version='1.0.0' />
     </app>
   </gupdate>
   ```

3. In the Admin Console, add a **custom app** using the update URL and set the
   installation policy to **Force install**.

Trade-offs: no Web Store account needed, but you manage updates and hosting
yourself, and Google does not scan the package.

---

## 7. Updating

1. Make your changes and bump `version` in `manifest.json` (e.g. `1.0.0 → 1.0.1`).
2. Re-package the `.zip` (or rebuild the `.crx`).
3. **Web Store:** upload the new package to the same listing and submit for
   review — updates roll out automatically once approved.
   **Self-hosted:** update `update.xml` with the new version and `.crx` URL;
   Chrome checks periodically and updates on its own.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Extension not installing (managed) | Confirm the user is in the target OU and the policy is **Force install**; reload policies at `chrome://policy`. |
| Users can remove the extension | Use **Force install** rather than **Allow install**. |
| Settings not persisting | Settings use `chrome.storage.local`, tied to the Chrome profile. Guest/temporary profiles won't retain them. |
| Admin password visible in source | Expected for client-side extensions. Use Chrome Enterprise policies for hard enforcement. |

---

## Additional resources

- [Chrome Web Store developer docs](https://developer.chrome.com/docs/webstore/)
- [Chrome Enterprise policy list](https://chromeenterprise.google/policies/)
- [Manage Chrome apps (Google Workspace admin)](https://support.google.com/chrome/a/answer/2657289)
