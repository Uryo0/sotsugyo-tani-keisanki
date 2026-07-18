const fs = require("fs");
const path = require("path");

let baseSubjects = [];
let customSubjects = [];
let subjects = [];
let requirements = {};
let selectedIds = [];
let inProgressIds = [];
let plannedIds = [];
let mainLanguage = "英語";
let creditDisplayMode = "completed";
let previousPercents = {};
let choiceCandidateFilter = "";
let requirementSubjectFilter = "";
let creditDisplayRenderTimer = null;

const dataVersion = 1;
const stateSaveKey = "sotsugyo-tani-keisanki-state";
const saveKey = "sotsugyo-tani-keisanki-selected-ids";
const languageSaveKey = "sotsugyo-tani-keisanki-main-language";
const customSubjectsKey = "sotsugyo-tani-keisanki-custom-subjects";
let addCounter = 0;

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

// add001 の番号部分を取り出す
function getAddNumber(id) {
  const match = String(id).match(/^add(\d+)$/);

  if (match === null) {
    return 0;
  }

  return Number(match[1]);
}

// 追加科目IDの一番大きい番号を調べる
function getMaxAddNumber() {
  let maxNumber = 0;

  for (const subject of customSubjects) {
    maxNumber = Math.max(maxNumber, getAddNumber(subject.id));
  }

  return maxNumber;
}

// 同じIDがすでにあるか調べる
function subjectIdExists(id) {
  for (const subject of baseSubjects.concat(customSubjects)) {
    if (subject.id === id) {
      return true;
    }
  }

  return false;
}

// add001 のようなIDを作る。削除しても番号は戻さない。
function makeAddId() {
  let id = "";

  do {
    addCounter++;
    id = "add" + String(addCounter).padStart(3, "0");
  } while (subjectIdExists(id));

  return id;
}

// JSONを安全に読み込む
function parseSavedJson(text, defaultValue) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return defaultValue;
  }
}

// 最初にデータを読む
function loadData() {
  const rootPath = path.join(__dirname, "..");

  baseSubjects = readJson(path.join(rootPath, "data", "subjects.json"));
  requirements = readJson(path.join(rootPath, "data", "requirements.json"));

  loadState();
  rebuildSubjects();
  cleanCourseStatusIds();
  saveAllData();
}

// 保存済みデータを読む
function loadState() {
  const savedStateText = localStorage.getItem(stateSaveKey);

  if (savedStateText !== null) {
    const state = parseSavedJson(savedStateText, null);

    if (state !== null && state.dataVersion === dataVersion) {
      applyState(state);
      return;
    }

    resetState();
    return;
  }

  loadOldState();
}

// 古い保存形式から読む
function loadOldState() {
  const savedText = localStorage.getItem(saveKey);
  const savedLanguage = localStorage.getItem(languageSaveKey);
  const savedCustomSubjects = localStorage.getItem(customSubjectsKey);

  if (savedText !== null) {
    const oldSelectedIds = parseSavedJson(savedText, []);

    if (Array.isArray(oldSelectedIds)) {
      selectedIds = oldSelectedIds;
    }
  }

  if (savedLanguage !== null) {
    mainLanguage = savedLanguage;
  }

  if (savedCustomSubjects !== null) {
    const oldCustomSubjects = parseSavedJson(savedCustomSubjects, []);

    if (Array.isArray(oldCustomSubjects)) {
      customSubjects = oldCustomSubjects;
    }
  }

  addCounter = getMaxAddNumber();
}

// 保存データを初期状態に戻す
function resetState() {
  selectedIds = [];
  inProgressIds = [];
  plannedIds = [];
  mainLanguage = "英語";
  creditDisplayMode = "completed";
  customSubjects = [];
  addCounter = 0;
}

// 保存済みデータを画面用の変数に入れる
function applyState(state) {
  if (Array.isArray(state.selectedIds)) {
    selectedIds = state.selectedIds;
  }

  if (Array.isArray(state.inProgressIds)) {
    inProgressIds = state.inProgressIds;
  }

  if (Array.isArray(state.plannedIds)) {
    plannedIds = state.plannedIds;
  }

  if (typeof state.mainLanguage === "string") {
    mainLanguage = state.mainLanguage;
  }

  if (state.creditDisplayMode === "completed" || state.creditDisplayMode === "forecast") {
    creditDisplayMode = state.creditDisplayMode;
  }

  if (Array.isArray(state.customSubjects)) {
    customSubjects = state.customSubjects;
  }

  addCounter = Math.max(Number(state.addCounter) || 0, getMaxAddNumber());
}

// 元の科目と追加科目を合わせる
function rebuildSubjects() {
  subjects = baseSubjects.concat(customSubjects);
}

// 保存するデータを1つにまとめる
function makeState() {
  return {
    dataVersion: dataVersion,
    selectedIds: selectedIds,
    inProgressIds: inProgressIds,
    plannedIds: plannedIds,
    mainLanguage: mainLanguage,
    creditDisplayMode: creditDisplayMode,
    customSubjects: customSubjects,
    addCounter: addCounter
  };
}

// 保存する
function saveState() {
  localStorage.setItem(stateSaveKey, JSON.stringify(makeState()));
}

// 選択状態を保存する
function saveSelectedIds() {
  saveState();
}

// メイン外国語を保存する
function saveMainLanguage() {
  saveState();
}

// 追加科目を保存する
function saveCustomSubjects() {
  saveState();
}

// 必要なデータをまとめて保存する
function saveAllData() {
  saveState();
}

// 存在しないIDを履修状況から外す
function cleanStatusList(ids, subjectIds, usedIds) {
  const cleanIds = [];

  for (const id of ids) {
    if (subjectIds.includes(id) && !cleanIds.includes(id) && !usedIds.includes(id)) {
      cleanIds.push(id);
      usedIds.push(id);
    }
  }

  return cleanIds;
}

// 履修状況を安全な状態に整える
function cleanCourseStatusIds() {
  const subjectIds = [];
  const usedIds = [];

  for (const subject of subjects) {
    subjectIds.push(subject.id);
  }

  selectedIds = cleanStatusList(selectedIds, subjectIds, usedIds);
  inProgressIds = cleanStatusList(inProgressIds, subjectIds, usedIds);
  plannedIds = cleanStatusList(plannedIds, subjectIds, usedIds);
}


// 対象年度を表示する
function renderTargetInfo() {
  const target = document.getElementById("targetInfo");

  if (target === null) {
    return;
  }

  const targetYears = requirements.target_years || requirements.studentYear || "";
  const targetCourse = requirements.course || "";
  target.textContent = "対象: " + targetYears + " " + targetCourse + "生";
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
  setupFilterSelect("courseSelect", getUniqueValues("course"), "すべてのコース");
  setupFilterSelect("requirementSelect", getUniqueValues("requirement_type"), "すべての必選別");
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
  setupCourseSelect();
  setupFieldSelect();
  setupPlainSelect("addRequirementSelect", getUniqueValues("requirement_type"));
  setupPlainSelect("addClassTypeSelect", getUniqueValues("class_type"));
  setupCountsAsSelect();
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

// コースのセレクトボックスを作る
function setupCourseSelect() {
  const select = document.getElementById("addCourseSelect");
  const currentValue = select.value;

  select.innerHTML = "";

  const noneOption = document.createElement("option");
  noneOption.value = "";
  noneOption.textContent = "なし";
  select.appendChild(noneOption);

  addOptions(select, getUniqueValues("course"));

  const newOption = document.createElement("option");
  newOption.value = "__new__";
  newOption.textContent = "新しく追加";
  select.appendChild(newOption);

  if (hasOption(select, currentValue)) {
    select.value = currentValue;
  }

  updateNewCourseInput();
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

// 計算先のセレクトボックスを作る
function setupCountsAsSelect() {
  const select = document.getElementById("addCountsAsSelect");
  const currentValue = select.value;

  select.innerHTML = "";

  const normalOption = document.createElement("option");
  normalOption.value = "";
  normalOption.textContent = "通常計算";
  select.appendChild(normalOption);

  const freeOption = document.createElement("option");
  freeOption.value = "自主選択学修";
  freeOption.textContent = "自主選択学修へ直接入れる";
  select.appendChild(freeOption);

  if (hasOption(select, currentValue)) {
    select.value = currentValue;
  }
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

  if (select === null) {
    return;
  }

  const currentValue = mainLanguage;
  const languages = getLanguageValues();

  select.innerHTML = "";

  for (const language of languages) {
    const option = document.createElement("option");
    option.value = language;
    option.textContent = language;
    select.appendChild(option);
  }

  if (hasOption(select, currentValue)) {
    select.value = currentValue;
  } else if (languages.length > 0) {
    mainLanguage = languages[0];
    select.value = mainLanguage;
  }

  select.addEventListener("change", function () {
    mainLanguage = this.value;
    choiceCandidateFilter = "";
    saveMainLanguage();
    renderResult();
    renderSubjects();
  });
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

// 選択必修の候補表示で使う言語名を取り出す
function getChoiceLanguageName(filterName) {
  const startIndex = filterName.indexOf("（");
  const endIndex = filterName.indexOf("）");

  if (startIndex === -1 || endIndex === -1) {
    return mainLanguage;
  }

  return filterName.slice(startIndex + 1, endIndex);
}

// 情報ネット・メディアコースの専門応用科目か調べる
function isInfoCourseAppliedSubject(subject) {
  if (subject.sub_category !== "専門応用") {
    return false;
  }

  return subject.course === "情報ネット・メディアコース" || subject.course === null || subject.course === undefined || subject.course === "";
}

// 選択必修の候補に入る科目か調べる
function isChoiceCandidate(subject, filterName) {
  if (subject.counts_as === "自主選択学修") {
    return false;
  }

  if (filterName === "教養選択必修") {
    return subject.sub_category === "教養" && subject.requirement_type === "選択必修";
  }

  if (filterName.startsWith("同一外国語")) {
    const language = getChoiceLanguageName(filterName);
    return subject.sub_category === "外国語" && subject.requirement_type === "選択必修" && getLanguageName(subject) === language;
  }

  if (filterName === "数学分野の選択必修") {
    return subject.sub_category === "専門基幹" && subject.field === "数学" && subject.requirement_type === "選択必修";
  }

  if (filterName === "プログラミング選択必修") {
    return isInfoCourseAppliedSubject(subject) && subject.field === "プログラミング" && subject.requirement_type === "選択必修";
  }

  return false;
}

// 選択必修の不足名を画面用にする
function getChoiceShortageLabel(name) {
  const text = getRequirementText(name);

  if (name.startsWith("同一外国語")) {
    return text.label + name.replace("同一外国語", "");
  }

  return text.label;
}

// 選択必修の候補表示を解除する
function clearChoiceCandidateFilter() {
  choiceCandidateFilter = "";
  requirementSubjectFilter = "";
  renderSubjects();
}

// 検索や分類を自分で変えた時に候補表示を解除する
function handleFilterChange() {
  choiceCandidateFilter = "";
  requirementSubjectFilter = "";
  renderSubjects();
}

// 検索と絞り込みを解除する
function clearSubjectFilters() {
  choiceCandidateFilter = "";
  requirementSubjectFilter = "";
  document.getElementById("searchInput").value = "";
  document.getElementById("categorySelect").value = "all";
  document.getElementById("subCategorySelect").value = "all";
  document.getElementById("courseSelect").value = "all";
  document.getElementById("requirementSelect").value = "all";
  renderSubjects();
}

// 選択必修の候補だけを一覧に表示する
function showChoiceCandidates(filterName) {
  choiceCandidateFilter = filterName;
  requirementSubjectFilter = "";
  document.getElementById("searchInput").value = "";
  document.getElementById("categorySelect").value = "all";
  document.getElementById("subCategorySelect").value = "all";
  document.getElementById("courseSelect").value = "all";
  document.getElementById("requirementSelect").value = "all";
  renderSubjects();
}

// 候補表示中の案内を表示する
function renderCandidateFilterInfo(filteredSubjects) {
  const area = document.getElementById("candidateFilterInfo");

  if (choiceCandidateFilter === "" && requirementSubjectFilter === "") {
    area.classList.add("hidden-field");
    area.innerHTML = "";
    return;
  }

  area.classList.remove("hidden-field");

  if (choiceCandidateFilter !== "") {
    area.innerHTML = "<span>" + escapeHtml(getChoiceShortageLabel(choiceCandidateFilter)) + "の候補を表示中（" + filteredSubjects.length + "科目）</span><button id='clearCandidateFilterButton' type='button'>解除</button>";
  } else {
    area.innerHTML = "<span>" + escapeHtml(getRequirementFilterLabel(requirementSubjectFilter)) + "で選んでいる科目を表示中（" + filteredSubjects.length + "科目）</span><button id='clearCandidateFilterButton' type='button'>解除</button>";
  }

  document.getElementById("clearCandidateFilterButton").addEventListener("click", clearChoiceCandidateFilter);
}

// 今の単位表示で対象になる履修状況IDを作る
function getDisplaySubjectIds() {
  if (creditDisplayMode === "forecast") {
    return getForecastIds();
  }

  return selectedIds.slice();
}

// カテゴリ絞り込みの表示名を作る
function getRequirementFilterLabel(checkName) {
  const text = getRequirementText(checkName);

  if (checkName.startsWith("同一外国語")) {
    return text.label + checkName.replace("同一外国語", "");
  }

  return text.label;
}

// カテゴリに合う科目か調べる
function isRequirementSubject(subject, checkName) {
  const isDirectFree = subject.counts_as === "自主選択学修";

  if (checkName === "総単位") {
    return true;
  }

  if (checkName === "共通科目") {
    return subject.category === "共通" && !isDirectFree;
  }

  if (checkName === "教養・保健体育") {
    return (subject.sub_category === "教養" || subject.sub_category === "保健体育") && !isDirectFree;
  }

  if (checkName === "教養必修") {
    return subject.sub_category === "教養" && subject.requirement_type === "必修" && !isDirectFree;
  }

  if (checkName === "教養選択必修") {
    return subject.sub_category === "教養" && subject.requirement_type === "選択必修" && !isDirectFree;
  }

  if (checkName === "教養・保健体育の選択") {
    const isLiberalChoice = subject.sub_category === "教養" && subject.requirement_type === "選択";
    const isLiberalRegister = subject.sub_category === "教養" && subject.requirement_type === "登録必須";
    return (isLiberalChoice || isLiberalRegister || subject.sub_category === "保健体育") && !isDirectFree;
  }

  if (checkName === "外国語") {
    return subject.sub_category === "外国語" && !isDirectFree;
  }

  if (checkName === "必修英語") {
    return subject.sub_category === "外国語" && subject.requirement_type === "必修" && !isDirectFree;
  }

  if (checkName.startsWith("同一外国語")) {
    const language = getChoiceLanguageName(checkName);
    return subject.sub_category === "外国語" && subject.requirement_type === "選択必修" && getLanguageName(subject) === language && !isDirectFree;
  }

  if (checkName === "専門科目") {
    return subject.category === "専門" && !isDirectFree;
  }

  if (checkName === "専門基幹・専門基礎") {
    return (subject.sub_category === "専門基幹" || subject.sub_category === "専門基礎") && !isDirectFree;
  }

  if (checkName === "専門基幹・専門基礎の必修") {
    return (subject.sub_category === "専門基幹" || subject.sub_category === "専門基礎") && subject.requirement_type === "必修" && !isDirectFree;
  }

  if (checkName === "数学分野の選択必修") {
    return subject.sub_category === "専門基幹" && subject.field === "数学" && subject.requirement_type === "選択必修" && !isDirectFree;
  }

  if (checkName === "専門基幹・専門基礎の選択") {
    const isCoreBase = subject.sub_category === "専門基幹" || subject.sub_category === "専門基礎";
    const isMathChoice = subject.sub_category === "専門基幹" && subject.field === "数学" && subject.requirement_type === "選択必修";
    return isCoreBase && subject.requirement_type !== "必修" && !isMathChoice && !isDirectFree;
  }

  if (checkName === "専門応用") {
    return subject.sub_category === "専門応用" && !isDirectFree;
  }

  if (checkName === "専門応用の必修") {
    return isInfoCourseAppliedSubject(subject) && subject.requirement_type === "必修" && !isDirectFree;
  }

  if (checkName === "プログラミング選択必修") {
    return isInfoCourseAppliedSubject(subject) && subject.field === "プログラミング" && subject.requirement_type === "選択必修" && !isDirectFree;
  }

  if (checkName === "専門応用の選択") {
    return isInfoCourseAppliedSubject(subject) && subject.requirement_type !== "必修" && !(subject.field === "プログラミング" && subject.requirement_type === "選択必修") && !isDirectFree;
  }

  if (checkName === "理工学科専門応用") {
    return subject.sub_category === "専門応用" && !isDirectFree;
  }

  if (checkName === "自主選択学修") {
    return isDirectFree;
  }

  return false;
}

// 表示する科目を絞り込む
function getFilteredSubjects() {
  const searchText = document.getElementById("searchInput").value.trim().toLowerCase();
  const category = document.getElementById("categorySelect").value;
  const subCategory = document.getElementById("subCategorySelect").value;
  const course = document.getElementById("courseSelect").value;
  const requirementType = document.getElementById("requirementSelect").value;
  const displaySubjectIds = getDisplaySubjectIds();
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

    if (course !== "all" && subject.course !== course) {
      continue;
    }

    if (requirementType !== "all" && subject.requirement_type !== requirementType) {
      continue;
    }

    if (choiceCandidateFilter !== "" && !isChoiceCandidate(subject, choiceCandidateFilter)) {
      continue;
    }

    if (requirementSubjectFilter !== "") {
      if (!displaySubjectIds.includes(subject.id)) {
        continue;
      }

      if (!isRequirementSubject(subject, requirementSubjectFilter)) {
        continue;
      }
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
    const status = getSubjectStatus(subject.id);
    const rowClasses = [];

    if (isCustomSubject(subject.id)) {
      rowClasses.push("added-subject-row");
    }

    if (status === "completed") {
      rowClasses.push("selected-subject-row");
    }

    if (status === "inProgress") {
      rowClasses.push("in-progress-subject-row");
    }

    if (status === "planned") {
      rowClasses.push("planned-subject-row");
    }

    const rowClass = rowClasses.length === 0 ? "" : " class='" + rowClasses.join(" ") + "'";

    html += "<tr" + rowClass + ">";
    html += "<td class='status-column'>" + renderCourseStatusSelect(subject.id, status) + "</td>";
    html += "<td>" + escapeHtml(subject.name) + "</td>";
    html += "<td>" + escapeHtml(subject.old_name) + "</td>";
    html += "<td>" + escapeHtml(subject.credits) + "</td>";
    html += "<td>" + escapeHtml(subject.category) + "</td>";
    html += "<td>" + escapeHtml(subject.sub_category) + "</td>";
    html += "<td>" + escapeHtml(subject.course) + "</td>";
    html += "<td>" + escapeHtml(subject.field) + "</td>";
    html += "<td>" + getRequirementBadge(subject.requirement_type) + "</td>";
    html += "<td>" + escapeHtml(subject.class_type) + "</td>";
    html += "<td>" + escapeHtml(subject.counts_as) + "</td>";
    html += "</tr>";
  }

  tbody.innerHTML = html;

  const statusSelects = document.querySelectorAll(".course-status-select");

  for (const select of statusSelects) {
    select.addEventListener("change", function () {
      setSubjectStatus(this.dataset.id, this.value);
    });
  }

  document.getElementById("shownCount").textContent = "表示 " + filteredSubjects.length + "科目";
  renderCandidateFilterInfo(filteredSubjects);
}

// 科目の履修状況を取り出す
function getSubjectStatus(subjectId) {
  if (selectedIds.includes(subjectId)) {
    return "completed";
  }

  if (inProgressIds.includes(subjectId)) {
    return "inProgress";
  }

  if (plannedIds.includes(subjectId)) {
    return "planned";
  }

  return "";
}

// 履修状況の選択欄を作る
function renderCourseStatusSelect(subjectId, status) {
  let html = "";

  html += "<select class='course-status-select status-" + escapeHtml(status || "none") + "' data-id='" + escapeHtml(subjectId) + "' aria-label='履修状況'>";
  html += makeStatusOption("", "未選択", status);
  html += makeStatusOption("completed", "履修済み", status);
  html += makeStatusOption("inProgress", "履修中", status);
  html += makeStatusOption("planned", "履修予定", status);
  html += "</select>";

  return html;
}

// 履修状況の選択肢を作る
function makeStatusOption(value, label, currentValue) {
  const selected = value === currentValue ? " selected" : "";
  return "<option value='" + escapeHtml(value) + "'" + selected + ">" + escapeHtml(label) + "</option>";
}

// 削除画面の追加科目を表示する
function renderDeleteSubjects() {
  const tbody = document.getElementById("deleteSubjectTableBody");
  let html = "";

  if (customSubjects.length === 0) {
    tbody.innerHTML = "<tr><td colspan='12'>追加した科目はありません</td></tr>";
    return;
  }

  for (const subject of customSubjects) {
    html += "<tr class='added-subject-row'>";
    html += "<td class='check-column'><label class='round-check' aria-label='削除する科目を選択'><input class='delete-subject-check' type='checkbox' data-id='" + escapeHtml(subject.id) + "'><span></span></label></td>";
    html += "<td>" + escapeHtml(subject.name) + "</td>";
    html += "<td>" + escapeHtml(subject.old_name) + "</td>";
    html += "<td>" + escapeHtml(subject.credits) + "</td>";
    html += "<td>" + escapeHtml(subject.category) + "</td>";
    html += "<td>" + escapeHtml(subject.sub_category) + "</td>";
    html += "<td>" + escapeHtml(subject.course) + "</td>";
    html += "<td>" + escapeHtml(subject.field) + "</td>";
    html += "<td>" + getRequirementBadge(subject.requirement_type) + "</td>";
    html += "<td>" + escapeHtml(subject.class_type) + "</td>";
    html += "<td>" + escapeHtml(subject.counts_as) + "</td>";
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

// 配列から指定したIDを外す
function removeId(ids, subjectId) {
  return ids.filter(function (id) {
    return id !== subjectId;
  });
}

// 科目の履修状況を変更する
function setSubjectStatus(subjectId, status) {
  selectedIds = removeId(selectedIds, subjectId);
  inProgressIds = removeId(inProgressIds, subjectId);
  plannedIds = removeId(plannedIds, subjectId);

  if (status === "completed") {
    selectedIds.push(subjectId);
  }

  if (status === "inProgress") {
    inProgressIds.push(subjectId);
  }

  if (status === "planned") {
    plannedIds.push(subjectId);
  }

  saveSelectedIds();
  renderSubjects();
  renderResult();
}

// 追加フォームのコース入力欄を切り替える
function updateNewCourseInput() {
  const courseSelect = document.getElementById("addCourseSelect");
  const newCourseLabel = document.getElementById("newCourseLabel");

  if (courseSelect.value === "__new__") {
    newCourseLabel.classList.remove("hidden-field");
  } else {
    newCourseLabel.classList.add("hidden-field");
  }
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

// 科目名を比べやすい形にする
function normalizeSubjectName(name) {
  return String(name || "").trim().toLowerCase();
}

// 同じ科目名や旧科目名があるか調べる
function subjectNameExists(name) {
  const targetName = normalizeSubjectName(name);

  if (targetName === "") {
    return false;
  }

  for (const subject of subjects) {
    const subjectName = normalizeSubjectName(subject.name);
    const oldSubjectName = normalizeSubjectName(subject.old_name);

    if (subjectName === targetName || oldSubjectName === targetName) {
      return true;
    }
  }

  return false;
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
  const countsAs = document.getElementById("addCountsAsSelect").value;
  let course = document.getElementById("addCourseSelect").value;
  let field = document.getElementById("addFieldSelect").value;

  if (name === "") {
    setMessage("addMessage", "科目名を入力してください");
    return;
  }

  if (subjectNameExists(name)) {
    setMessage("addMessage", "同じ科目名または旧科目名の科目があります");
    return;
  }

  if (oldNameInput !== "" && normalizeSubjectName(oldNameInput) === normalizeSubjectName(name)) {
    setMessage("addMessage", "科目名と旧科目名は別の名前にしてください");
    return;
  }

  if (oldNameInput !== "" && subjectNameExists(oldNameInput)) {
    setMessage("addMessage", "同じ科目名または旧科目名の科目があります");
    return;
  }

  if (course === "__new__") {
    course = document.getElementById("addNewCourseInput").value.trim();

    if (course === "") {
      setMessage("addMessage", "新しいコースを入力してください");
      return;
    }
  }

  if (field === "__new__") {
    field = document.getElementById("addNewFieldInput").value.trim();

    if (field === "") {
      setMessage("addMessage", "新しい分野を入力してください");
      return;
    }
  }

  const subject = {
    id: makeAddId(),
    name: name,
    credits: credits,
    requirement_type: requirementType,
    category: category,
    sub_category: subCategory,
    course: course === "" ? null : course,
    field: field,
    class_type: classType,
    old_name: oldNameInput === "" ? null : oldNameInput,
    counts_as: countsAs === "" ? null : countsAs
  };

  customSubjects.push(subject);
  rebuildSubjects();
  saveAllData();
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
  document.getElementById("addNewCourseInput").value = "";
  document.getElementById("addNewFieldInput").value = "";
  document.getElementById("addCountsAsSelect").value = "";
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

  if (!confirm(deleteIds.length + "件の追加科目を削除しますか？")) {
    return;
  }

  customSubjects = customSubjects.filter(function (subject) {
    return !deleteIds.includes(subject.id);
  });

  selectedIds = selectedIds.filter(function (id) {
    return !deleteIds.includes(id);
  });

  inProgressIds = inProgressIds.filter(function (id) {
    return !deleteIds.includes(id);
  });

  plannedIds = plannedIds.filter(function (id) {
    return !deleteIds.includes(id);
  });

  rebuildSubjects();
  cleanCourseStatusIds();
  saveAllData();
  setupSelectOptions();
  renderSubjects();
  renderResult();
  renderDeleteSubjects();
  setMessage("deleteMessage", "追加科目を削除しました");
}


// 同じIDを重複させずにまとめる
function addUniqueIds(targetIds, sourceIds) {
  for (const id of sourceIds) {
    if (!targetIds.includes(id)) {
      targetIds.push(id);
    }
  }
}

// 履修中・履修予定も含めたIDを作る
function getForecastIds() {
  const ids = [];

  addUniqueIds(ids, selectedIds);
  addUniqueIds(ids, inProgressIds);
  addUniqueIds(ids, plannedIds);

  return ids;
}

// IDの科目の単位を合計する
function sumCreditsForIds(ids) {
  let total = 0;

  for (const subject of subjects) {
    if (ids.includes(subject.id)) {
      total += subject.credits;
    }
  }

  return total;
}

// 今表示している単位の種類名
function getCreditDisplayLabel() {
  if (creditDisplayMode === "forecast") {
    return "履修中・予定込み";
  }

  return "履修済み";
}

// 単位表示を切り替える
function setCreditDisplayMode(mode, renderDelayMs) {
  const nextMode = mode === "forecast" ? "forecast" : "completed";

  if (creditDisplayMode === nextMode) {
    updateCreditDisplayButtons();
    return;
  }

  creditDisplayMode = nextMode;
  updateCreditDisplayButtons();

  if (creditDisplayRenderTimer !== null) {
    clearTimeout(creditDisplayRenderTimer);
    creditDisplayRenderTimer = null;
  }

  if (renderDelayMs > 0) {
    creditDisplayRenderTimer = setTimeout(function () {
      creditDisplayRenderTimer = null;
      saveAllData();
      renderResult();
      renderSubjects();
    }, renderDelayMs);
    return;
  }

  saveAllData();
  renderResult();
  renderSubjects();
}

// 総単位カードの円グラフを更新する
function updateTotalProgress(result) {
  const percent = Math.min(100, Math.round((result.totalCredits / requirements.totalCredits) * 100));
  const circle = document.getElementById("totalProgressCircle");
  const circleLength = 226.2;

  document.getElementById("totalPercent").textContent = percent + "%";

  if (circle !== null) {
    circle.style.strokeDashoffset = circleLength - (circleLength * percent / 100);
  }
}

// 単位表示ボタンの選択状態を更新する
function updateCreditDisplayButtons() {
  const control = document.getElementById("creditDisplayControl");
  const labels = document.querySelectorAll(".mode-label");

  if (control !== null) {
    control.classList.toggle("forecast-mode", creditDisplayMode === "forecast");
    control.setAttribute("aria-checked", String(creditDisplayMode === "forecast"));
  }

  for (const label of labels) {
    label.classList.toggle("active", label.dataset.mode === creditDisplayMode);
  }
}

// 計算結果を表示する
function renderResult() {
  const result = calculateResult(subjects, selectedIds, requirements, mainLanguage);
  const forecastResult = calculateResult(subjects, getForecastIds(), requirements, mainLanguage);
  const displayResult = creditDisplayMode === "forecast" ? forecastResult : result;
  const displayLabel = getCreditDisplayLabel();
  const inProgressCredits = sumCreditsForIds(inProgressIds);
  const plannedCredits = sumCreditsForIds(plannedIds);

  document.getElementById("totalCredits").textContent = displayResult.totalCredits;
  document.getElementById("creditModeStatus").textContent = "表示中: " + displayLabel;
  updateTotalProgress(displayResult);
  updateCreditDisplayButtons();
  document.getElementById("selectedCount").textContent = "履修済み " + result.selectedCount + "科目 / " + result.totalCredits + "単位、履修中 " + inProgressIds.length + "科目 / " + inProgressCredits + "単位、履修予定 " + plannedIds.length + "科目 / " + plannedCredits + "単位";

  const status = document.getElementById("graduationStatus");

  if (displayResult.graduationOk) {
    status.textContent = creditDisplayMode === "forecast" ? "見込み達成" : "卒業要件達成";
    status.className = "status-text status-ok";
  } else {
    status.textContent = creditDisplayMode === "forecast" ? "見込み未達成" : "未達成";
    status.className = "status-text status-ng";
  }

  renderSummary(displayResult);
  renderRequirementList(displayResult.checks);
  renderMissingRequired(result.missingRequiredSubjects);
  renderMissingChoice(result.choiceShortages);
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

// ゲージを前の幅から今の幅へ動かす
function moveProgressBars() {
  const bars = document.querySelectorAll(".progress-fill");

  for (const bar of bars) {
    const name = bar.dataset.name;
    const targetPercent = Number(bar.dataset.percent);

    requestAnimationFrame(function () {
      bar.style.width = targetPercent + "%";
    });

    previousPercents[name] = targetPercent;
  }
}

// ゲージの色を決める
function getRequirementStatusClass(check) {
  const shortage = Math.max(0, check.required - check.earned);

  if (shortage === 0) {
    return "requirement-good";
  }

  if (shortage <= 4) {
    return "requirement-warning";
  }

  return "requirement-danger";
}

// 上部のまとめに出す不足項目を取り出す
function getSummaryShortageChecks(checks) {
  const names = [
    "教養必修",
    "教養選択必修",
    "教養・保健体育の選択",
    "必修英語",
    "同一外国語",
    "専門基幹・専門基礎の必修",
    "数学分野の選択必修",
    "専門基幹・専門基礎の選択",
    "専門応用の必修",
    "プログラミング選択必修",
    "専門応用の選択",
    "理工学科専門応用",
    "自主選択学修"
  ];
  const shortageChecks = [];

  for (const name of names) {
    const check = findCheck(checks, name);

    if (check !== null && !check.ok) {
      shortageChecks.push(check);
    }
  }

  return shortageChecks;
}

// 上部のまとめ用の不足文を作る
function makeSummaryShortageText(check) {
  const shortage = Math.max(0, check.required - check.earned);
  const text = getRequirementText(check.name);
  let label = text.label;

  if (check.name.startsWith("同一外国語")) {
    label += check.name.replace("同一外国語", "");
  }

  return label + " " + shortage + "単位";
}

// 単位表示の切り替えボタンに動きを付ける
function setupCreditDisplayControl() {
  const control = document.getElementById("creditDisplayControl");
  let isDragging = false;
  let dragStarted = false;
  let startPointerX = 0;
  let settleTimer = null;

  function getToggleMaxX() {
    const thumb = document.getElementById("modeThumb");

    if (control === null || thumb === null) {
      return 0;
    }

    return Math.max(0, control.clientWidth - 8 - thumb.offsetWidth);
  }

  function getPointerX(event) {
    const thumb = document.getElementById("modeThumb");
    const rect = control.getBoundingClientRect();
    const thumbWidth = thumb === null ? 0 : thumb.offsetWidth;
    const maxX = getToggleMaxX();
    const x = event.clientX - rect.left - thumbWidth / 2;

    return Math.min(maxX, Math.max(0, x));
  }

  function getModeFromPointer(event) {
    const x = getPointerX(event);
    return x > getToggleMaxX() / 2 ? "forecast" : "completed";
  }

  function getModeX(mode) {
    return mode === "forecast" ? getToggleMaxX() : 0;
  }

  function clearDragStyle() {
    control.style.removeProperty("--thumb-x");
    control.style.removeProperty("--thumb-scale-x");
    control.style.removeProperty("--thumb-scale-y");
    control.style.removeProperty("--thumb-origin");
  }

  function moveThumb(event) {
    const maxX = getToggleMaxX();
    const rawX = getPointerX(event);
    const baseX = creditDisplayMode === "forecast" ? maxX : 0;
    const moveAmount = maxX === 0 ? 0 : Math.abs(rawX - baseX) / maxX;
    const scaleX = 1.14 + Math.min(0.07, moveAmount * 0.07);
    const scaleY = 1.13 - Math.min(0.04, moveAmount * 0.04);

    control.style.setProperty("--thumb-x", rawX + "px");
    control.style.setProperty("--thumb-scale-x", scaleX);
    control.style.setProperty("--thumb-scale-y", scaleY);
    control.style.setProperty("--thumb-origin", "center");
  }

  function startSettleAnimation() {
    control.classList.add("settling");

    if (settleTimer !== null) {
      clearTimeout(settleTimer);
    }

    settleTimer = setTimeout(function () {
      control.classList.remove("settling");
      clearDragStyle();
      settleTimer = null;
    }, 430);
  }

  function startClickAnimation() {
    control.classList.remove("pressing");
    control.classList.add("clicking");

    if (settleTimer !== null) {
      clearTimeout(settleTimer);
    }

    settleTimer = setTimeout(function () {
      control.classList.remove("clicking");
      clearDragStyle();
      settleTimer = null;
    }, 460);
  }

  function finishDrag(event) {
    if (!isDragging) {
      return;
    }

    const nextMode = getModeFromPointer(event);

    isDragging = false;
    control.classList.remove("dragging");
    control.classList.remove("pressing");

    if (!dragStarted) {
      dragStarted = false;
      clearDragStyle();
      startClickAnimation();
      setCreditDisplayMode(nextMode, 80);
      return;
    }

    dragStarted = false;
    startSettleAnimation();
    control.style.setProperty("--thumb-x", getModeX(nextMode) + "px");
    control.style.setProperty("--thumb-scale-x", 1);
    control.style.setProperty("--thumb-scale-y", 1);
    control.style.setProperty("--thumb-origin", "center");
    setCreditDisplayMode(nextMode);
  }

  if (control !== null) {
    control.addEventListener("pointerdown", function (event) {
      if (event.button !== undefined && event.button !== 0) {
        return;
      }

      event.preventDefault();
      isDragging = true;
      dragStarted = false;
      startPointerX = event.clientX;

      if (settleTimer !== null) {
        clearTimeout(settleTimer);
        settleTimer = null;
      }

      clearDragStyle();
      control.classList.remove("clicking");
      control.classList.remove("settling");
      control.classList.add("pressing");
      control.style.setProperty("--thumb-x", getModeX(creditDisplayMode) + "px");
      control.style.setProperty("--thumb-scale-x", 1.18);
      control.style.setProperty("--thumb-scale-y", 1.16);
      control.style.setProperty("--thumb-origin", "center");

      if (control.setPointerCapture !== undefined) {
        control.setPointerCapture(event.pointerId);
      }
    });

    control.addEventListener("pointermove", function (event) {
      if (isDragging) {
        if (!dragStarted && Math.abs(event.clientX - startPointerX) < 4) {
          return;
        }

        dragStarted = true;
        control.classList.remove("pressing");
        control.classList.add("dragging");
        moveThumb(event);
      }
    });

    control.addEventListener("pointerup", finishDrag);

    control.addEventListener("pointercancel", function () {
      if (!isDragging) {
        return;
      }

      isDragging = false;
      dragStarted = false;
      control.classList.remove("dragging");
      control.classList.remove("pressing");
      control.style.setProperty("--thumb-x", getModeX(creditDisplayMode) + "px");
      control.style.setProperty("--thumb-scale-x", 1);
      control.style.setProperty("--thumb-scale-y", 1);
      control.style.setProperty("--thumb-origin", "center");
      startSettleAnimation();
    });

    control.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setCreditDisplayMode(creditDisplayMode === "forecast" ? "completed" : "forecast");
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setCreditDisplayMode("completed");
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setCreditDisplayMode("forecast");
      }
    });
  }
}

// 上部のまとめを表示する
function renderSummary(result) {
  const area = document.getElementById("summaryPanel");
  const totalCheck = findCheck(result.checks, "総単位");
  const totalShortage = Math.max(0, totalCheck.required - totalCheck.earned);
  const shortageChecks = getSummaryShortageChecks(result.checks);
  const shortageTexts = [];
  const maxTextCount = 4;

  for (let i = 0; i < shortageChecks.length && i < maxTextCount; i++) {
    shortageTexts.push(makeSummaryShortageText(shortageChecks[i]));
  }

  if (shortageChecks.length > maxTextCount) {
    shortageTexts.push("ほか" + (shortageChecks.length - maxTextCount) + "項目");
  }

  if (result.missingRequiredSubjects.length > 0) {
    shortageTexts.push("未修得必修 " + result.missingRequiredSubjects.length + "科目");
  }

  const shortageHead = creditDisplayMode === "forecast" ? "不足（履修中・予定込み）" : "不足";
  const shortageText = shortageTexts.length === 0 ? shortageHead + ": なし" : shortageHead + ": " + shortageTexts.join("、");
  const panelClass = result.graduationOk ? "summary-panel summary-ok" : "summary-panel summary-ng";

  area.className = panelClass;
  area.innerHTML = "<div class='summary-alert-line'><span class='summary-dot'></span><span>" + escapeHtml(shortageText) + "</span></div>";
}

// 1つの要件を表示する
function renderRequirementItem(check, className) {
  if (check === null) {
    return "";
  }

  const statusClass = getRequirementStatusClass(check);
  const percent = Math.min(100, Math.round((check.earned / check.required) * 100));
  const beforePercent = previousPercents[check.name] === undefined ? 0 : previousPercents[check.name];
  const text = getRequirementText(check.name);
  const activeClass = requirementSubjectFilter === check.name ? " requirement-filter-active" : "";

  let html = "";
  html += "<div class='requirement-item " + statusClass + " " + className + activeClass + "' data-check-name='" + escapeHtml(check.name) + "' role='button' tabindex='0'>";
  html += "<div class='requirement-head'>";
  html += "<span class='requirement-name'>" + text.label + "</span>";
  html += "<span class='requirement-number'>" + check.earned + " / " + check.required + " 単位</span>";
  html += "</div>";

  if (text.description !== undefined && text.description !== "") {
    html += "<p class='requirement-description'>" + text.description + "</p>";
  }

  if (check.name.startsWith("同一外国語")) {
    html += "<div class='requirement-inline-control'>";
    html += "<label for='mainLanguageSelect'>メイン外国語</label>";
    html += "<select id='mainLanguageSelect'></select>";
    html += "</div>";
  }

  html += "<div class='progress-bar'><div class='progress-fill' data-name='" + escapeHtml(check.name) + "' data-percent='" + percent + "' style='width: " + beforePercent + "%'></div></div>";
  html += "</div>";

  return html;
}

// 要件をクリックした時、その要件で選んでいる科目だけを一覧に出す
function showRequirementSubjects(checkName) {
  if (requirementSubjectFilter === checkName) {
    clearChoiceCandidateFilter();
    renderResult();
    return;
  }

  requirementSubjectFilter = checkName;
  choiceCandidateFilter = "";
  document.getElementById("searchInput").value = "";
  document.getElementById("categorySelect").value = "all";
  document.getElementById("subCategorySelect").value = "all";
  document.getElementById("courseSelect").value = "all";
  document.getElementById("requirementSelect").value = "all";
  renderSubjects();
  renderResult();
}

// 単位数カードにクリック操作を付ける
function setupRequirementFilterEvents() {
  const items = document.querySelectorAll(".requirement-item[data-check-name]");

  for (const item of items) {
    item.addEventListener("click", function (event) {
      if (event.target.closest("select") !== null) {
        return;
      }

      showRequirementSubjects(this.dataset.checkName);
    });

    item.addEventListener("keydown", function (event) {
      if (event.target.closest("select") !== null) {
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        showRequirementSubjects(this.dataset.checkName);
      }
    });
  }
}

// 小さい要件をまとめて表示する
function renderChildItems(checks, names) {
  let html = "";

  for (const name of names) {
    html += renderRequirementItem(findCheck(checks, name), "requirement-child");
  }

  return html;
}

// 要件の一覧を表示する
function renderRequirementList(checks) {
  const area = document.getElementById("requirementList");
  let html = "";

  html += renderRequirementItem(findCheck(checks, "総単位"), "requirement-summary");

  html += "<div class='requirement-section'>";
  html += renderRequirementItem(findCheck(checks, "共通科目"), "requirement-summary");
  html += "<div class='requirement-children'>";
  html += "<div class='requirement-subsection'>";
  html += renderRequirementItem(findCheck(checks, "教養・保健体育"), "requirement-middle");
  html += "<div class='requirement-children requirement-child-list'>";
  html += renderChildItems(checks, ["教養必修", "教養選択必修", "教養・保健体育の選択"]);
  html += "</div>";
  html += "</div>";
  html += "<div class='requirement-subsection'>";
  html += renderRequirementItem(findCheck(checks, "外国語"), "requirement-middle");
  html += "<div class='requirement-children requirement-child-list'>";
  html += renderChildItems(checks, ["必修英語", "同一外国語"]);
  html += "</div>";
  html += "</div>";
  html += "</div>";
  html += "</div>";

  html += "<div class='requirement-section'>";
  html += renderRequirementItem(findCheck(checks, "専門科目"), "requirement-summary");
  html += "<div class='requirement-children'>";
  html += "<div class='requirement-subsection'>";
  html += renderRequirementItem(findCheck(checks, "専門基幹・専門基礎"), "requirement-middle");
  html += "<div class='requirement-children requirement-child-list'>";
  html += renderChildItems(checks, ["専門基幹・専門基礎の必修", "数学分野の選択必修", "専門基幹・専門基礎の選択"]);
  html += "</div>";
  html += "</div>";
  html += "<div class='requirement-subsection'>";
  html += renderRequirementItem(findCheck(checks, "専門応用"), "requirement-middle");
  html += "<div class='requirement-children requirement-child-list'>";
  html += renderChildItems(checks, ["専門応用の必修", "プログラミング選択必修", "専門応用の選択", "理工学科専門応用"]);
  html += "</div>";
  html += "</div>";
  html += "</div>";
  html += "</div>";

  html += renderRequirementItem(findCheck(checks, "自主選択学修"), "requirement-summary");

  area.innerHTML = html;
  setupRequirementFilterEvents();
  setupMainLanguageOptions();
  moveProgressBars();
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

// 候補科目名を短く表示する
function makeCandidatePreview(candidateSubjects) {
  if (candidateSubjects.length === 0) {
    return "候補科目がありません";
  }

  const names = [];
  const maxCount = 4;

  for (let i = 0; i < candidateSubjects.length && i < maxCount; i++) {
    names.push(candidateSubjects[i].name);
  }

  let text = names.join("、");

  if (candidateSubjects.length > maxCount) {
    text += "、ほか" + (candidateSubjects.length - maxCount) + "科目";
  }

  return text;
}

// 不足している選択必修を表示する
function renderMissingChoice(choiceShortages) {
  const list = document.getElementById("missingChoiceList");

  if (choiceShortages === undefined || choiceShortages.length === 0) {
    list.innerHTML = "<li>なし</li>";
    return;
  }

  let html = "";

  for (const choiceShortage of choiceShortages) {
    const label = getChoiceShortageLabel(choiceShortage.name);
    const preview = makeCandidatePreview(choiceShortage.candidateSubjects);

    html += "<li>";
    html += "<button class='choice-shortage-button' type='button' data-choice-name='" + escapeHtml(choiceShortage.name) + "'>";
    html += "<span class='choice-shortage-title'>" + escapeHtml(label) + "</span>";
    html += "<span>あと" + escapeHtml(choiceShortage.shortage) + "単位（候補" + escapeHtml(choiceShortage.candidateCount) + "科目）</span>";
    html += "</button>";
    html += "<div class='choice-candidates'>" + escapeHtml(preview) + "</div>";
    html += "</li>";
  }

  list.innerHTML = html;

  const buttons = document.querySelectorAll(".choice-shortage-button");

  for (const button of buttons) {
    button.addEventListener("click", function () {
      showChoiceCandidates(this.dataset.choiceName);
    });
  }
}

// 注意を表示する
function renderWarnings(missingRegisterSubjects) {
  const list = document.getElementById("warningList");
  let html = "";

  html += "<li>本アプリの計算結果は参考値です。正式な卒業判定は必ず大学の成績表・履修要綱で確認してください。</li>";
  html += "<li>本アプリは修得済み単位の計算のみを行います。登録必須科目の登録義務、卒業研究の履修資格、履修制限単位数などは判定できません。</li>";
  html += "<li>成績表で単位を修得した科目は履修済みにしてください。履修中・履修予定は見込みの確認用です。</li>";
  html += "<li>不可の科目は含めないでください。検定等で単位認定を受けた科目は履修済みにしてください。</li>";

  for (const subject of missingRegisterSubjects) {
    html += "<li>未修得の登録必須科目: " + escapeHtml(subject.name) + "</li>";
  }

  list.innerHTML = html;
}

// ボタンなどの動きを設定する
function setupEvents() {
  document.getElementById("searchInput").addEventListener("input", handleFilterChange);
  document.getElementById("categorySelect").addEventListener("change", handleFilterChange);
  document.getElementById("subCategorySelect").addEventListener("change", handleFilterChange);
  document.getElementById("courseSelect").addEventListener("change", handleFilterChange);
  document.getElementById("requirementSelect").addEventListener("change", handleFilterChange);
  document.getElementById("resetFilterButton").addEventListener("click", clearSubjectFilters);
  setupCreditDisplayControl();


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

  document.getElementById("addCourseSelect").addEventListener("change", updateNewCourseInput);
  document.getElementById("addFieldSelect").addEventListener("change", updateNewFieldInput);
  document.getElementById("addSubjectButton").addEventListener("click", addSubject);
  document.getElementById("deleteAddedSubjectButton").addEventListener("click", deleteSelectedAddedSubjects);

  document.getElementById("saveButton").addEventListener("click", function () {
    saveAllData();
    alert("保存しました");
  });

  document.getElementById("clearButton").addEventListener("click", function () {
    if (confirm("履修状況をすべてクリアしますか？")) {
      selectedIds = [];
      inProgressIds = [];
      plannedIds = [];
      choiceCandidateFilter = "";
      requirementSubjectFilter = "";
      saveSelectedIds();
      renderSubjects();
      renderResult();
    }
  });
}

loadData();
renderTargetInfo();
setupSelectOptions();
setupEvents();
showView("main");
