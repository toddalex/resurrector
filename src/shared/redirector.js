// src/shared/redirector.js
// Converts rules exported from the original Redirector extension into Resurrector rules.
//
// Redirector semantics being reproduced:
// - The redirect URL replaces the whole request URL, with $1..$9 filled from capture groups.
// - Wildcard "*" behaves like the regex group (.*) and wildcard patterns match the full URL.
// Chrome's declarativeNetRequest differs:
// - Captures are only substituted in regex rules, using \1..\9.
// - regexSubstitution replaces only the matched part of the URL, so unanchored
//   patterns are wrapped to consume the whole URL.

const CAPTURE_REF = /\$(\d)/;

// Redirector "appliesTo" values that have no identical declarativeNetRequest resource type.
const RESOURCE_TYPE_MAP = { imageset: "image", history: null, beacon: "ping" };
const DNR_RESOURCE_TYPES = new Set([
  "main_frame", "sub_frame", "stylesheet", "script", "image", "font", "object",
  "xmlhttprequest", "ping", "csp_report", "media", "websocket", "webtransport",
  "webbundle", "other",
]);

/** Escape every regex metacharacter except "*", which becomes a capture group. */
export function wildcardToRegex(pattern) {
  const escaped = pattern
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join("(.*)");
  return `^${escaped}$`;
}

/** Make a regex match the whole URL so regexSubstitution replaces all of it. Capture numbering is unchanged. */
export function anchorRegex(pattern) {
  const anchoredStart = pattern.startsWith("^");
  const anchoredEnd = /(^|[^\\])(\\\\)*\$$/.test(pattern);
  if (anchoredStart && anchoredEnd) return pattern;
  return `^.*?(?:${pattern}).*$`;
}

/** Convert JavaScript replacement syntax ($1, $&) to Chrome's regexSubstitution syntax (\1, \0). */
export function toRegexSubstitution(redirectUrl) {
  return redirectUrl.replace(/\$(\d|&)/g, (_, ref) => (ref === "&" ? "\\0" : `\\${ref}`));
}

export function toResourceTypes(appliesTo) {
  if (!Array.isArray(appliesTo)) return undefined;
  const types = new Set();
  for (const t of appliesTo) {
    const mapped = t in RESOURCE_TYPE_MAP ? RESOURCE_TYPE_MAP[t] : t;
    if (mapped && DNR_RESOURCE_TYPES.has(mapped)) types.add(mapped);
  }
  return types.size ? [...types] : undefined;
}

export function convertRedirectorRule(r) {
  const from = r.includePattern || "";
  const redirectUrl = r.redirectUrl || "";
  const rule = {
    name: r.description || "Imported Rule",
    enabled: !r.disabled,
  };
  const resourceTypes = toResourceTypes(r.appliesTo);
  if (resourceTypes) rule.resourceTypes = resourceTypes;

  if (r.patternType === "R") {
    return {
      ...rule,
      type: "regex",
      from: anchorRegex(from),
      regexSubstitution: toRegexSubstitution(redirectUrl),
    };
  }

  if (CAPTURE_REF.test(redirectUrl)) {
    return {
      ...rule,
      type: "regex",
      from: wildcardToRegex(from),
      regexSubstitution: toRegexSubstitution(redirectUrl),
    };
  }

  return { ...rule, type: "wildcard", from, to: redirectUrl };
}

/**
 * Redirector export format: { redirects: [{ includePattern, redirectUrl, patternType, description, disabled, appliesTo }] }
 */
export function convertRedirectorFormat(data) {
  if (!data.redirects || !Array.isArray(data.redirects)) {
    return null;
  }
  return data.redirects.map(convertRedirectorRule);
}
