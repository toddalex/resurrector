// src/options/index.js
// Resurrector Options Page

import {
  RULES_KEY,
  GROUPS_KEY,
  isRuleActive,
  msgCreateGroup,
  msgUpdateGroup,
  msgDeleteGroup,
  msgMoveRule,
  msgListRules,
  msgAddRule,
  msgUpdateRule,
  msgDeleteRule,
  msgToggleRule,
  msgExportRules,
  msgImportRules,
  msgReorderRules,
  msgGetEnabled,
  msgSetEnabled,
  msgSyncIcon,
  checkRe2Compatibility,
} from "../shared/storage.js";
import { convertRedirectorFormat } from "../shared/redirector.js";

// DOM Elements
const masterToggle = document.getElementById("master-toggle");
const closeBtn = document.getElementById("close-btn");
const ruleForm = document.getElementById("rule-form");
const formTitle = document.getElementById("form-title");
const editRuleId = document.getElementById("edit-rule-id");
const ruleName = document.getElementById("rule-name");
const ruleFrom = document.getElementById("rule-from");
const ruleTo = document.getElementById("rule-to");
const ruleRegex = document.getElementById("rule-regex");
const saveBtn = document.getElementById("save-btn");
const cancelBtn = document.getElementById("cancel-btn");
const rulesListEl = document.getElementById("rules-list");
const exportBtn = document.getElementById("export-btn");
const importBtn = document.getElementById("import-btn");
const importFile = document.getElementById("import-file");
const tabsEl = document.getElementById("group-tabs");
const groupToggleWrap = document.getElementById("group-toggle-wrap");
const groupToggle = document.getElementById("group-toggle");

const ALL = "all";
const ACTIVE_GROUP_KEY = "activeGroup";
const REDIRECTOR_IMPORT_TAB = "Imported from Redirector";

let rules = [];
let groups = [];
let activeGroup = ALL;

// === Initialization ===

async function init() {
  const { [ACTIVE_GROUP_KEY]: saved } = await chrome.storage.local.get(ACTIVE_GROUP_KEY);
  activeGroup = saved || ALL;
  await loadEnabled();
  await loadRules();
  attachEventListeners();

  // Auto-refresh rule list when rules sync from another device
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "sync" && (changes[RULES_KEY] || changes[GROUPS_KEY])) {
      loadRules();
    }
  });
}

// === State Management ===

async function loadEnabled() {
  const res = await msgGetEnabled();
  if (res?.ok) {
    masterToggle.checked = res.enabled;
  }
  // Sync badge without triggering a full DNR rebuild
  await msgSyncIcon();
}

async function loadRules() {
  const res = await msgListRules();
  if (res?.ok) {
    rules = res.rules;
    groups = res.groups || [];
    if (activeGroup !== ALL && !groups.some((g) => g.id === activeGroup)) {
      setActiveGroup(ALL);
    }
    renderTabs();
    renderRules();
    updateFormTitle();
  }
}

// === UI Updates ===

function visibleRules() {
  return activeGroup === ALL ? rules : rules.filter((r) => r.groupId === activeGroup);
}

function groupById(id) {
  return groups.find((g) => g.id === id);
}

function renderRules() {
  const shown = visibleRules();
  if (shown.length === 0) {
    const message = rules.length === 0
      ? "No redirect rules yet. Add your first rule above!"
      : "No rules in this tab. Add one above, or drag a rule onto this tab.";
    rulesListEl.innerHTML = `<div class="empty-state"><p>${message}</p></div>`;
    return;
  }

  rulesListEl.innerHTML = "";
  shown.forEach((rule) => {
    const ruleEl = createRuleElement(rule);
    rulesListEl.appendChild(ruleEl);
  });
}

function createRuleElement(rule) {
  const div = document.createElement("div");
  const tabOff = rule.enabled !== false && !isRuleActive(rule, groups);
  div.className = `rule-item ${rule.enabled === false ? "disabled" : ""} ${tabOff ? "group-off" : ""}`;
  div.dataset.ruleId = rule.id;
  const typeLabel = rule.type === "regex" ? "Regex" : "Wildcard";
  const group = activeGroup === ALL ? groupById(rule.groupId) : null;
  const groupBadge = group ? `<span class="rule-group-badge">${escapeHtml(group.name)}</span>` : "";

  div.innerHTML = `
    <div class="drag-handle" title="Drag to reorder">⠿</div>
    <div class="rule-toggle">
      <input type="checkbox" ${rule.enabled !== false ? "checked" : ""} data-rule-id="${rule.id}" />
    </div>
    <div class="rule-info">
      <div class="rule-name">${escapeHtml(rule.name || "Unnamed Rule")}</div>
      <div class="rule-urls">
        <div class="rule-url">
          <span class="url-label">From:</span>
          <code>${escapeHtml(rule.from)}</code>
        </div>
        <div class="rule-url">
          <span class="url-label">To:</span>
          <code>${escapeHtml(rule.type === "regex" ? (rule.regexSubstitution || rule.to) : rule.to)}</code>
        </div>
      </div>
      <span class="rule-type-badge">${typeLabel}</span>${groupBadge}
    </div>
    <div class="rule-actions">
      <button class="edit-btn" data-rule-id="${rule.id}" title="Edit">Edit</button>
      <button class="delete-btn" data-rule-id="${rule.id}" title="Delete">Delete</button>
    </div>
  `;

  return div;
}

// === Tabs ===

function setActiveGroup(id) {
  activeGroup = id;
  chrome.storage.local.set({ [ACTIVE_GROUP_KEY]: id });
}

function renderTabs() {
  closeTabMenu();
  tabsEl.innerHTML = "";

  if (groups.length === 0) {
    const h2 = document.createElement("h2");
    h2.textContent = "Redirect Rules";
    tabsEl.append(h2, createAddTabButton());
  } else {
    // Tabs scroll sideways; "+" sits outside the strip so it is never clipped
    const strip = document.createElement("div");
    strip.className = "tab-strip";
    strip.append(createTab(ALL, "All", rules.length));
    for (const g of groups) {
      const count = rules.filter((r) => r.groupId === g.id).length;
      strip.append(createTab(g.id, g.name, count, g.enabled === false));
    }
    tabsEl.append(strip, createAddTabButton());
  }

  const group = groupById(activeGroup);
  groupToggleWrap.hidden = !group;
  if (group) groupToggle.checked = group.enabled !== false;

  // Measure last: showing the tab switch above narrows the strip
  const strip = tabsEl.querySelector(".tab-strip");
  if (strip) revealActiveTab(strip);
}

/** Scroll the tab strip sideways so the active tab is visible, without scrolling the page. */
function revealActiveTab(strip) {
  const tab = strip.querySelector('[aria-selected="true"]');
  if (!tab) return;
  const s = strip.getBoundingClientRect();
  const t = tab.getBoundingClientRect();
  if (t.left < s.left) strip.scrollLeft -= s.left - t.left;
  else if (t.right > s.right) strip.scrollLeft += t.right - s.right;
}

function createTab(id, name, count, off = false) {
  const tab = document.createElement("div");
  const selected = id === activeGroup;
  tab.className = `tab${off ? " off" : ""}`;
  tab.setAttribute("role", "tab");
  tab.setAttribute("aria-selected", String(selected));
  tab.tabIndex = selected ? 0 : -1;
  tab.dataset.groupId = id;
  if (off) tab.title = "This tab is turned off";
  tab.innerHTML = `<span class="tab-name">${escapeHtml(name)}</span><span class="tab-count">${count}</span>`;
  if (id !== ALL) {
    const menuBtn = document.createElement("button");
    menuBtn.type = "button";
    menuBtn.className = "tab-menu-btn";
    menuBtn.title = "Tab options";
    menuBtn.setAttribute("aria-label", `Options for ${name}`);
    menuBtn.textContent = "⋯";
    tab.append(menuBtn);
  }
  return tab;
}

function createAddTabButton() {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "tab-add";
  btn.title = "New tab";
  btn.setAttribute("aria-label", "New tab");
  btn.textContent = "+";
  return btn;
}

function selectTab(id) {
  if (id === activeGroup) return;
  setActiveGroup(id);
  renderTabs();
  renderRules();
  updateFormTitle();
  tabsEl.querySelector(`[data-group-id="${id}"]`)?.focus({ preventScroll: true });
}

/** Replace `anchor` with a text field; resolves with the trimmed name, or null if cancelled. */
function editTabName(anchor, initial = "") {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "tab-input";
    input.maxLength = 30;
    input.value = initial;
    input.placeholder = "Tab name";
    input.setAttribute("aria-label", "Tab name");
    anchor.replaceWith(input);
    input.focus();
    input.select();

    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      resolve(value);
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") finish(input.value.trim() || null);
      if (e.key === "Escape") finish(null);
    });
    input.addEventListener("blur", () => finish(input.value.trim() || null));
  });
}

async function handleAddTab(btn) {
  const name = await editTabName(btn);
  if (!name) return renderTabs();
  const res = await msgCreateGroup(name);
  if (!res?.ok) {
    alert("Failed to create tab: " + (res?.error || "Unknown error"));
    return renderTabs();
  }
  setActiveGroup(res.group.id);
  await loadRules();
}

async function handleRenameTab(id) {
  const group = groupById(id);
  const tab = tabsEl.querySelector(`[data-group-id="${id}"]`);
  if (!group || !tab) return;
  const name = await editTabName(tab, group.name);
  if (name && name !== group.name) {
    const res = await msgUpdateGroup({ id, name });
    if (!res?.ok) alert("Failed to rename tab: " + (res?.error || "Unknown error"));
  }
  await loadRules();
}

async function handleDeleteTab(id) {
  const group = groupById(id);
  if (!group) return;
  const count = rules.filter((r) => r.groupId === id).length;
  const detail = count ? ` Its ${count} rule${count === 1 ? "" : "s"} will move to All.` : "";
  if (!confirm(`Delete the tab "${group.name}"?${detail}`)) return;
  const res = await msgDeleteGroup(id);
  if (!res?.ok) alert("Failed to delete tab: " + (res?.error || "Unknown error"));
  if (activeGroup === id) setActiveGroup(ALL);
  await loadRules();
}

let tabMenuEl = null;

function openTabMenu(id, anchor) {
  closeTabMenu();
  tabMenuEl = document.createElement("div");
  tabMenuEl.className = "tab-menu";
  tabMenuEl.setAttribute("role", "menu");
  tabMenuEl.innerHTML = `
    <button type="button" role="menuitem" data-action="rename">Rename</button>
    <button type="button" role="menuitem" data-action="delete" class="danger">Delete</button>
  `;
  const rect = (anchor.closest(".tab") || anchor).getBoundingClientRect();
  tabMenuEl.style.top = `${rect.bottom + 4}px`;
  tabMenuEl.style.left = `${rect.left}px`;
  tabMenuEl.addEventListener("click", (e) => {
    const action = e.target.dataset.action;
    closeTabMenu();
    if (action === "rename") handleRenameTab(id);
    if (action === "delete") handleDeleteTab(id);
  });
  document.body.append(tabMenuEl);
  tabMenuEl.querySelector("button").focus();
}

function closeTabMenu() {
  tabMenuEl?.remove();
  tabMenuEl = null;
}

function initTabs() {
  tabsEl.addEventListener("click", (e) => {
    if (e.target.closest(".tab-add")) return handleAddTab(e.target.closest(".tab-add"));
    const tab = e.target.closest(".tab");
    if (!tab) return;
    if (e.target.closest(".tab-menu-btn")) {
      e.stopPropagation();
      return openTabMenu(tab.dataset.groupId, e.target);
    }
    selectTab(tab.dataset.groupId);
  });

  tabsEl.addEventListener("dblclick", (e) => {
    const tab = e.target.closest(".tab");
    if (tab && tab.dataset.groupId !== ALL && !e.target.closest(".tab-menu-btn")) {
      handleRenameTab(tab.dataset.groupId);
    }
  });

  tabsEl.addEventListener("keydown", (e) => {
    const tab = e.target.closest(".tab");
    if (!tab || e.target !== tab) return;
    const tabs = [...tabsEl.querySelectorAll(".tab")];
    const i = tabs.indexOf(tab);
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const next = tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
      selectTab(next.dataset.groupId);
    } else if (e.key === "F2" && tab.dataset.groupId !== ALL) {
      handleRenameTab(tab.dataset.groupId);
    }
  });

  document.addEventListener("click", (e) => {
    if (tabMenuEl && !tabMenuEl.contains(e.target)) closeTabMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeTabMenu();
  });
  // The menu is fixed-position, so close it rather than let it drift when anything scrolls
  document.addEventListener("scroll", closeTabMenu, true);

  groupToggle.addEventListener("change", async () => {
    const res = await msgUpdateGroup({ id: activeGroup, enabled: groupToggle.checked });
    if (!res?.ok) alert("Failed to update tab: " + (res?.error || "Unknown error"));
    await loadRules();
  });

  // Drop a dragged rule onto a tab to move it there ("All" removes it from its tab)
  const dropTarget = (e) => {
    const tab = e.target.closest(".tab");
    if (!tab || !draggedEl) return null;
    const rule = rules.find((r) => r.id === Number(draggedEl.dataset.ruleId));
    const target = tab.dataset.groupId === ALL ? undefined : tab.dataset.groupId;
    return rule && rule.groupId !== target ? tab : null;
  };
  const clearDropTargets = () =>
    tabsEl.querySelectorAll(".tab.drop-target").forEach((el) => el.classList.remove("drop-target"));

  tabsEl.addEventListener("dragover", (e) => {
    const tab = dropTarget(e);
    clearDropTargets();
    if (!tab) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    tab.classList.add("drop-target");
  });
  tabsEl.addEventListener("dragleave", (e) => {
    if (!tabsEl.contains(e.relatedTarget)) clearDropTargets();
  });
  tabsEl.addEventListener("drop", async (e) => {
    const tab = dropTarget(e);
    clearDropTargets();
    if (!tab) return;
    e.preventDefault();
    const groupId = tab.dataset.groupId === ALL ? null : tab.dataset.groupId;
    const res = await msgMoveRule(Number(draggedEl.dataset.ruleId), groupId);
    if (!res?.ok) alert("Failed to move rule: " + (res?.error || "Unknown error"));
    await loadRules();
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

// === URL Validation & Normalization ===

/**
 * Normalize a URL by adding https://www. if missing
 * Only applies to non-regex "To" URLs
 */
function normalizeUrl(url) {
  if (!url) return url;
  
  // Skip wildcards and URLs that already have protocol
  if (url.startsWith("*") || url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  
  // Check if it looks like a domain (starts with alphanumeric and contains a dot)
  if (/^[a-zA-Z0-9]/.test(url) && url.includes(".")) {
    // Add www. if not already present (e.g., google.com -> www.google.com)
    // But don't add if it looks like a subdomain already (e.g., api.example.com)
    if (!url.startsWith("www.")) {
      // Count dots - if only one dot, it's likely a bare domain like google.com
      const dotCount = (url.match(/\./g) || []).length;
      if (dotCount === 1) {
        url = "www." + url;
      }
    }
    return "https://" + url;
  }
  
  return url;
}

/**
 * Validate that a redirect URL is valid for Chrome's declarativeNetRequest
 */
function isValidRedirectUrl(url) {
  if (!url) return false;
  
  // Must start with http:// or https://
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return false;
  }
  
  // Basic URL structure check
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// === Form Management ===

function updateFormTitle() {
  if (editRuleId.value) return;
  const group = groupById(activeGroup);
  formTitle.textContent = "Add New Rule";
  if (group) {
    const where = document.createElement("span");
    where.className = "form-title-tab";
    where.textContent = ` in ${group.name}`;
    formTitle.append(where);
  }
}

function resetForm() {
  editRuleId.value = "";
  ruleName.value = "";
  ruleFrom.value = "";
  ruleTo.value = "";
  ruleRegex.checked = false;
  updateFormTitle();
  saveBtn.textContent = "Add Rule";
  cancelBtn.style.display = "none";
}

function populateForm(rule) {
  editRuleId.value = rule.id;
  ruleName.value = rule.name || "";
  ruleFrom.value = rule.from || "";
  ruleTo.value = rule.type === "regex" ? (rule.regexSubstitution || rule.to) : (rule.to || "");
  ruleRegex.checked = rule.type === "regex";
  formTitle.textContent = "Edit Rule";
  saveBtn.textContent = "Save Changes";
  cancelBtn.style.display = "inline-flex";
}

async function handleFormSubmit(e) {
  e.preventDefault();

  const isRegex = ruleRegex.checked;
  let fromUrl = ruleFrom.value.trim();
  let toUrl = ruleTo.value.trim();

  if (!fromUrl) {
    alert("'From URL' is required.");
    return;
  }

  if (!toUrl) {
    alert("'To URL' is required.");
    return;
  }

  if (!isRegex) {
    fromUrl = normalizeUrl(fromUrl);
    toUrl = normalizeUrl(toUrl);
    
    ruleFrom.value = fromUrl;
    ruleTo.value = toUrl;
    
    if (!isValidRedirectUrl(toUrl)) {
      alert("Invalid 'To URL'. Please enter a valid URL starting with http:// or https://\n\nExample: https://example.com/");
      return;
    }

    // Validate "From URL" has a protocol or wildcard
    if (!fromUrl.startsWith("http://") && !fromUrl.startsWith("https://") && !fromUrl.startsWith("*")) {
      alert("Invalid 'From URL'. Please enter a URL starting with http://, https://, or * for wildcard.\n\nExample: https://old-site.com/*");
      return;
    }
  } else {
    // Validate regex pattern syntax
    try {
      new RegExp(fromUrl);
    } catch {
      alert("Invalid regex pattern in 'From URL'. Please check your syntax.\n\nTest patterns at regex101.com (select Golang flavor for RE2 compatibility).");
      return;
    }
    // Check for RE2-incompatible features
    const re2Issues = checkRe2Compatibility(fromUrl);
    if (re2Issues.length > 0) {
      alert(
        "Your regex uses features not supported by Chrome's RE2 engine:\n\n" +
        re2Issues.map((i) => "  - " + i).join("\n") +
        "\n\nChrome does not support lookaheads, lookbehinds, or word boundaries.\n" +
        "Tip: Use the Golang flavor on regex101.com for RE2-compatible testing."
      );
      return;
    }
  }

  const rule = {
    name: ruleName.value.trim(),
    from: fromUrl,
    type: isRegex ? "regex" : "wildcard",
  };

  if (isRegex) {
    rule.regexSubstitution = toUrl;
  } else {
    rule.to = toUrl;
  }

  const editId = editRuleId.value;

  try {
    if (editId) {
      rule.id = Number(editId);
      const res = await msgUpdateRule(rule);
      if (res?.ok) {
        resetForm();
        showFeedback(saveBtn, "Saved!", "#10b981");
        await loadRules();
      } else {
        alert("Failed to update rule: " + (res?.error || "Unknown error"));
      }
    } else {
      if (groupById(activeGroup)) rule.groupId = activeGroup;
      const res = await msgAddRule(rule);
      if (res?.ok) {
        resetForm();
        showFeedback(saveBtn, "Added!", "#10b981");
        await loadRules();
      } else {
        alert("Failed to add rule: " + (res?.error || "Unknown error"));
      }
    }
  } catch (err) {
    alert("Error saving rule: " + err.message);
  }
}

function showFeedback(btn, text, color) {
  const original = btn.textContent;
  const originalBg = btn.style.background;
  btn.textContent = text;
  btn.style.background = color;
  setTimeout(() => {
    btn.textContent = original;
    btn.style.background = originalBg;
  }, 1500);
}

// === Import/Export ===

async function handleExport() {
  const res = await msgExportRules();
  if (!res?.ok) return;

  const blob = new Blob([JSON.stringify(res.rules, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `resurrector-rules-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);

  showFeedback(exportBtn, "Exported!", "#10b981");
}

function handleImportClick() {
  importFile.click();
}

async function handleImportFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const imported = JSON.parse(text);
    
    let rulesToImport;

    // Check if this is Redirector format (has "redirects" array)
    if (imported.redirects && Array.isArray(imported.redirects)) {
      rulesToImport = convertRedirectorFormat(imported);
      if (!rulesToImport) {
        alert("Failed to convert Redirector format");
        return;
      }
      rulesToImport = rulesToImport.map((r) => ({ ...r, group: REDIRECTOR_IMPORT_TAB }));
    } else if (Array.isArray(imported)) {
      // Native Resurrector format
      rulesToImport = imported;
    } else {
      alert("Invalid format: expected an array of rules or Redirector export");
      return;
    }

    const res = await msgImportRules(rulesToImport);
    if (res?.ok) {
      showFeedback(importBtn, `Imported ${rulesToImport.length}!`, "#10b981");
      await loadRules();
    } else {
      alert("Failed to import: " + (res?.error || "Unknown error"));
    }
  } catch (err) {
    alert("Failed to import: " + err.message);
  }

  // Reset file input
  importFile.value = "";
}

// === Event Listeners ===

function attachEventListeners() {
  // Close button
  closeBtn.addEventListener("click", () => window.close());

  // Master toggle
  masterToggle.addEventListener("change", async (e) => {
    const enabled = e.target.checked;
    await msgSetEnabled(enabled);
  });

  // Form submission
  ruleForm.addEventListener("submit", handleFormSubmit);

  // Cancel edit
  cancelBtn.addEventListener("click", resetForm);

  // Rules list interactions
  rulesListEl.addEventListener("change", async (e) => {
    if (e.target.type === "checkbox" && e.target.dataset.ruleId) {
      const id = Number(e.target.dataset.ruleId);
      const enabled = e.target.checked;
      const res = await msgToggleRule(id, enabled);
      if (!res?.ok) {
        alert("Failed to toggle rule: " + (res?.error || "Unknown error"));
        // Revert the checkbox state
        e.target.checked = !enabled;
      }
      await loadRules();
    }
  });

  rulesListEl.addEventListener("click", async (e) => {
    const ruleId = e.target.dataset.ruleId;
    if (!ruleId) return;

    if (e.target.classList.contains("edit-btn")) {
      const rule = rules.find((r) => r.id === Number(ruleId));
      if (rule) {
        populateForm(rule);
        ruleForm.scrollIntoView({ behavior: "smooth" });
      }
    }

    if (e.target.classList.contains("delete-btn")) {
      if (confirm("Delete this rule?")) {
        await msgDeleteRule(Number(ruleId));
        await loadRules();
      }
    }
  });

  // Export/Import
  exportBtn.addEventListener("click", handleExport);
  importBtn.addEventListener("click", handleImportClick);
  importFile.addEventListener("change", handleImportFile);

  // Drag-and-drop reordering
  initDragAndDrop();
  initTabs();
}

// === Drag & Drop ===

let draggedEl = null;
let handleGrabbed = false;

function initDragAndDrop() {
  // Track mousedown on the drag handle to gate drag initiation
  rulesListEl.addEventListener("mousedown", (e) => {
    if (e.target.closest(".drag-handle")) {
      handleGrabbed = true;
      const ruleItem = e.target.closest(".rule-item");
      if (ruleItem) ruleItem.draggable = true;
    }
  });

  document.addEventListener("mouseup", () => {
    handleGrabbed = false;
    rulesListEl.querySelectorAll(".rule-item[draggable]").forEach((el) => {
      el.draggable = false;
    });
  });

  rulesListEl.addEventListener("dragstart", (e) => {
    const ruleItem = e.target.closest(".rule-item");
    if (!ruleItem || !handleGrabbed) {
      e.preventDefault();
      return;
    }
    draggedEl = ruleItem;
    ruleItem.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", ruleItem.dataset.ruleId);
  });

  rulesListEl.addEventListener("dragend", () => {
    if (draggedEl) {
      draggedEl.classList.remove("dragging");
      draggedEl.draggable = false;
      draggedEl = null;
    }
    handleGrabbed = false;
    rulesListEl.querySelectorAll(".rule-item.drag-over").forEach((el) =>
      el.classList.remove("drag-over")
    );
  });

  rulesListEl.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    const target = e.target.closest(".rule-item");
    if (!target || target === draggedEl) return;

    rulesListEl.querySelectorAll(".rule-item.drag-over").forEach((el) =>
      el.classList.remove("drag-over")
    );
    target.classList.add("drag-over");

    const rect = target.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    if (e.clientY < midY) {
      rulesListEl.insertBefore(draggedEl, target);
    } else {
      rulesListEl.insertBefore(draggedEl, target.nextSibling);
    }
  });

  rulesListEl.addEventListener("drop", async (e) => {
    e.preventDefault();
    rulesListEl.querySelectorAll(".rule-item.drag-over").forEach((el) =>
      el.classList.remove("drag-over")
    );

    // Only the current tab's rules are on screen: slot their new order into the full list
    const items = rulesListEl.querySelectorAll(".rule-item");
    const visibleIds = [...items].map((el) => Number(el.dataset.ruleId));
    const visible = new Set(visibleIds);
    let next = 0;
    const orderedIds = rules.map((r) => (visible.has(r.id) ? visibleIds[next++] : r.id));

    const res = await msgReorderRules(orderedIds);
    if (res?.ok) {
      await loadRules();
    }
  });
}

// Start
init();
