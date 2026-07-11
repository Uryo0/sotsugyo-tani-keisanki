const fs = require("fs");
const path = require("path");

let subjects = [];
let requirements = {};
let selectedIds = [];
let mainLanguage = "英語";

const saveKey = "sotsugyo-tani-keisanki-selected-ids";
const languageSaveKey = "sotsugyo-tani-keisanki-main-language";

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
  const savedLanguage = localStorage.getItem(languageSaveKey);

  if (savedText !== null) {
    selectedIds = JSON.parse(savedText);
  }

  if (savedLanguage !== null) {
    mainLanguage = savedLanguage;
  }
}

// 選択状態を保存する
function saveSelectedIds() {
  localStorage.setItem(saveKey, JSON.stringify(selectedIds));
}

// メイン外国語を保存する
function saveMainLanguage() {
  localStorage.setItem(languageSaveKey, mainLanguage);
}

// セレクトボックスを作る
function setupSelectOptions() {
  setOptions("categorySelect", getUniqueValues("category"));
  setOptions("subCategorySelect", getUniqueValues("sub_category"));
  setOptions("requirementSelect", getUniqueValues("requirement_type"));
  setupMainLanguageOptions();
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

// メイン外国語の選択肢を作る
function setupMainLanguageOptions() {
  const select = document.getElementById("mainLanguageSelect");
  const languages = getLanguageValues();

  for (const language of languages) {
    const option = document.createElement("option");
    option.value = language;
    option.textContent = "メイン外国語: " + language;
    select.appendChild(option);
  }

  select.value = mainLanguage;
}

// 科目データから外国語を取り出す
function getLanguageValues() {
  const values = [];
  const order = ["英語", "ドイツ語", "フランス語", "中国語", "スペイン語", "ロシア語"];

  for (const language of order) {
    for (const subject of subjects) {
      if (subject.sub_category === "外国語" && subject.requirement_type === "選択必修") {
        if (getLanguageName(subject) === language && !values.includes(language)) {
          values.push(language);
        }
      }
    }
  }

  return values;
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
  const result = calculateResult(subjects, selectedIds, requirements, mainLanguage);

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
function findCheck(checks, name) {
  for (const check of checks) {
    if (check.name === name) {
      return check;
    }

    if (name === "同一外国語" && check.name.startsWith("同一外国語")) {
      return check;
    }
  }

  return null;
}

// 画面に出す正式な名前と説明
const requirementText = {
  "教養・保健体育": {
    label: "教養科目・保健体育科目"
  },
  "教養必修": {
    label: "教養科目の必修科目",
    description: "「キリスト教学」「キリスト教学（技術者としての倫理）」「フレッシャーズセミナ」"
  },
  "教養選択必修": {
    label: "教養科目の選択必修科目",
    description: "※２単位を超えて修得した場合は、自主選択学修の単位数となる。"
  },
  "外国語": {
    label: "外国語科目"
  },
  "必修英語": {
    label: "外国語科目の必修科目",
    description: "「総合英語（リーディング）」「総合英語（ライティング）」「総合英語（リスニング）」「総合英語（オーラルコミュニケーション）」"
  },
  "同一外国語": {
    label: "同一外国語科目",
    description: "英語又はその他の外国語科目の選択必修科目から同一語科目"
  },
  "専門基幹・専門基礎": {
    label: "専門基幹科目・専門基礎科目"
  },
  "専門基幹・専門基礎の必修": {
    label: "専門基幹科目・専門基礎科目の必修科目",
    description: "「KGU情報基礎演習」「理工学概論」「フレッシャーズプロジェクト」「理工学基礎実験Ⅰ」"
  },
  "数学分野の選択必修": {
    label: "数学分野の選択必修科目",
    description: "専門基幹科目数学分野の選択必修科目から"
  },
  "専門基幹・専門基礎の選択": {
    label: "専門基幹科目・専門基礎科目の選択科目",
    description: "専門基幹科目及び専門基礎科目から"
  },
  "専門応用": {
    label: "専門応用科目"
  },
  "専門応用の必修": {
    label: "専門応用科目の必修科目",
    description: "情報ネット・メディアコース専門応用科目の必修科目"
  },
  "プログラミング選択必修": {
    label: "プログラミング分野の選択必修科目",
    description: "情報ネット・メディアコース専門応用科目「プログラミング」分野の選択必修科目から"
  },
  "専門応用の選択": {
    label: "専門応用科目の選択科目",
    description: "情報ネット・メディアコース専門応用科目（登録必須科目含む）から"
  },
  "理工学科専門応用": {
    label: "理工学科専門応用科目",
    description: "理工学部理工学科専門応用科目から"
  }
};

// 画面用の名前と説明を取り出す
function getRequirementText(checkName) {
  if (checkName.startsWith("同一外国語")) {
    return requirementText["同一外国語"];
  }

  if (requirementText[checkName] !== undefined) {
    return requirementText[checkName];
  }

  return {
    label: checkName,
    description: ""
  };
}

// 1つの要件を表示する
function renderRequirementItem(check, className) {
  if (check === null) {
    return "";
  }

  const okClass = check.ok ? "ok" : "ng";
  const percent = Math.min(100, Math.round((check.earned / check.required) * 100));
  const text = getRequirementText(check.name);

  let html = "";
  html += "<div class='requirement-item " + okClass + " " + className + "'>";
  html += "<div class='requirement-head'>";
  html += "<span class='requirement-name'>" + text.label + "</span>";
  html += "<span class='requirement-number'>" + check.earned + " / " + check.required + " 単位</span>";
  html += "</div>";

  if (text.description !== undefined && text.description !== "") {
    html += "<p class='requirement-description'>" + text.description + "</p>";
  }

  html += "<div class='progress-bar'><div class='progress-fill' style='width: " + percent + "%'></div></div>";
  html += "</div>";

  return html;
}

// 小さい要件をまとめて表示する
function renderChildItems(checks, names) {
  let html = "";

  for (const name of names) {
    html += renderRequirementItem(findCheck(checks, name), "requirement-child");
  }

  return html;
}
// 要件の一覧を階層で表示する
function renderRequirementList(checks) {
  const area = document.getElementById("requirementList");
  let html = "";

  html += renderRequirementItem(findCheck(checks, "総単位"), "requirement-summary");

  html += "<div class='requirement-section'>";
  html += renderRequirementItem(findCheck(checks, "共通科目"), "requirement-summary");
  html += "<div class='requirement-subsection'>";
  html += renderRequirementItem(findCheck(checks, "教養・保健体育"), "requirement-middle");
  html += renderChildItems(checks, ["教養必修", "教養選択必修", "教養・保健体育の選択"]);
  html += "</div>";
  html += "<div class='requirement-subsection'>";
  html += renderRequirementItem(findCheck(checks, "外国語"), "requirement-middle");
  html += renderChildItems(checks, ["必修英語", "同一外国語"]);
  html += "</div>";
  html += "</div>";

  html += "<div class='requirement-section'>";
  html += renderRequirementItem(findCheck(checks, "専門科目"), "requirement-summary");
  html += "<div class='requirement-subsection'>";
  html += renderRequirementItem(findCheck(checks, "専門基幹・専門基礎"), "requirement-middle");
  html += renderChildItems(checks, ["専門基幹・専門基礎の必修", "数学分野の選択必修", "専門基幹・専門基礎の選択"]);
  html += "</div>";
  html += "<div class='requirement-subsection'>";
  html += renderRequirementItem(findCheck(checks, "専門応用"), "requirement-middle");
  html += renderChildItems(checks, ["専門応用の必修", "プログラミング選択必修", "専門応用の選択", "理工学科専門応用"]);
  html += "</div>";
  html += "</div>";

  html += renderRequirementItem(findCheck(checks, "自主選択学修"), "requirement-summary");

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
    mainLanguage: mainLanguage,
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
    }

    if (typeof data.mainLanguage === "string") {
      mainLanguage = data.mainLanguage;
      document.getElementById("mainLanguageSelect").value = mainLanguage;
    }

    saveSelectedIds();
    saveMainLanguage();
    renderSubjects();
    renderResult();
  };

  reader.readAsText(file);
}

// ボタンなどの動きを設定する
function setupEvents() {
  document.getElementById("searchInput").addEventListener("input", renderSubjects);
  document.getElementById("categorySelect").addEventListener("change", renderSubjects);
  document.getElementById("subCategorySelect").addEventListener("change", renderSubjects);
  document.getElementById("requirementSelect").addEventListener("change", renderSubjects);

  document.getElementById("mainLanguageSelect").addEventListener("change", function () {
    mainLanguage = this.value;
    saveMainLanguage();
    renderResult();
  });

  document.getElementById("saveButton").addEventListener("click", function () {
    saveSelectedIds();
    saveMainLanguage();
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