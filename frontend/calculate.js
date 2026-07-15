// 選択した科目だけ取り出す
function getSelectedSubjects(subjects, selectedIds) {
  const selectedSubjects = [];

  for (const subject of subjects) {
    if (selectedIds.includes(subject.id)) {
      selectedSubjects.push(subject);
    }
  }

  return selectedSubjects;
}

// 単位を合計する
function sumCredits(subjects) {
  let total = 0;

  for (const subject of subjects) {
    total += subject.credits;
  }

  return total;
}

// 条件に合う科目の単位を合計する
function sumCreditsBy(subjects, checkFunction) {
  let total = 0;

  for (const subject of subjects) {
    if (checkFunction(subject)) {
      total += subject.credits;
    }
  }

  return total;
}

// 必要単位を超えないようにする
function limitCredits(credits, maxCredits) {
  return Math.min(credits, maxCredits);
}

// 判定結果を作る
function makeCheck(name, earned, required) {
  return {
    name: name,
    earned: earned,
    required: required,
    ok: earned >= required
  };
}

// 外国語の種類を調べる
function getLanguageName(subject) {
  if (subject.field === "英語") {
    return "英語";
  }

  const names = ["ドイツ語", "フランス語", "中国語", "スペイン語", "ロシア語"];

  for (const name of names) {
    if (subject.name.startsWith(name)) {
      return name;
    }
  }

  // 追加科目で新しい外国語分野を作った時に使う
  if (subject.sub_category === "外国語" && subject.field !== "その他の外国語") {
    return subject.field;
  }

  return "その他";
}

// 選んだ外国語の選択必修単位を出す
function getMainLanguageChoiceCredits(subjects, mainLanguage) {
  let total = 0;

  for (const subject of subjects) {
    if (subject.sub_category === "外国語" && subject.requirement_type === "選択必修") {
      if (getLanguageName(subject) === mainLanguage) {
        total += subject.credits;
      }
    }
  }

  return total;
}

const mainCourseName = "情報ネット・メディアコース";
const otherFacultyAppliedNames = ["リサイクルデザイン論", "土木行政実務研修"];

// 情報ネット・メディアコースの専門応用科目か調べる
function isMainCourseApplied(subject) {
  if (subject.sub_category !== "専門応用") {
    return false;
  }

  return subject.course === mainCourseName || subject.course === null || subject.course === undefined || subject.course === "";
}

// 他コース科目で理工学科専門応用に入れない科目か調べる
function isExcludedDepartmentApplied(subject) {
  if (subject.sub_category !== "専門応用" || isMainCourseApplied(subject)) {
    return false;
  }

  const classType = subject.class_type || "";

  return subject.field === "卒業研究関連" ||
    classType.includes("実験") ||
    classType.includes("実習") ||
    classType.includes("実技") ||
    otherFacultyAppliedNames.includes(subject.name);
}

// 理工学科専門応用として使える科目か調べる
function isDepartmentApplied(subject) {
  return subject.sub_category === "専門応用" && !isExcludedDepartmentApplied(subject);
}

// 自主選択学修に直接入れる科目か調べる
function isDirectFreeSubject(subject) {
  return subject.counts_as === "自主選択学修";
}

// 卒業要件を計算する
function calculateResult(subjects, selectedIds, requirements, mainLanguage) {
  const selectedSubjects = getSelectedSubjects(subjects, selectedIds);
  const normalSubjects = selectedSubjects.filter(function (subject) {
    return !isDirectFreeSubject(subject);
  });
  const language = mainLanguage || "英語";

  const totalCredits = sumCredits(selectedSubjects);

  const liberalRequiredCredits = sumCreditsBy(normalSubjects, function (subject) {
    return subject.sub_category === "教養" && subject.requirement_type === "必修";
  });
  const liberalChoiceRequiredCredits = sumCreditsBy(normalSubjects, function (subject) {
    return subject.sub_category === "教養" && subject.requirement_type === "選択必修";
  });
  const liberalHealthOtherCredits = sumCreditsBy(normalSubjects, function (subject) {
    const isLiberalChoice = subject.sub_category === "教養" && subject.requirement_type === "選択";
    const isLiberalRegister = subject.sub_category === "教養" && subject.requirement_type === "登録必須";
    const isHealth = subject.sub_category === "保健体育";

    return isLiberalChoice || isLiberalRegister || isHealth;
  });

  const usedLiberalRequired = limitCredits(liberalRequiredCredits, requirements.common.liberalRequiredCredits);
  const usedLiberalChoice = limitCredits(liberalChoiceRequiredCredits, requirements.common.liberalChoiceRequiredCredits);
  const usedLiberalHealthOther = limitCredits(liberalHealthOtherCredits, requirements.common.liberalHealthOtherCredits);
  const usedLiberalHealthCredits = usedLiberalRequired + usedLiberalChoice + usedLiberalHealthOther;

  const foreignRequiredCredits = sumCreditsBy(normalSubjects, function (subject) {
    return subject.sub_category === "外国語" && subject.requirement_type === "必修";
  });
  const mainLanguageChoiceCredits = getMainLanguageChoiceCredits(normalSubjects, language);

  const usedForeignRequired = limitCredits(foreignRequiredCredits, requirements.common.foreignRequiredCredits);
  const usedMainLanguageChoice = limitCredits(mainLanguageChoiceCredits, requirements.common.sameLanguageChoiceCredits);
  const usedForeignLanguageCredits = usedForeignRequired + usedMainLanguageChoice;

  const usedCommonCredits = usedLiberalHealthCredits + usedForeignLanguageCredits;

  const coreBaseRequiredCredits = sumCreditsBy(normalSubjects, function (subject) {
    return (subject.sub_category === "専門基幹" || subject.sub_category === "専門基礎") && subject.requirement_type === "必修";
  });
  const mathChoiceCredits = sumCreditsBy(normalSubjects, function (subject) {
    return subject.sub_category === "専門基幹" && subject.field === "数学" && subject.requirement_type === "選択必修";
  });
  const coreBaseCredits = sumCreditsBy(normalSubjects, function (subject) {
    return subject.sub_category === "専門基幹" || subject.sub_category === "専門基礎";
  });

  const usedCoreBaseRequired = limitCredits(coreBaseRequiredCredits, requirements.professional.coreBaseRequiredCredits);
  const usedMathChoice = limitCredits(mathChoiceCredits, requirements.professional.mathChoiceCredits);
  const coreBaseRestCredits = Math.max(0, coreBaseCredits - usedCoreBaseRequired - usedMathChoice);
  const usedCoreBaseOther = limitCredits(coreBaseRestCredits, requirements.professional.coreBaseOtherCredits);
  const usedCoreBaseCredits = usedCoreBaseRequired + usedMathChoice + usedCoreBaseOther;

  const appliedRequiredCredits = sumCreditsBy(normalSubjects, function (subject) {
    return isMainCourseApplied(subject) && subject.requirement_type === "必修";
  });
  const programmingChoiceCredits = sumCreditsBy(normalSubjects, function (subject) {
    return isMainCourseApplied(subject) && subject.field === "プログラミング" && subject.requirement_type === "選択必修";
  });
  const mainCourseAppliedCredits = sumCreditsBy(normalSubjects, function (subject) {
    return isMainCourseApplied(subject);
  });
  const departmentAppliedCredits = sumCreditsBy(normalSubjects, function (subject) {
    return isDepartmentApplied(subject);
  });

  const usedAppliedRequired = limitCredits(appliedRequiredCredits, requirements.professional.appliedRequiredCredits);
  const usedProgrammingChoice = limitCredits(programmingChoiceCredits, requirements.professional.programmingChoiceCredits);
  const mainCourseAppliedRestCredits = Math.max(0, mainCourseAppliedCredits - usedAppliedRequired - usedProgrammingChoice);
  const usedCourseAppliedChoice = limitCredits(mainCourseAppliedRestCredits, requirements.professional.courseAppliedChoiceCredits);
  const departmentAppliedCandidate = Math.max(0, departmentAppliedCredits - usedAppliedRequired - usedProgrammingChoice - usedCourseAppliedChoice);
  const usedDepartmentApplied = limitCredits(departmentAppliedCandidate, requirements.professional.departmentAppliedCredits);
  const usedAppliedCredits = usedAppliedRequired + usedProgrammingChoice + usedCourseAppliedChoice + usedDepartmentApplied;

  const usedProfessionalCredits = usedCoreBaseCredits + usedAppliedCredits;

  // 共通科目や専門科目で使わなかった分は自主選択へ回す
  const freeCredits = Math.max(0, totalCredits - usedCommonCredits - usedProfessionalCredits);

  const missingRequiredSubjects = [];
  const missingRegisterSubjects = [];

  for (const subject of subjects) {
    if (!isDirectFreeSubject(subject) && subject.requirement_type === "必修" && !selectedIds.includes(subject.id)) {
      missingRequiredSubjects.push(subject);
    }

    if (!isDirectFreeSubject(subject) && subject.requirement_type === "登録必須" && !selectedIds.includes(subject.id)) {
      missingRegisterSubjects.push(subject);
    }
  }

  const checks = [
    makeCheck("総単位", totalCredits, requirements.totalCredits),
    makeCheck("共通科目", usedCommonCredits, requirements.commonCredits),
    makeCheck("教養・保健体育", usedLiberalHealthCredits, requirements.common.liberalHealthCredits),
    makeCheck("教養必修", usedLiberalRequired, requirements.common.liberalRequiredCredits),
    makeCheck("教養選択必修", usedLiberalChoice, requirements.common.liberalChoiceRequiredCredits),
    makeCheck("教養・保健体育の選択", usedLiberalHealthOther, requirements.common.liberalHealthOtherCredits),
    makeCheck("外国語", usedForeignLanguageCredits, requirements.common.foreignLanguageCredits),
    makeCheck("必修英語", usedForeignRequired, requirements.common.foreignRequiredCredits),
    makeCheck("同一外国語（" + language + "）", usedMainLanguageChoice, requirements.common.sameLanguageChoiceCredits),
    makeCheck("専門科目", usedProfessionalCredits, requirements.professionalCredits),
    makeCheck("専門基幹・専門基礎", usedCoreBaseCredits, requirements.professional.coreBaseCredits),
    makeCheck("専門基幹・専門基礎の必修", usedCoreBaseRequired, requirements.professional.coreBaseRequiredCredits),
    makeCheck("数学分野の選択必修", usedMathChoice, requirements.professional.mathChoiceCredits),
    makeCheck("専門基幹・専門基礎の選択", usedCoreBaseOther, requirements.professional.coreBaseOtherCredits),
    makeCheck("専門応用", usedAppliedCredits, requirements.professional.appliedCredits),
    makeCheck("専門応用の必修", usedAppliedRequired, requirements.professional.appliedRequiredCredits),
    makeCheck("プログラミング選択必修", usedProgrammingChoice, requirements.professional.programmingChoiceCredits),
    makeCheck("専門応用の選択", usedCourseAppliedChoice, requirements.professional.courseAppliedChoiceCredits),
    makeCheck("理工学科専門応用", usedDepartmentApplied, requirements.professional.departmentAppliedCredits),
    makeCheck("自主選択学修", freeCredits, requirements.freeCredits)
  ];

  let allChecksOk = true;

  for (const check of checks) {
    if (!check.ok) {
      allChecksOk = false;
    }
  }

  return {
    totalCredits: totalCredits,
    selectedCount: selectedSubjects.length,
    checks: checks,
    missingRequiredSubjects: missingRequiredSubjects,
    missingRegisterSubjects: missingRegisterSubjects,
    graduationOk: allChecksOk && missingRequiredSubjects.length === 0
  };
}

if (typeof module !== "undefined") {
  module.exports = {
    calculateResult,
    getSelectedSubjects,
    sumCredits,
    getLanguageName
  };
}