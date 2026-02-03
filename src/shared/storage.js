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

// ---- Rebuild DNR rules from storage ----
export async function rebuildDnrFromStorage() {
  const [rules, enabled] = await Promise.all([getRules(), getEnabled()]);

  // Get existing rules to remove
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((r) => r.id);

  // Only add rules if extension is enabled and rules are individually enabled
  const addRules = enabled
    ? rules.filter((r) => r.enabled !== false).map((r) => toDnrRule(r))
    : [];

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules,
  });

  console.log(`✅ DNR: ${addRules.length} rules active`);
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
