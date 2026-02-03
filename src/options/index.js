// src/options/index.js
// Resurrector Options Page

import {
  msgListRules,
  msgAddRule,
  msgUpdateRule,
  msgDeleteRule,
  msgToggleRule,
  msgExportRules,
  msgImportRules,
  msgGetEnabled,
  msgSetEnabled,
} from "../shared/storage.js";

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

let rules = [];

// === Initialization ===

async function init() {
  await loadEnabled();
  await loadRules();
  attachEventListeners();
}

// === State Management ===

async function loadEnabled() {
  const res = await msgGetEnabled();
  if (res?.ok) {
    masterToggle.checked = res.enabled;
  }
}

async function loadRules() {
  const res = await msgListRules();
  if (res?.ok) {
    rules = res.rules;
    renderRules();
  }
}

// === UI Updates ===

function renderRules() {
  if (rules.length === 0) {
    rulesListEl.innerHTML = `
      <div class="empty-state">
        <p>No redirect rules yet. Add your first rule above!</p>
      </div>
    `;
    return;
  }

  rulesListEl.innerHTML = "";
  rules.forEach((rule) => {
    const ruleEl = createRuleElement(rule);
    rulesListEl.appendChild(ruleEl);
  });
}

function createRuleElement(rule) {
  const div = document.createElement("div");
  div.className = `rule-item ${rule.enabled === false ? "disabled" : ""}`;
  div.dataset.ruleId = rule.id;

  const typeLabel = rule.type === "regex" ? "Regex" : "Wildcard";

  div.innerHTML = `
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
      <span class="rule-type-badge">${typeLabel}</span>
    </div>
    <div class="rule-actions">
      <button class="edit-btn" data-rule-id="${rule.id}" title="Edit">Edit</button>
      <button class="delete-btn" data-rule-id="${rule.id}" title="Delete">Delete</button>
    </div>
  `;

  return div;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

// === Form Management ===

function resetForm() {
  editRuleId.value = "";
  ruleName.value = "";
  ruleFrom.value = "";
  ruleTo.value = "";
  ruleRegex.checked = false;
  formTitle.textContent = "Add New Rule";
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
  const rule = {
    name: ruleName.value.trim(),
    from: ruleFrom.value.trim(),
    type: isRegex ? "regex" : "wildcard",
  };

  if (isRegex) {
    rule.regexSubstitution = ruleTo.value.trim();
  } else {
    rule.to = ruleTo.value.trim();
  }

  const editId = editRuleId.value;

  if (editId) {
    // Update existing rule
    rule.id = Number(editId);
    const res = await msgUpdateRule(rule);
    if (res?.ok) {
      showFeedback(saveBtn, "Saved!", "#10b981");
      resetForm();
      await loadRules();
    }
  } else {
    // Add new rule
    const res = await msgAddRule(rule);
    if (res?.ok) {
      showFeedback(saveBtn, "Added!", "#10b981");
      resetForm();
      await loadRules();
    }
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

/**
 * Convert Redirector extension format to Resurrector format
 * Redirector uses: { redirects: [{ includePattern, redirectUrl, patternType, description, disabled }] }
 */
function convertRedirectorFormat(data) {
  if (!data.redirects || !Array.isArray(data.redirects)) {
    return null;
  }

  return data.redirects.map((r) => {
    const isRegex = r.patternType === "R";
    const rule = {
      name: r.description || "Imported Rule",
      from: r.includePattern || "",
      type: isRegex ? "regex" : "wildcard",
      enabled: !r.disabled,
    };

    if (isRegex) {
      rule.regexSubstitution = r.redirectUrl || "";
    } else {
      // Convert Redirector wildcard syntax ($1, $2) to static URL
      // For simple cases, just use the redirect URL as-is
      rule.to = r.redirectUrl || "";
    }

    return rule;
  });
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
      await msgToggleRule(id, enabled);
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
}

// Start
init();
