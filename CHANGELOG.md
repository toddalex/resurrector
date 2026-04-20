# Changelog

All notable changes to Resurrector (Redirector) will be documented in this file.

## [1.2.1] - 2026-04-20

### Added
- **Drag-and-drop rule reordering** — Rules can now be rearranged by dragging the grip handle on each rule; new order persists across sessions and syncs across devices

## [1.2.0] - 2026-04-16

### Added
- **Cross-device sync** — Redirect rules now sync across Chrome instances via `chrome.storage.sync`, so rules follow your Google account to any device
- **Automatic migration** — Existing rules from v1.1.x are automatically migrated to sync storage on upgrade
- **Live sync refresh** — The popup auto-refreshes when rules arrive from another device
- **Quota handling** — Clear error message when sync storage limit is exceeded (~40 rules)

### Changed
- **Storage:** Rules and rule IDs now use `chrome.storage.sync`; master toggle remains in `chrome.storage.local` as a per-device preference

## [1.1.1] - 2026-02-15

### Fixed
- **Critical: One bad rule no longer breaks all rules** — `rebuildDnrFromStorage` now validates each rule individually and falls back to per-rule registration if a batch update fails
- **Rule validation on save** — Rules are validated in the background service worker before being stored, preventing invalid rules from entering storage
- **From URL validation** — The "From URL" field is now validated (protocol/wildcard required for wildcard rules, regex syntax check for regex rules)
- **RE2 compatibility checks** — Detects unsupported regex features (lookaheads, lookbehinds, word boundaries) and shows a clear error before saving, with guidance to use the Golang flavor on regex101.com for compatible testing
- **Badge sync without rebuild** — Opening the popup now syncs the badge icon via a lightweight `SYNC_ICON` message instead of triggering a full DNR rebuild

### Changed
- **Header icon** — Replaced wordmark with the Resurrector master icon in the popup header

### Removed
- Removed `console.log` / `console.error` statements from production code
- Removed unnecessary `web_accessible_resources` block (icons don't need to be exposed to websites)

## [1.1.0] - 2026-02-15

### Added
- **Auto-prefix URLs** — Entering `google.com` automatically converts to `https://www.google.com`
- **URL validation** — Invalid redirect URLs are caught before saving with clear error messages
- **Error alerts** — Failed save/toggle operations now show alert dialogs instead of failing silently
- Chrome Web Store installation link in README
- Updated extension description with tagline

### Fixed
- **Toggle/icon sync** — Master toggle state now properly syncs with badge icon on popup load

### Changed
- Updated README with Chrome Web Store as recommended installation method
- Updated wordmark image

## [1.0.0] - 2026-02-08

### Added
- Initial release
- Custom redirect rules (From URL → To URL)
- Wildcard support using `*` for pattern matching
- Regex support with capture groups (RE2 syntax)
- Import/Export rules as JSON
- Compatible with original Redirector extension exports
- Master toggle to enable/disable all redirects
- Per-rule toggle to enable/disable individual rules
- Built for Chrome Manifest V3
- Uses `declarativeNetRequest` API

---

[Chrome Web Store](https://chromewebstore.google.com/detail/bkkbepmjgikohkenjolecnjfmhdfpgba) | [GitHub](https://github.com/toddalex/resurrector)
