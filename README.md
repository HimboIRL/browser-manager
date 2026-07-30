# Browser Manager

A Chrome extension (Manifest V3) providing one-click cache clearing plus
optional performance and privacy controls, all behind a simple admin gate.

## Features

- **Cache** — One-click **Clear Cache** with loading/success states and a
  "last cleared" timestamp. A dropdown next to the button adds a one-click
  **Clear Cookies** action.
- **Performance** — **Memory Saver** (opens Chrome's built-in Memory Saver
  settings), **Tab Hibernation**, and **Preload Pages**.
- **Privacy** — **Do Not Track**, **Block 3rd Party Cookies**, and
  **WebRTC Protection**.
- **Settings** — **Auto-clear cache on startup**.
- The advanced tabs (Performance / Privacy / Settings) are revealed by the
  gear icon and protected by an administrator password.
- **All settings are OFF by default.** Stored settings are re-applied by the
  background service worker on every browser launch.

## Project structure

```
browser-manager/
├── manifest.json         # MV3 manifest
├── background.js         # Service worker (startup logic, alarms, cache/cookies)
├── popup.html            # Popup UI (Cache + gated advanced tabs)
├── popup.css             # Styles (neutral slate palette)
├── popup.js              # Popup logic (load/save/apply settings)
├── options.html          # Standalone settings page
├── options.js            # Options page logic
├── assets/
│   └── logo.png          # App logo
├── icons/                # 16/32/48/128 px extension icons
├── DEPLOYMENT_GUIDE.md   # Full deployment instructions
└── package-for-deployment.sh
```

## Permissions

`browsingData`, `storage`, `tabs`, `privacy`, `contentSettings`, `alarms`

## Install (unpacked, for testing)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** and select this folder.

See [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) for Chrome Web Store publishing
and managed (Google Admin) rollout.

## Setting the administrator password

The gear icon and the advanced tabs are protected by an administrator password.
**Before deploying**, set your own password in both files:

1. **`popup.js`** — `const ADMIN_PASSWORD = "YOUR_PASSWORD_HERE";`
2. **`options.js`** — `const ADMIN_PASSWORD = "YOUR_PASSWORD_HERE";`

Replace `"YOUR_PASSWORD_HERE"` with your chosen password in both files.

> **Security note:** This is a client-side deterrent against accidental changes,
> not a true security boundary — a determined user can read the password from
> the source. For enforced policies, use Chrome Enterprise controls via Google
> Admin.

## Customizing the "Managed by" footer

The footer at the bottom of the popup and options page reads
**"Managed by IT Help Desk"** and links to a support URL. To change the label
and/or the link, edit the same block in **two** files:

**`popup.html`** (around line 255) and **`options.html`** (around line 85):

```html
<span class="footer__managed">
  Managed by
  <a
    id="helpDeskLink"                         <!-- present in popup.html only -->
    href="https://support.example.com"        <!-- change the link here -->
    target="_blank"
    rel="noopener noreferrer"
    >IT Help Desk</a                           <!-- change the label text here -->
  >
</span>
```

- **Change the text:** replace `IT Help Desk` with your own label.
- **Change the link:** replace `https://support.example.com` with your URL.
- To change the word **"Managed by"** itself, edit the text just before the
  `<a>` tag.
- To remove the footer entirely, delete the whole
  `<footer class="footer"> … </footer>` block in both files.

> Make the same edit in both `popup.html` and `options.html` so the footer stays
> consistent everywhere.

## Development notes

- No third-party libraries and no emojis — all iconography is inline SVG.
- All Chrome API calls are wrapped in error handling.
- Neutral palette: primary `#4B6584` (slate blue-gray), accent `#2D3E50`,
  text `#2D2D2D`. Adjust the CSS variables at the top of `popup.css` to
  re-theme.
