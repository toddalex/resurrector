// Background service worker (MV3)
// Resurrector - URL Redirector Extension

import {
  getRules,
  setRules,
  getNextRuleId,
  getEnabled,
  setEnabled,
  rebuildDnrFromStorage,
} from "../shared/storage.js";

// ---- CRUD Operations ----

async function addRule(rule) {
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

async function importRules(newRules) {
  const rules = await getRules();
  for (const raw of newRules) {
    const id = await getNextRuleId();
    rules.push({ id, enabled: true, ...raw });
  }
  await setRules(rules);
  await rebuildDnrFromStorage();
}

// ---- Icon management ----

async function updateIcon(enabled) {
  try {
    const suffix = enabled ? "" : "_off";
    await chrome.action.setIcon({
      path: {
        16: chrome.runtime.getURL(`public/icons/resurrector_master${suffix}_16.png`),
        32: chrome.runtime.getURL(`public/icons/resurrector_master${suffix}_32.png`),
        48: chrome.runtime.getURL(`public/icons/resurrector_master${suffix}_48.png`),
        128: chrome.runtime.getURL(`public/icons/resurrector_master${suffix}_128.png`),
      },
    });
  } catch (e) {
    console.warn("Could not update icon:", e);
  }
}

// ---- Lifecycle ----

chrome.runtime.onInstalled.addListener(async () => {
  console.log("🔧 Resurrector installed - rebuilding rules...");
  await rebuildDnrFromStorage();
  const enabled = await getEnabled();
  await updateIcon(enabled);
});

chrome.runtime.onStartup.addListener(async () => {
  console.log("🔧 Resurrector started - rebuilding rules...");
  await rebuildDnrFromStorage();
  const enabled = await getEnabled();
  await updateIcon(enabled);
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
          const rules = await getRules();
          sendResponse({ ok: true, rules });
          break;
        }
        case "EXPORT_RULES": {
          const rules = await getRules();
          // Strip IDs for export
          const exportData = rules.map(({ id, ...rest }) => rest);
          sendResponse({ ok: true, rules: exportData });
          break;
        }
        case "IMPORT_RULES": {
          await importRules(msg.rules);
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
        default:
          sendResponse({ ok: false, error: "Unknown message type" });
      }
    } catch (e) {
      console.error("BG error:", e);
      sendResponse({ ok: false, error: String(e) });
    }
  })();
  return true;
});
