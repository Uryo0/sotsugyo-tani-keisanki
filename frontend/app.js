const fs = require("fs");
const path = require("path");

let subjects = [];
let requirements = {};
let selectedIds = [];

const saveKey = "sotsugyo-tani-keisanki-selected-ids";

// JSONファイルを読む
function readJson(filePath) {
  let text = fs.readFileSync(filePath, "utf8");
  text = text.replace(/^\uFEFF/, "");
  return JSON.parse(text);
}

// 最初にデータを読む
function loadData() {
  const rootPath = path.join(__dirname, "..");

  subjects = readJson(path.join(rootPath, "data", "subjects.json"));
  requirements = readJson(path.join(rootPath, "data", "requirements.json"));

  const savedText = localStorage.getItem(saveKey);

  if (savedText !== null) {
    selectedIds = JSON.parse(savedText);
  }
}

// 選択状態を保存する
function saveSelectedIds() {
  localStorage.setItem(saveKey, JSON.stringify(selectedIds));
}

// セレクトボックスを作る
function setupSelectOptions() {
  setOptions("categorySelect", getUniqueValues("category"));
  setOptions("subCategorySelect", getUniqueValues("sub_category"));
  setOptions("requirementSelect", getUniqueValues("requirement_type"));
}

// 重複しない値を取り出す
function getUniqueValues(key) {
  const values = [];

  for (const subject of subjects) {
    if (!values.includes(subject[key])) {
      values.push(subject[key]);
    }
  }

  return values;
}

// セレクトボックスに項目を入れる
function setOptions(selectId, values) {
  const select = document.getElementById(selectId);

  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }
}

// 表示する科目を絞り込む
function getFilteredSubjects() {
  const searchText = document.getElementById("searchInput").value.trim().toLowerCase();
  const category = document.getElementById("categorySelect").value;
  const subCategory = document.getElementById("subCategorySelect").value;
  const requirementType = document.getElementById("requirementSelect").value;
  const filteredSubjects = [];

  for (const subject of subjects) {
    const name = subject.name.toLowerCase();

    if (searchText !== "" && !name.includes(searchText)) {
      continue;
    }

    if (category !== "all" && subject.category !== category) {
      continue;
    }

    if (subCategory !== "all" && subject.sub_category !== subCategory) {
      continue;
    }

    if (requirementType !== "all" && subject.requirement_type !== requirementType) {
      continue;
    }

    filteredSubjects.push(subject);
  }

  return filteredSubjects;
}

// 科目一覧を表示する
function renderSubjects() {
  const tbody = document.getElementById("subjectTableBody");
  const filteredSubjects = getFilteredSubjects();
  let html = "";

  for (const subject of filteredSubjects) {
    const checked = selectedIds.includes(subject.id) ? "checked" : "";

    html += "<tr>";
    html += "<td class='check-column'><input class='subject-check' type='checkbox' data-id='" + subject.id + "' " + checked + "></td>";
    html += "<td>" + subject.name + "</td>";
    html += "<td>" + subject.credits + "</td>";
    html += "<td>" + subject.category + "</td>";
    html += "<td>" + subject.sub_category + "</td>";
    html += "<td>" + subject.field + "</td>";
    html += "<td>" + getRequirementBadge(subject.requirement_type) + "</td>";
    html += "</tr>";
  }

  tbody.innerHTML = html;

  const checkboxes = document.querySelectorAll(".subject-check");

  for (const checkbox of checkboxes) {
    checkbox.addEventListener("change", function () {
      toggleSubject(this.dataset.id, this.checked);
    });
  }

  document.getElementById("shownCount").textContent = "表示 " + filteredSubjects.length + "科目";
}

// 必選別の見た目を変える
function getRequirementBadge(requirementType) {
  if (requirementType === "必修") {
    return "<span class='badge badge-required'>必修</span>";
  }

  if (requirementType === "選択必修") {
    return "<span class='badge badge-choice-required'>選択必修</span>";
  }

  if (requirementType === "登録必須") {
    return "<span class='badge badge-register'>登録必須</span>";
  }

  return "<span class='badge badge-choice'>選択</span>";
}

// 科目を選択、解除する
function toggleSubject(subjectId, checked) {
  if (checked) {
    if (!selectedIds.includes(subjectId)) {
      selectedIds.push(subjectId);
    }
  } else {
    selectedIds = selectedIds.filter(function (id) {
      return id !== subjectId;
    });
  }

  saveSelectedIds();
  renderResult();
}

// 計算結果を表示する
function renderResult() {
  const result = calculateResult(subjects, selectedIds, requirements);

  document.getElementById("totalCredits").textContent = result.totalCredits;
  document.getElementById("selectedCount").textContent = "選択中 " + result.selectedCount + "科目";

  const status = document.getElementById("graduationStatus");

  if (result.graduationOk) {
    status.textContent = "卒業要件達成";
    status.className = "status-text status-ok";
  } else {
    status.textContent = "未達成";
    status.className = "status-text status-ng";
  }

  renderRequirementList(result.checks);
  renderMissingRequired(result.missingRequiredSubjects);
  renderWarnings(result.missingRegisterSubjects);
}

// 要件の一覧を表示する
function renderRequirementList(checks) {
  const area = document.getElementById("requirementList");
  let html = "";

  for (const check of checks) {
    const className = check.ok ? "ok" : "ng";
    const percent = Math.min(100, Math.round((check.earned / check.required) * 100));

    html += "<div class='requirement-item " + className + "'>";
    html += "<div class='requirement-head'>";
    html += "<span class='requirement-name'>" + check.name + "</span>";
    html += "<span class='requirement-number'>" + check.earned + " / " + check.required + " 単位</span>";
    html += "</div>";
    html += "<div class='progress-bar'><div class='progress-fill' style='width: " + percent + "%'></div></div>";
    html += "</div>";
  }

  area.innerHTML = html;
}

// 未修得の必修科目を表示する
function renderMissingRequired(missingSubjects) {
  const list = document.getElementById("missingRequiredList");

  if (missingSubjects.length === 0) {
    list.innerHTML = "<li>なし</li>";
    return;
  }

  let html = "";

  for (const subject of missingSubjects) {
    html += "<li>" + subject.name + "（" + subject.credits + "単位）</li>";
  }

  list.innerHTML = html;
}

// 注意を表示する
function renderWarnings(missingRegisterSubjects) {
  const list = document.getElementById("warningList");
  let html = "";

  for (const subject of missingRegisterSubjects) {
    html += "<li>登録必須: " + subject.name + "</li>";
  }

  if (html === "") {
    html = "<li>なし</li>";
  }

  list.innerHTML = html;
}

// JSONファイルとして保存する
function exportProgress() {
  const data = {
    selectedIds: selectedIds,
    savedAt: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = "卒業単位計算機-保存データ.json";
  a.click();

  URL.revokeObjectURL(url);
}

// JSONファイルから読み込む
function importProgress(file) {
  const reader = new FileReader();

  reader.onload = function () {
    const data = JSON.parse(reader.result);

    if (Array.isArray(data.selectedIds)) {
      selectedIds = data.selectedIds;
      saveSelectedIds();
      renderSubjects();
      renderResult();
    }
  };

  reader.readAsText(file);
}

// ボタンなどの動きを設定する
function setupEvents() {
  document.getElementById("searchInput").addEventListener("input", renderSubjects);
  document.getElementById("categorySelect").addEventListener("change", renderSubjects);
  document.getElementById("subCategorySelect").addEventListener("change", renderSubjects);
  document.getElementById("requirementSelect").addEventListener("change", renderSubjects);

  document.getElementById("saveButton").addEventListener("click", function () {
    saveSelectedIds();
    alert("保存しました");
  });

  document.getElementById("exportButton").addEventListener("click", exportProgress);

  document.getElementById("importInput").addEventListener("change", function () {
    if (this.files.length > 0) {
      importProgress(this.files[0]);
    }
  });

  document.getElementById("clearButton").addEventListener("click", function () {
    if (confirm("選択をすべてクリアしますか？")) {
      selectedIds = [];
      saveSelectedIds();
      renderSubjects();
      renderResult();
    }
  });
}

loadData();
setupSelectOptions();
setupEvents();
renderSubjects();
renderResult();