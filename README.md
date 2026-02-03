# Resurrector (Redirector)

<p align="center">
  <img src="public/images/resurrector_wordmark.png" alt="Resurrector (Redirector)" width="400">
</p>

<p align="center">
  A lightweight Chrome extension for URL redirection.<br>
  Create custom redirect rules with wildcard and regex support.
</p>

---

## Features

- **Custom Redirect Rules** — Create your own From → To URL redirects
- **Wildcard Support** — Use `*` as a wildcard in URL patterns
- **Regex Support** — Enable regex mode for advanced pattern matching (RE2 syntax)
- **Import/Export** — Backup and share your rules as JSON (compatible with Redirector extension)
- **Master Toggle** — Enable/disable all redirects with one click
- **Per-Rule Toggle** — Enable/disable individual rules
- **Lightweight** — Built for Chrome's MV3, ~14KB total bundle size

---

## Installation

### From Source

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/resurrector.git
   cd resurrector
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable **Developer mode** (top right toggle)
   - Click **Load unpacked**
   - Select the `dist` folder

<!-- Screenshot: Chrome extensions page with Load unpacked highlighted -->
<!-- ![Installation](docs/screenshots/installation.png) -->

---

## Usage

### Opening the Extension

Click the Resurrector icon in your Chrome toolbar to open the popup.

<!-- Screenshot: Extension icon in toolbar -->
<!-- ![Toolbar Icon](docs/screenshots/toolbar-icon.png) -->

### Interface Overview

<!-- Screenshot: Full popup interface with annotations -->
<!-- ![Interface Overview](docs/screenshots/interface-overview.png) -->

| Element | Description |
|---------|-------------|
| **Header** | Resurrector wordmark logo |
| **Master Toggle** | Enable/disable ALL redirect rules at once |
| **Add New Rule** | Form to create a new redirect rule |
| **Redirect Rules** | List of all your saved rules |
| **Export/Import** | Backup or restore your rules |

---

## Creating Redirect Rules

### Basic Wildcard Rule

Use wildcards (`*`) for simple URL matching.

<!-- Screenshot: Add rule form filled out with wildcard example -->
<!-- ![Wildcard Rule](docs/screenshots/wildcard-rule.png) -->

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

<!-- Screenshot: Add rule form with regex checkbox enabled -->
<!-- ![Regex Rule](docs/screenshots/regex-rule.png) -->

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

| Pattern | Meaning | Example |
|---------|---------|---------|
| `^` | Start of URL | `^https://` |
| `$` | End of URL | `\.html$` |
| `.*` | Any characters | `https://(.*)` |
| `\.` | Literal dot | `example\.com` |
| `\d+` | One or more digits | `/page/(\d+)` |
| `\1`, `\2` | Capture group reference | `https://new.com/\1` |
| `[^/]+` | Any chars except `/` | `/user/([^/]+)/` |

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

<!-- Screenshot: Rule list with one rule disabled (grayed out) -->
<!-- ![Toggle Rule](docs/screenshots/toggle-rule.png) -->

### Edit a Rule

Click the **Edit** button on any rule to load it into the form for modification.

<!-- Screenshot: Edit button highlighted on a rule -->
<!-- ![Edit Rule](docs/screenshots/edit-rule.png) -->

### Delete a Rule

Click the **Delete** button and confirm to remove a rule permanently.

---

## Import & Export

### Export Your Rules

1. Click the **Export** button
2. A JSON file downloads automatically
3. Save this file as a backup

<!-- Screenshot: Export button highlighted -->
<!-- ![Export](docs/screenshots/export.png) -->

### Import Rules

1. Click the **Import** button
2. Select a JSON file (Resurrector format or Redirector format)
3. Rules are added to your existing list

**Supported formats:**
- **Resurrector format** — Native JSON array
- **Redirector format** — Exported from the original Redirector extension

<!-- Screenshot: Import button and file picker -->
<!-- ![Import](docs/screenshots/import.png) -->

---

## Extension States

### Enabled (Active)

When the master toggle is ON, the icon appears in full color and redirects are active.

<p align="center">
  <img src="public/icons/resurrector_master_128.png" alt="Enabled" width="64">
</p>

### Disabled (Inactive)

When the master toggle is OFF, the icon is grayed out and no redirects occur.

<p align="center">
  <img src="public/icons/resurrector_master_off_128.png" alt="Disabled" width="64">
</p>

---

## Development

```bash
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
│   ├── icons/              # Extension icons
│   └── images/             # Wordmark logo
└── dist/                   # Built extension (load this in Chrome)
```

---

## Technical Details

- **Manifest Version:** 3 (MV3)
- **API:** `declarativeNetRequest` (not deprecated `webRequest`)
- **Storage:** `chrome.storage.local`
- **Max Rules:** 5,000 dynamic rules
- **Max Regex Rules:** 1,000
- **Bundle Size:** ~14KB (excluding images)

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

1. Check the **master toggle** is ON (icon should be colorful)
2. Check the **individual rule toggle** is checked
3. Verify your URL pattern matches the actual URL
4. For regex rules, test your pattern at [regex101.com](https://regex101.com/) (select "ECMAScript" flavor)

### Import failed?

- Ensure the file is valid JSON
- Check the file contains either an array of rules or a Redirector export object

### Extension not loading?

- Make sure you're loading from the `dist` folder, not the root
- Run `npm run build` first
- Check for errors in `chrome://extensions/`

---

## License

MIT

---

<p align="center">
  <img src="public/icons/resurrector_master_48.png" alt="Resurrector" width="24">
  <br>
  Made with care for developers who need reliable URL redirection.
</p>
