# Resurrector (Redirector)

<p align="center">
  <img src="public/icons/resurrector_master_128.png" alt="Resurrector (Redirector)" width="128">
</p>

<p align="center">
  A lightweight Chrome extension for URL redirection.<br>
  Create custom redirect rules with wildcard and regex support.<br>
  The reincarnation of the original chrome redirector extension.
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/bkkbepmjgikohkenjolecnjfmhdfpgba"><strong>Install from Chrome Web Store →</strong></a>
</p>

---

## Features

- **Custom Redirect Rules** — Create your own From → To URL redirects
- **URL Auto-Prefix** — Enter `google.com` and it auto-corrects to `https://www.google.com`
- **Wildcard Support** — Use `*` as a wildcard in URL patterns
- **Regex Support** — Enable regex mode for advanced pattern matching (RE2 syntax)
- **RE2 Validation** — Detects unsupported regex features (lookaheads, lookbehinds) before saving
- **Cross-Device Sync** — Rules sync across Chrome instances via your Google account
- **Import/Export** — Backup and share your rules as JSON (compatible with Redirector extension)
- **Master Toggle** — Enable/disable all redirects with one click
- **Per-Rule Toggle** — Enable/disable individual rules
- **Lightweight** — Built for Chrome's MV3

---

## Installation

### Chrome Web Store (Recommended)

Install directly from the [Chrome Web Store](https://chromewebstore.google.com/detail/bkkbepmjgikohkenjolecnjfmhdfpgba).

1. Visit the [Resurrector Chrome Web Store page](https://chromewebstore.google.com/detail/bkkbepmjgikohkenjolecnjfmhdfpgba)
2. Click **Add to Chrome**
3. Confirm by clicking **Add extension**

---

## Usage

### Opening the Extension

Click the Resurrector icon in your Chrome toolbar to open the popup.

### Interface Overview

| Element | Description |
|---------|-------------|
| **Header Icon** | Resurrector logo |
| **Master Toggle** | Enable/disable ALL redirect rules at once |
| **Add New Rule** | Form to create a new redirect rule |
| **Redirect Rules** | List of all your saved rules |
| **Export/Import** | Backup or restore your rules |

---

## Creating Redirect Rules

### Basic Wildcard Rule

Use wildcards (`*`) for simple URL matching. URLs entered without `https://www.` are auto-prefixed.

**Example: Redirect old domain to new**

| Field | Value |
|-------|-------|
| Name | `Old to New Site` |
| From URL | `https://old-site.com/*` |
| To URL | `https://new-site.com/` |
| Use Regex | ☐ Unchecked |

**Result:** Any page on `old-site.com` redirects to `new-site.com`

---

### Regex Rule (Advanced)

Enable **Use Regular Expression** for pattern matching with capture groups.

**Example: Preserve path when redirecting**

| Field | Value |
|-------|-------|
| Name | `API v1 to v2` |
| From URL | `^https://api\.example\.com/v1/(.*)$` |
| To URL | `https://api.example.com/v2/\1` |
| Use Regex | ☑ Checked |

**Result:** 
- `api.example.com/v1/users` → `api.example.com/v2/users`
- `api.example.com/v1/products/123` → `api.example.com/v2/products/123`

---

## Regex Pattern Reference

Chrome uses the **RE2** regex engine, which does **not** support lookaheads, lookbehinds, or word boundaries. Use the **Golang** flavor on [regex101.com](https://regex101.com/) for compatible testing.

| Pattern | Meaning | Example |
|---------|---------|---------|
| `^` | Start of URL | `^https://` |
| `$` | End of URL | `\.html$` |
| `.*` | Any characters | `https://(.*)` |
| `\.` | Literal dot | `example\.com` |
| `\d+` | One or more digits | `/page/(\d+)` |
| `\1`, `\2` | Capture group reference | `https://new.com/\1` |
| `[^/]+` | Any chars except `/` | `/user/([^/]+)/` |

### Unsupported in RE2

| Feature | Syntax | Status |
|---------|--------|--------|
| Positive lookahead | `(?=...)` | Not supported |
| Negative lookahead | `(?!...)` | Not supported |
| Positive lookbehind | `(?<=...)` | Not supported |
| Negative lookbehind | `(?<!...)` | Not supported |
| Word boundary | `\b`, `\B` | Not supported |

### Common Regex Examples

**HTTP to HTTPS:**
```
From: ^http://(.*)$
To:   https://\1
```

**Add www:**
```
From: ^https://example\.com/(.*)$
To:   https://www.example.com/\1
```

**Remove trailing slash:**
```
From: ^(https?://[^?]+)/(\?.*)?$
To:   \1\2
```

**Swap subdomains:**
```
From: ^https://blog\.example\.com/(.*)$
To:   https://news.example.com/\1
```

---

## Managing Rules

### Toggle Individual Rules

Click the checkbox next to any rule to enable/disable it without deleting.

### Edit a Rule

Click the **Edit** button on any rule to load it into the form for modification.

### Delete a Rule

Click the **Delete** button and confirm to remove a rule permanently.

---

## Import & Export

### Export Your Rules

1. Click the **Export** button
2. A JSON file downloads automatically
3. Save this file as a backup

### Import Rules

1. Click the **Import** button
2. Select a JSON file (Resurrector format or Redirector format)
3. Rules are added to your existing list

**Supported formats:**
- **Resurrector format** — Native JSON array
- **Redirector format** — Exported from the original Redirector extension

---

## Extension States

### Enabled (Active)

When the master toggle is ON, the icon appears normally and redirects are active.

<p align="center">
  <img src="public/icons/resurrector_master_128.png" alt="Enabled" width="64">
</p>

### Disabled (Inactive)

When the master toggle is OFF, the icon displays an **"OFF" badge** and no redirects occur.

---

## Development

For contributors who want to build from source:

```bash
# Clone the repository
git clone https://github.com/toddalex/resurrector.git
cd resurrector

# Install dependencies
npm install

# Build once
npm run build

# Watch mode (rebuild on changes)
npm run watch
```

### Project Structure

```
resurrector/
├── manifest.json           # Extension manifest (MV3)
├── src/
│   ├── background/         # Service worker
│   │   └── index.js
│   ├── options/            # Popup UI logic
│   │   └── index.js
│   └── shared/             # Shared utilities
│       └── storage.js
├── public/
│   ├── options.html        # Popup HTML
│   ├── styles/
│   │   └── options.css     # Styles
│   └── icons/              # Extension icons
└── dist/                   # Built extension
```

---

## Technical Details

- **Manifest Version:** 3 (MV3)
- **API:** `declarativeNetRequest` (not deprecated `webRequest`)
- **Regex Engine:** RE2 (no lookaheads/lookbehinds)
- **Storage:** `chrome.storage.sync` (cross-device), `chrome.storage.local` (per-device preferences)
- **Max Rules:** 5,000 dynamic rules
- **Max Regex Rules:** 1,000

---

## Migrating from Redirector

If you're coming from the original Redirector extension:

1. Open Redirector and export your rules (Settings → Export)
2. Open Resurrector and click **Import**
3. Select your Redirector JSON file
4. All rules are automatically converted and imported

---

## Troubleshooting

### Rules not working?

1. Check the **master toggle** is ON (no "OFF" badge on icon)
2. Check the **individual rule toggle** is checked
3. Verify your URL pattern matches the actual URL
4. For regex rules, test your pattern at [regex101.com](https://regex101.com/) (select **Golang** flavor for RE2 compatibility)

### Regex not working?

- Chrome uses **RE2**, not JavaScript/PCRE regex
- Lookaheads (`(?=...)`, `(?!...)`), lookbehinds, and word boundaries are **not supported**
- The extension will alert you if you try to save an unsupported pattern

### Import failed?

- Ensure the file is valid JSON
- Check the file contains either an array of rules or a Redirector export object

### Extension not loading?

- Try removing and reinstalling from the [Chrome Web Store](https://chromewebstore.google.com/detail/bkkbepmjgikohkenjolecnjfmhdfpgba)
- Check for errors in `chrome://extensions/`
- Ensure Chrome is up to date

---

## License

MIT

---

<p align="center">
  <img src="public/icons/resurrector_master_48.png" alt="Resurrector" width="24">
  <br>
  Made with care for developers who need reliable URL redirection.
</p>
