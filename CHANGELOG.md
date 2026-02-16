# Changelog

All notable changes to Resurrector (Redirector) will be documented in this file.

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
