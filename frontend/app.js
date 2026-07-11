const fs = require("fs");
const path = require("path");

let baseSubjects = [];
let customSubjects = [];
let subjects = [];
let requirements = {};
let selectedIds = [];
let mainLanguage = "英語";

const saveKey = "sotsugyo-tani-keisanki-selected-ids";
const languageSaveKey = "sotsugyo-tani-keisanki-main-language";
const customSubjectsKey = "sotsugyo-tani-keisanki-custom-subjects";

// JSONファイルを読む
function readJson(filePath) {
  let text = fs.readFileSync(filePath, "utf8");
  text = text.replace(/^\uFEFF/, "");
  return JSON.parse(text);
}

// 画面に文字を出す時の安全対策
function escapeHtml(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// add001 のようなIDを作る
function makeAddId(number) {
  return "add" + String(number).padStart(3, "0");
}

// 最初にデータを読む
function loadData() {
  const rootPath = path.join(__dirname, "..");

  baseSubjects = readJson(path.join(rootPath, "data", "subjects.json"));
  requirements = readJson(path.join(rootPath, "data", "requirements.json"));

  const savedText = localStorage.getItem(saveKey);
  const savedLanguage = localStorage.getItem(languageSaveKey);
  const savedCustomSubjects = localStorage.getItem(customSubjectsKey);

  if (savedText !== null) {
    selectedIds = JSON.parse(savedText);
  }

  if (savedLanguage !== null) {
    mainLanguage = savedLanguage;
  }

  if (savedCustomSubjects !== null) {
    customSubjects = JSON.parse(savedCustomSubjects);
  }

  renumberCustomSubjects();
  rebuildSubjects();
  cleanSelectedIds();
  saveAllData();
}

// 元の科目と追加科目を合わせる
function rebuildSubjects() {
  subjects = baseSubjects.concat(customSubjects);
}

// 選択状態を保存する
function saveSelectedIds() {
  localStorage.setItem(saveKey, JSON.stringify(selectedIds));
}

// メイン外国語を保存する
function saveMainLanguage() {
  localStorage.setItem(languageSaveKey, mainLanguage);
}

// 追加科目を保存する
function saveCustomSubjects() {
  localStorage.setItem(customSubjectsKey, JSON.stringify(customSubjects));
}

// 必要なデータをまとめて保存する
function saveAllData() {
  saveSelectedIds();
  saveMainLanguage();
  saveCustomSubjects();
}

// 存在しないIDを選択状態から外す
function cleanSelectedIds() {
  const subjectIds = [];
  const newSelectedIds = [];

  for (const subject of subjects) {
    subjectIds.push(subject.id);
  }

  for (const id of selectedIds) {
    if (subjectIds.includes(id) && !newSelectedIds.includes(id)) {
      newSelectedIds.push(id);
    }
  }

  selectedIds = newSelectedIds;
}

// 追加科目のIDを add001 から順に振り直す
function renumberCustomSubjects() {
  const idMap = {};

  for (let i = 0; i < customSubjects.length; i++) {
    const oldId = customSubjects[i].id;
    const newId = makeAddId(i + 1);

    idMap[oldId] = newId;
    customSubjects[i].id = newId;
  }

  for (let i = 0; i < selectedIds.length; i++) {
    if (idMap[selectedIds[i]] !== undefined) {
      selectedIds[i] = idMap[selectedIds[i]];
    }
  }
}

// 画面を切り替える
function showView(viewName) {
  document.getElementById("mainView").classList.add("hidden-view");
  document.getElementById("addView").classList.add("hidden-view");
  document.getElementById("deleteView").classList.add("hidden-view");

  if (viewName === "add") {
    document.getElementById("addView").classList.remove("hidden-view");
    setMessage("addMessage", "");
    return;
  }

  if (viewName === "delete") {
    document.getElementById("deleteView").classList.remove("hidden-view");
    setMessage("deleteMessage", "");
    renderDeleteSubjects();
    return;
  }

  document.getElementById("mainView").classList.remove("hidden-view");
  renderSubjects();
  renderResult();
}

// メッセージを表示する
function setMessage(id, text) {
  const area = document.getElementById(id);
  area.textContent = text;

  if (text === "") {
    area.classList.remove("show-message");
  } else {
    area.classList.add("show-message");
  }
}

// セレクトボックスを作る
function setupSelectOptions() {
  setupFilterSelect("categorySelect", getUniqueValues("category"), "すべての分類");
  setupFilterSelect("subCategorySelect", getUniqueValues("sub_category"), "すべての区分");
  setupFilterSelect("requirementSelect", getUniqueValues("requirement_type"), "すべての必選別");
  setupMainLanguageOptions();
  setupAddSubjectOptions();
}

// フィルター用のセレクトボックスを作る
function setupFilterSelect(selectId, values, allText) {
  const select = document.getElementById(selectId);
  const currentValue = select.value || "all";

  select.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = allText;
  select.appendChild(allOption);

  addOptions(select, values);

  if (hasOption(select, currentValue)) {
    select.value = currentValue;
  } else {
    select.value = "all";
  }
}

// 追加フォームのセレクトボックスを作る
function setupAddSubjectOptions() {
  setupPlainSelect("addCreditsSelect", getCreditValues());
  setupPlainSelect("addCategorySelect", getUniqueValues("category"));
  setupPlainSelect("addSubCategorySelect", getUniqueValues("sub_category"));
  setupFieldSelect();
  setupPlainSelect("addRequirementSelect", getUniqueValues("requirement_type"));
  setupPlainSelect("addClassTypeSelect", getUniqueValues("class_type"));
}

// 普通のセレクトボックスを作る
function setupPlainSelect(selectId, values) {
  const select = document.getElementById(selectId);
  const currentValue = select.value;

  select.innerHTML = "";
  addOptions(select, values);

  if (hasOption(select, currentValue)) {
    select.value = currentValue;
  }
}

// 分野のセレクトボックスを作る
function setupFieldSelect() {
  const select = document.getElementById("addFieldSelect");
  const currentValue = select.value;

  select.innerHTML = "";
  addOptions(select, getUniqueValues("field"));

  const newOption = document.createElement("option");
  newOption.value = "__new__";
  newOption.textContent = "新しく追加";
  select.appendChild(newOption);

  if (hasOption(select, currentValue)) {
    select.value = currentValue;
  }

  updateNewFieldInput();
}

// セレクトボックスに項目を入れる
function addOptions(select, values) {
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }
}

// セレクトボックスに指定した値があるか調べる
function hasOption(select, value) {
  for (const option of select.options) {
    if (option.value === value) {
      return true;
    }
  }

  return false;
}

// 重複しない値を取り出す
function getUniqueValues(key) {
  const values = [];

  for (const subject of subjects) {
    const value = subject[key];

    if (value !== null && value !== undefined && value !== "" && !values.includes(value)) {
      values.push(value);
    }
  }

  return values;
}

// 単位数の選択肢を取り出す
function getCreditValues() {
  const values = getUniqueValues("credits");

  values.sort(function (a, b) {
    return Number(a) - Number(b);
  });

  return values;
}

// メイン外国語の選択肢を作る
function setupMainLanguageOptions() {
  const select = document.getElementById("mainLanguageSelect");
  const currentValue = mainLanguage;
  const languages = getLanguageValues();

  select.innerHTML = "";

  for (const language of languages) {
    const option = document.createElement("option");
    option.value = language;
    option.textContent = "メイン外国語: " + language;
    select.appendChild(option);
  }

  if (hasOption(select, currentValue)) {
    select.value = currentValue;
  } else if (languages.length > 0) {
    mainLanguage = languages[0];
    select.value = mainLanguage;
  }
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

  for (const subject of subjects) {
    if (subject.sub_category === "外国語" && subject.requirement_type === "選択必修") {
      const language = getLanguageName(subject);

      if (!values.includes(language)) {
        values.push(language);
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
    const oldName = subject.old_name === null ? "" : subject.old_name;
    const searchTarget = (subject.name + " " + oldName).toLowerCase();

    if (searchText !== "" && !searchTarget.includes(searchText)) {
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
    const rowClass = isCustomSubject(subject.id) ? " class='added-subject-row'" : "";

    html += "<tr" + rowClass + ">";
    html += "<td class='check-column'><input class='subject-check' type='checkbox' data-id='" + escapeHtml(subject.id) + "' " + checked + "></td>";
    html += "<td>" + escapeHtml(subject.name) + "</td>";
    html += "<td>" + escapeHtml(subject.credits) + "</td>";
    html += "<td>" + escapeHtml(subject.category) + "</td>";
    html += "<td>" + escapeHtml(subject.sub_category) + "</td>";
    html += "<td>" + escapeHtml(subject.field) + "</td>";
    html += "<td>" + getRequirementBadge(subject.requirement_type) + "</td>";
    html += "<td>" + escapeHtml(subject.class_type) + "</td>";
    html += "<td>" + escapeHtml(subject.old_name) + "</td>";
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

// 削除画面の追加科目を表示する
function renderDeleteSubjects() {
  const tbody = document.getElementById("deleteSubjectTableBody");
  let html = "";

  if (customSubjects.length === 0) {
    tbody.innerHTML = "<tr><td colspan='9'>追加した科目はありません</td></tr>";
    return;
  }

  for (const subject of customSubjects) {
    html += "<tr class='added-subject-row'>";
    html += "<td class='check-column'><input class='delete-subject-check' type='checkbox' data-id='" + escapeHtml(subject.id) + "'></td>";
    html += "<td>" + escapeHtml(subject.name) + "</td>";
    html += "<td>" + escapeHtml(subject.credits) + "</td>";
    html += "<td>" + escapeHtml(subject.category) + "</td>";
    html += "<td>" + escapeHtml(subject.sub_category) + "</td>";
    html += "<td>" + escapeHtml(subject.field) + "</td>";
    html += "<td>" + getRequirementBadge(subject.requirement_type) + "</td>";
    html += "<td>" + escapeHtml(subject.class_type) + "</td>";
    html += "<td>" + escapeHtml(subject.old_name) + "</td>";
    html += "</tr>";
  }

  tbody.innerHTML = html;
}

// 追加科目かどうか調べる
function isCustomSubject(subjectId) {
  return subjectId.startsWith("add");
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

// 追加フォームの分野入力欄を切り替える
function updateNewFieldInput() {
  const fieldSelect = document.getElementById("addFieldSelect");
  const newFieldLabel = document.getElementById("newFieldLabel");

  if (fieldSelect.value === "__new__") {
    newFieldLabel.classList.remove("hidden-field");
  } else {
    newFieldLabel.classList.add("hidden-field");
  }
}

// 科目を追加する
function addSubject() {
  const name = document.getElementById("addNameInput").value.trim();
  const credits = Number(document.getElementById("addCreditsSelect").value);
  const category = document.getElementById("addCategorySelect").value;
  const subCategory = document.getElementById("addSubCategorySelect").value;
  const requirementType = document.getElementById("addRequirementSelect").value;
  const classType = document.getElementById("addClassTypeSelect").value;
  const oldNameInput = document.getElementById("addOldNameInput").value.trim();
  let field = document.getElementById("addFieldSelect").value;

  if (name === "") {
    setMessage("addMessage", "科目名を入力してください");
    return;
  }

  if (field === "__new__") {
    field = document.getElementById("addNewFieldInput").value.trim();

    if (field === "") {
      setMessage("addMessage", "新しい分野を入力してください");
      return;
    }
  }

  const subject = {
    id: makeAddId(customSubjects.length + 1),
    name: name,
    credits: credits,
    requirement_type: requirementType,
    category: category,
    sub_category: subCategory,
    field: field,
    class_type: classType,
    old_name: oldNameInput === "" ? null : oldNameInput
  };

  customSubjects.push(subject);
  rebuildSubjects();
  saveCustomSubjects();
  clearAddForm();
  setupSelectOptions();
  renderSubjects();
  renderResult();
  setMessage("addMessage", "科目を追加しました");
}

// 追加フォームを空にする
function clearAddForm() {
  document.getElementById("addNameInput").value = "";
  document.getElementById("addOldNameInput").value = "";
  document.getElementById("addNewFieldInput").value = "";
}

// 選択した追加科目を削除する
function deleteSelectedAddedSubjects() {
  const checks = document.querySelectorAll(".delete-subject-check");
  const deleteIds = [];

  for (const check of checks) {
    if (check.checked) {
      deleteIds.push(check.dataset.id);
    }
  }

  if (deleteIds.length === 0) {
    setMessage("deleteMessage", "削除する追加科目を選択してください");
    return;
  }

  const idMap = {};
  const newCustomSubjects = [];
  let nextNumber = 1;

  for (const subject of customSubjects) {
    if (deleteIds.includes(subject.id)) {
      continue;
    }

    const oldId = subject.id;
    const newSubject = Object.assign({}, subject);

    newSubject.id = makeAddId(nextNumber);
    idMap[oldId] = newSubject.id;
    newCustomSubjects.push(newSubject);
    nextNumber++;
  }

  customSubjects = newCustomSubjects;
  selectedIds = updateSelectedIdsAfterDelete(deleteIds, idMap);

  rebuildSubjects();
  cleanSelectedIds();
  saveAllData();
  setupSelectOptions();
  renderSubjects();
  renderResult();
  renderDeleteSubjects();
  setMessage("deleteMessage", "追加科目を削除しました");
}

// 削除後に選択中IDも直す
function updateSelectedIdsAfterDelete(deleteIds, idMap) {
  const newSelectedIds = [];

  for (const id of selectedIds) {
    if (deleteIds.includes(id)) {
      continue;
    }

    if (idMap[id] !== undefined) {
      newSelectedIds.push(idMap[id]);
    } else {
      newSelectedIds.push(id);
    }
  }

  return newSelectedIds;
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
    html += "<li>" + escapeHtml(subject.name) + "（" + escapeHtml(subject.credits) + "単位）</li>";
  }

  list.innerHTML = html;
}

// 注意を表示する
function renderWarnings(missingRegisterSubjects) {
  const list = document.getElementById("warningList");
  let html = "";

  for (const subject of missingRegisterSubjects) {
    html += "<li>登録必須: " + escapeHtml(subject.name) + "</li>";
  }

  if (html === "") {
    html = "<li>なし</li>";
  }

  list.innerHTML = html;
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

  document.getElementById("openAddViewButton").addEventListener("click", function () {
    showView("add");
  });

  document.getElementById("openDeleteViewButton").addEventListener("click", function () {
    showView("delete");
  });

  document.getElementById("backFromAddButton").addEventListener("click", function () {
    showView("main");
  });

  document.getElementById("backFromDeleteButton").addEventListener("click", function () {
    showView("main");
  });

  document.getElementById("addFieldSelect").addEventListener("change", updateNewFieldInput);
  document.getElementById("addSubjectButton").addEventListener("click", addSubject);
  document.getElementById("deleteAddedSubjectButton").addEventListener("click", deleteSelectedAddedSubjects);

  document.getElementById("saveButton").addEventListener("click", function () {
    saveAllData();
    alert("保存しました");
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
showView("main");