const fs = require("fs");
const path = require("path");

let baseSubjects = [];
let customSubjects = [];
let subjects = [];
let requirements = {};
let selectedIds = [];
let mainLanguage = "英語";
let previousPercents = {};
let choiceCandidateFilter = "";

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
  cleanSelectedIds();
  saveAllData();
}

// 保存済みデータを読む
function loadState() {
  const savedStateText = localStorage.getItem(stateSaveKey);

  if (savedStateText !== null) {
    const state = parseSavedJson(savedStateText, null);

    if (state !== null) {
      applyState(state);
      return;
    }
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

// 保存済みデータを画面用の変数に入れる
function applyState(state) {
  if (Array.isArray(state.selectedIds)) {
    selectedIds = state.selectedIds;
  }

  if (typeof state.mainLanguage === "string") {
    mainLanguage = state.mainLanguage;
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
    mainLanguage: mainLanguage,
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
  renderSubjects();
}

// 検索や分類を自分で変えた時に候補表示を解除する
function handleFilterChange() {
  choiceCandidateFilter = "";
  renderSubjects();
}

// 検索と絞り込みを解除する
function clearSubjectFilters() {
  choiceCandidateFilter = "";
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

  if (choiceCandidateFilter === "") {
    area.classList.add("hidden-field");
    area.innerHTML = "";
    return;
  }

  area.classList.remove("hidden-field");
  area.innerHTML = "<span>" + escapeHtml(getChoiceShortageLabel(choiceCandidateFilter)) + "の候補を表示中（" + filteredSubjects.length + "科目）</span><button id='clearCandidateFilterButton' type='button'>解除</button>";

  document.getElementById("clearCandidateFilterButton").addEventListener("click", clearChoiceCandidateFilter);
}

// 表示する科目を絞り込む
function getFilteredSubjects() {
  const searchText = document.getElementById("searchInput").value.trim().toLowerCase();
  const category = document.getElementById("categorySelect").value;
  const subCategory = document.getElementById("subCategorySelect").value;
  const course = document.getElementById("courseSelect").value;
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

    if (course !== "all" && subject.course !== course) {
      continue;
    }

    if (requirementType !== "all" && subject.requirement_type !== requirementType) {
      continue;
    }

    if (choiceCandidateFilter !== "" && !isChoiceCandidate(subject, choiceCandidateFilter)) {
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
    const isSelected = selectedIds.includes(subject.id);
    const checked = isSelected ? "checked" : "";
    const rowClasses = [];

    if (isCustomSubject(subject.id)) {
      rowClasses.push("added-subject-row");
    }

    if (isSelected) {
      rowClasses.push("selected-subject-row");
    }

    const rowClass = rowClasses.length === 0 ? "" : " class='" + rowClasses.join(" ") + "'";

    html += "<tr" + rowClass + ">";
    html += "<td class='check-column'><input class='subject-check' type='checkbox' data-id='" + escapeHtml(subject.id) + "' " + checked + "></td>";
    html += "<td>" + escapeHtml(subject.name) + "</td>";
    html += "<td>" + escapeHtml(subject.credits) + "</td>";
    html += "<td>" + escapeHtml(subject.category) + "</td>";
    html += "<td>" + escapeHtml(subject.sub_category) + "</td>";
    html += "<td>" + escapeHtml(subject.course) + "</td>";
    html += "<td>" + escapeHtml(subject.field) + "</td>";
    html += "<td>" + getRequirementBadge(subject.requirement_type) + "</td>";
    html += "<td>" + escapeHtml(subject.counts_as) + "</td>";
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
  renderCandidateFilterInfo(filteredSubjects);
}

// 削除画面の追加科目を表示する
function renderDeleteSubjects() {
  const tbody = document.getElementById("deleteSubjectTableBody");
  let html = "";

  if (customSubjects.length === 0) {
    tbody.innerHTML = "<tr><td colspan='11'>追加した科目はありません</td></tr>";
    return;
  }

  for (const subject of customSubjects) {
    html += "<tr class='added-subject-row'>";
    html += "<td class='check-column'><input class='delete-subject-check' type='checkbox' data-id='" + escapeHtml(subject.id) + "'></td>";
    html += "<td>" + escapeHtml(subject.name) + "</td>";
    html += "<td>" + escapeHtml(subject.credits) + "</td>";
    html += "<td>" + escapeHtml(subject.category) + "</td>";
    html += "<td>" + escapeHtml(subject.sub_category) + "</td>";
    html += "<td>" + escapeHtml(subject.course) + "</td>";
    html += "<td>" + escapeHtml(subject.field) + "</td>";
    html += "<td>" + getRequirementBadge(subject.requirement_type) + "</td>";
    html += "<td>" + escapeHtml(subject.counts_as) + "</td>";
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

  rebuildSubjects();
  cleanSelectedIds();
  saveAllData();
  setupSelectOptions();
  renderSubjects();
  renderResult();
  renderDeleteSubjects();
  setMessage("deleteMessage", "追加科目を削除しました");
}


// 計算結果を表示する
function renderResult() {
  const result = calculateResult(subjects, selectedIds, requirements, mainLanguage);

  document.getElementById("totalCredits").textContent = result.totalCredits;
  document.getElementById("selectedCount").textContent = "選択中 " + result.selectedCount + "科目 / " + result.totalCredits + "単位";

  const status = document.getElementById("graduationStatus");

  if (result.graduationOk) {
    status.textContent = "卒業要件達成";
    status.className = "status-text status-ok";
  } else {
    status.textContent = "未達成";
    status.className = "status-text status-ng";
  }

  renderSummary(result);
  renderRequirementList(result.checks);
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

  const shortageText = shortageTexts.length === 0 ? "不足: なし" : "不足: " + shortageTexts.join("、");
  const panelClass = result.graduationOk ? "summary-panel summary-ok" : "summary-panel summary-ng";

  area.className = panelClass;
  area.innerHTML = "<div class='summary-main'>総単位 " + escapeHtml(totalCheck.earned) + " / " + escapeHtml(totalCheck.required) + "（あと" + escapeHtml(totalShortage) + "単位）</div><div class='summary-shortage'>" + escapeHtml(shortageText) + "</div>";
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

  let html = "";
  html += "<div class='requirement-item " + statusClass + " " + className + "'>";
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
  document.getElementById("searchInput").addEventListener("input", handleFilterChange);
  document.getElementById("categorySelect").addEventListener("change", handleFilterChange);
  document.getElementById("subCategorySelect").addEventListener("change", handleFilterChange);
  document.getElementById("courseSelect").addEventListener("change", handleFilterChange);
  document.getElementById("requirementSelect").addEventListener("change", handleFilterChange);
  document.getElementById("resetFilterButton").addEventListener("click", clearSubjectFilters);


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
    if (confirm("選択をすべてクリアしますか？")) {
      selectedIds = [];
      choiceCandidateFilter = "";
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