// src/shared/storage.js
// Storage and DNR rule management for Resurrector

const RULES_KEY = "rules";
const NEXT_ID_KEY = "nextRuleId";
const ENABLED_KEY = "extensionEnabled";

// ---- Rule storage (chrome.storage.local) ----
export async function getRules() {
  const { [RULES_KEY]: rules = [] } = await chrome.storage.local.get(RULES_KEY);
  return rules;
}

export async function setRules(rules) {
  await chrome.storage.local.set({ [RULES_KEY]: Array.isArray(rules) ? rules : [] });
}

export async function getNextRuleId() {
  const { [NEXT_ID_KEY]: nextRuleId = 1 } = await chrome.storage.local.get(NEXT_ID_KEY);
  await chrome.storage.local.set({ [NEXT_ID_KEY]: nextRuleId + 1 });
  return nextRuleId;
}

// ---- Extension enabled state ----
export async function getEnabled() {
  const { [ENABLED_KEY]: enabled = true } = await chrome.storage.local.get(ENABLED_KEY);
  return enabled;
}

export async function setEnabled(enabled) {
  await chrome.storage.local.set({ [ENABLED_KEY]: !!enabled });
}

// ---- Map internal rule to DNR rule (MV3) ----
export function toDnrRule(internalRule) {
  const resourceTypes = internalRule.resourceTypes?.length
    ? internalRule.resourceTypes
    : [
        "main_frame",
        "sub_frame",
        "xmlhttprequest",
        "script",
        "image",
        "stylesheet",
        "font",
        "object",
        "ping",
        "other",
      ];

  const condition = { resourceTypes };

  if (internalRule.type === "regex") {
    condition.regexFilter = internalRule.from;
  } else {
    // Convert wildcard pattern to urlFilter
    condition.urlFilter = internalRule.from;
  }

  const action = { type: "redirect" };
  if (internalRule.type === "regex" && internalRule.regexSubstitution) {
    action.redirect = { regexSubstitution: internalRule.regexSubstitution };
  } else {
    action.redirect = { url: internalRule.to };
  }

  return {
    id: internalRule.id,
    priority: internalRule.priority || 1,
    condition,
    action,
  };
}

// ---- RE2 unsupported syntax detection ----
const RE2_UNSUPPORTED = [
  { pattern: /\(\?=/, label: "positive lookahead (?=...)" },
  { pattern: /\(\?!/, label: "negative lookahead (?!...)" },
  { pattern: /\(\?<=/, label: "positive lookbehind (?<=...)" },
  { pattern: /\(\?<!/, label: "negative lookbehind (?<!...)" },
  { pattern: /\(\?P</, label: "named capture group (?P<...>)" },
  { pattern: /\\[bB]/, label: "word boundary (\\b, \\B)" },
];

export function checkRe2Compatibility(pattern) {
  const issues = [];
  for (const { pattern: re, label } of RE2_UNSUPPORTED) {
    if (re.test(pattern)) {
      issues.push(label);
    }
  }
  return issues;
}

// ---- Validate a DNR rule before registering ----
export function validateRule(rule) {
  const errors = [];

  if (!rule.from || !rule.from.trim()) {
    errors.push("From URL is required");
  }

  if (rule.type === "regex") {
    if (!rule.regexSubstitution || !rule.regexSubstitution.trim()) {
      errors.push("To URL (regex substitution) is required");
    }
    try {
      new RegExp(rule.from);
    } catch {
      errors.push("Invalid regex pattern in From URL");
    }
    // Check for RE2-incompatible features
    const re2Issues = checkRe2Compatibility(rule.from || "");
    if (re2Issues.length > 0) {
      errors.push(
        "Unsupported RE2 syntax: " + re2Issues.join(", ") +
        ". Chrome uses RE2 which does not support lookaheads, lookbehinds, or word boundaries"
      );
    }
  } else {
    if (!rule.to || !rule.to.trim()) {
      errors.push("To URL is required");
    }
    try {
      new URL(rule.to);
    } catch {
      errors.push("To URL must be a valid absolute URL (e.g. https://example.com)");
    }
  }

  return errors;
}

// ---- Rebuild DNR rules from storage ----
export async function rebuildDnrFromStorage() {
  const [rules, enabled] = await Promise.all([getRules(), getEnabled()]);

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((r) => r.id);

  let addRules = [];
  const failedRules = [];

  if (enabled) {
    const activeRules = rules.filter((r) => r.enabled !== false);
    for (const r of activeRules) {
      const errors = validateRule(r);
      if (errors.length === 0) {
        addRules.push(toDnrRule(r));
      } else {
        failedRules.push({ id: r.id, name: r.name, errors });
      }
    }
  }

  // Try adding all valid rules at once
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules,
    });
  } catch (e) {
    // If batch fails, fall back to adding rules one by one
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules: [],
    });

    for (const dnrRule of addRules) {
      try {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: [],
          addRules: [dnrRule],
        });
      } catch {
        const srcRule = rules.find((r) => r.id === dnrRule.id);
        failedRules.push({
          id: dnrRule.id,
          name: srcRule?.name,
          errors: ["Chrome rejected this rule — check the URL pattern"],
        });
      }
    }
  }

  return { active: addRules.length - failedRules.length, failed: failedRules };
}

// ---- Messaging helpers for UI ----
export async function msgListRules() {
  return chrome.runtime.sendMessage({ type: "LIST_RULES" });
}

export async function msgAddRule(rule) {
  return chrome.runtime.sendMessage({ type: "ADD_RULE", rule });
}

export async function msgUpdateRule(rule) {
  return chrome.runtime.sendMessage({ type: "UPDATE_RULE", rule });
}

export async function msgDeleteRule(id) {
  return chrome.runtime.sendMessage({ type: "DELETE_RULE", id });
}

export async function msgToggleRule(id, enabled) {
  return chrome.runtime.sendMessage({ type: "TOGGLE_RULE", id, enabled });
}

export async function msgExportRules() {
  return chrome.runtime.sendMessage({ type: "EXPORT_RULES" });
}

export async function msgImportRules(rules) {
  return chrome.runtime.sendMessage({ type: "IMPORT_RULES", rules });
}

export async function msgGetEnabled() {
  return chrome.runtime.sendMessage({ type: "GET_ENABLED" });
}

export async function msgSetEnabled(enabled) {
  return chrome.runtime.sendMessage({ type: "SET_ENABLED", enabled });
}

export async function msgSyncIcon() {
  return chrome.runtime.sendMessage({ type: "SYNC_ICON" });
}
