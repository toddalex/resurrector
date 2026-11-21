// Background service worker (MV3)
// Resurrector - URL Redirector Extension

import {
  RULES_KEY,
  GROUPS_KEY,
  getRules,
  setRules,
  getGroups,
  setGroups,
  newGroupId,
  getNextRuleId,
  getEnabled,
  setEnabled,
  rebuildDnrFromStorage,
  validateRule,
  migrateLocalToSync,
} from "../shared/storage.js";

// ---- CRUD Operations ----

async function addRule(rule) {
  const errors = validateRule(rule);
  if (errors.length > 0) {
    throw new Error("Invalid rule: " + errors.join("; "));
  }

  const id = await getNextRuleId();
  const rules = await getRules();
  rules.push({ id, enabled: true, ...rule });
  await setRules(rules);
  await rebuildDnrFromStorage();
  return id;
}

async function updateRule(partial) {
  const rules = await getRules();
  const i = rules.findIndex((r) => r.id === Number(partial.id));
  if (i === -1) throw new Error("Rule not found: " + partial.id);

  const merged = { ...rules[i], ...partial, id: rules[i].id };
  if (merged.type !== "regex") delete merged.regexSubstitution;

  const errors = validateRule(merged);
  if (errors.length > 0) {
    throw new Error("Invalid rule: " + errors.join("; "));
  }

  rules[i] = merged;
  await setRules(rules);
  await rebuildDnrFromStorage();
  return merged;
}

async function deleteRule(id) {
  const rules = await getRules();
  const updated = rules.filter((r) => r.id !== Number(id));
  await setRules(updated);
  await rebuildDnrFromStorage();
}

async function toggleRule(id, enabled) {
  const rules = await getRules();
  const i = rules.findIndex((r) => r.id === Number(id));
  if (i === -1) throw new Error("Rule not found: " + id);
  
  rules[i].enabled = enabled;
  await setRules(rules);
  await rebuildDnrFromStorage();
}

// Imported rules may name a tab with `group`; it is matched by name or created.
async function importRules(newRules) {
  const [rules, groups] = await Promise.all([getRules(), getGroups()]);
  let groupsChanged = false;
  for (const raw of newRules) {
    const { id: _id, groupId: _groupId, group, ...rest } = raw;
    const rule = { enabled: true, ...rest, id: await getNextRuleId() };
    if (group) {
      let g = groups.find((x) => x.name === group);
      if (!g) {
        g = { id: newGroupId(), name: group, enabled: true };
        groups.push(g);
        groupsChanged = true;
      }
      rule.groupId = g.id;
    }
    rules.push(rule);
  }
  if (groupsChanged) await setGroups(groups);
  await setRules(rules);
  await rebuildDnrFromStorage();
}

async function exportRules() {
  const [rules, groups] = await Promise.all([getRules(), getGroups()]);
  // IDs are per-install; tabs are exported by name so older versions simply ignore them
  return rules.map(({ id, groupId, ...rest }) => {
    const group = groups.find((g) => g.id === groupId);
    return group ? { ...rest, group: group.name } : rest;
  });
}

// ---- Tabs ----

async function createGroup(name) {
  const groups = await getGroups();
  const group = { id: newGroupId(), name, enabled: true };
  groups.push(group);
  await setGroups(groups);
  return group;
}

async function updateGroup(partial) {
  const groups = await getGroups();
  const i = groups.findIndex((g) => g.id === partial.id);
  if (i === -1) throw new Error("Tab not found: " + partial.id);
  const enabledChanged = "enabled" in partial && partial.enabled !== groups[i].enabled;
  groups[i] = { ...groups[i], ...partial };
  await setGroups(groups);
  if (enabledChanged) await rebuildDnrFromStorage();
  return groups[i];
}

// Deleting a tab keeps its rules; they move back to All.
async function deleteGroup(id) {
  const [rules, groups] = await Promise.all([getRules(), getGroups()]);
  for (const r of rules) {
    if (r.groupId === id) delete r.groupId;
  }
  await setRules(rules);
  await setGroups(groups.filter((g) => g.id !== id));
  await rebuildDnrFromStorage();
}

async function moveRule(ruleId, groupId) {
  const rules = await getRules();
  const rule = rules.find((r) => r.id === Number(ruleId));
  if (!rule) throw new Error("Rule not found: " + ruleId);
  if (groupId) rule.groupId = groupId;
  else delete rule.groupId;
  await setRules(rules);
  await rebuildDnrFromStorage();
}

async function reorderRules(orderedIds) {
  const rules = await getRules();
  const byId = new Map(rules.map((r) => [r.id, r]));
  const reordered = orderedIds.map((id) => byId.get(id)).filter(Boolean);
  // Append any rules not in orderedIds (shouldn't happen, but defensive)
  for (const r of rules) {
    if (!orderedIds.includes(r.id)) reordered.push(r);
  }
  await setRules(reordered);
  await rebuildDnrFromStorage();
}

// ---- Icon management ----

async function updateIcon(enabled) {
  if (enabled) {
    await chrome.action.setBadgeText({ text: "" });
  } else {
    await chrome.action.setBadgeText({ text: "OFF" });
    await chrome.action.setBadgeBackgroundColor({ color: "#6b7280" });
  }
}

// ---- Lifecycle ----

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "update" || details.reason === "install") {
    await migrateLocalToSync();
  }
  await rebuildDnrFromStorage();
  const enabled = await getEnabled();
  await updateIcon(enabled);
});

chrome.runtime.onStartup.addListener(async () => {
  await rebuildDnrFromStorage();
  const enabled = await getEnabled();
  await updateIcon(enabled);
});

// ---- Sync: rebuild DNR when rules arrive from another device ----

chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === "sync" && (changes[RULES_KEY] || changes[GROUPS_KEY])) {
    await rebuildDnrFromStorage();
  }
});

// ---- Messaging API ----

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      switch (msg.type) {
        case "ADD_RULE": {
          const id = await addRule(msg.rule);
          sendResponse({ ok: true, id });
          break;
        }
        case "UPDATE_RULE": {
          const rule = await updateRule(msg.rule);
          sendResponse({ ok: true, rule });
          break;
        }
        case "DELETE_RULE": {
          await deleteRule(msg.id);
          sendResponse({ ok: true });
          break;
        }
        case "TOGGLE_RULE": {
          await toggleRule(msg.id, msg.enabled);
          sendResponse({ ok: true });
          break;
        }
        case "LIST_RULES": {
          const [rules, groups] = await Promise.all([getRules(), getGroups()]);
          sendResponse({ ok: true, rules, groups });
          break;
        }
        case "EXPORT_RULES": {
          sendResponse({ ok: true, rules: await exportRules() });
          break;
        }
        case "CREATE_GROUP": {
          sendResponse({ ok: true, group: await createGroup(msg.name) });
          break;
        }
        case "UPDATE_GROUP": {
          sendResponse({ ok: true, group: await updateGroup(msg.group) });
          break;
        }
        case "DELETE_GROUP": {
          await deleteGroup(msg.id);
          sendResponse({ ok: true });
          break;
        }
        case "MOVE_RULE": {
          await moveRule(msg.ruleId, msg.groupId);
          sendResponse({ ok: true });
          break;
        }
        case "IMPORT_RULES": {
          await importRules(msg.rules);
          sendResponse({ ok: true });
          break;
        }
        case "REORDER_RULES": {
          await reorderRules(msg.orderedIds);
          sendResponse({ ok: true });
          break;
        }
        case "GET_ENABLED": {
          const enabled = await getEnabled();
          sendResponse({ ok: true, enabled });
          break;
        }
        case "SET_ENABLED": {
          await setEnabled(msg.enabled);
          await rebuildDnrFromStorage();
          await updateIcon(msg.enabled);
          sendResponse({ ok: true });
          break;
        }
        case "SYNC_ICON": {
          const enabled = await getEnabled();
          await updateIcon(enabled);
          sendResponse({ ok: true, enabled });
          break;
        }
        default:
          sendResponse({ ok: false, error: "Unknown message type" });
      }
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  })();
  return true;
});
