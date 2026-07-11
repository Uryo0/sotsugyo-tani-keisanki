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

  return "その他";
}

// 同じ外国語で一番多く取れている単位を出す
function getBestSameLanguageCredits(subjects) {
  const languageCredits = {};

  for (const subject of subjects) {
    if (subject.sub_category === "外国語" && subject.requirement_type === "選択必修") {
      const languageName = getLanguageName(subject);

      if (languageCredits[languageName] === undefined) {
        languageCredits[languageName] = 0;
      }

      languageCredits[languageName] += subject.credits;
    }
  }

  let bestCredits = 0;

  for (const languageName in languageCredits) {
    if (languageCredits[languageName] > bestCredits) {
      bestCredits = languageCredits[languageName];
    }
  }

  return bestCredits;
}

// 卒業要件を計算する
function calculateResult(subjects, selectedIds, requirements) {
  const selectedSubjects = getSelectedSubjects(subjects, selectedIds);

  const totalCredits = sumCredits(selectedSubjects);
  const commonCredits = sumCreditsBy(selectedSubjects, function (subject) {
    return subject.category === "共通";
  });
  const professionalCredits = sumCreditsBy(selectedSubjects, function (subject) {
    return subject.category === "専門";
  });

  const liberalHealthCredits = sumCreditsBy(selectedSubjects, function (subject) {
    return subject.sub_category === "教養" || subject.sub_category === "保健体育";
  });
  const liberalRequiredCredits = sumCreditsBy(selectedSubjects, function (subject) {
    return subject.sub_category === "教養" && subject.requirement_type === "必修";
  });
  const liberalChoiceRequiredCredits = sumCreditsBy(selectedSubjects, function (subject) {
    return subject.sub_category === "教養" && subject.requirement_type === "選択必修";
  });

  const usedLiberalRequired = Math.min(liberalRequiredCredits, requirements.common.liberalRequiredCredits);
  const usedLiberalChoice = Math.min(liberalChoiceRequiredCredits, requirements.common.liberalChoiceRequiredCredits);
  const liberalHealthOtherCredits = Math.max(0, liberalHealthCredits - usedLiberalRequired - usedLiberalChoice);

  const foreignLanguageCredits = sumCreditsBy(selectedSubjects, function (subject) {
    return subject.sub_category === "外国語";
  });
  const foreignRequiredCredits = sumCreditsBy(selectedSubjects, function (subject) {
    return subject.sub_category === "外国語" && subject.requirement_type === "必修";
  });
  const sameLanguageChoiceCredits = getBestSameLanguageCredits(selectedSubjects);

  const coreBaseCredits = sumCreditsBy(selectedSubjects, function (subject) {
    return subject.sub_category === "専門基幹" || subject.sub_category === "専門基礎";
  });
  const coreBaseRequiredCredits = sumCreditsBy(selectedSubjects, function (subject) {
    return (subject.sub_category === "専門基幹" || subject.sub_category === "専門基礎") && subject.requirement_type === "必修";
  });
  const mathChoiceCredits = sumCreditsBy(selectedSubjects, function (subject) {
    return subject.sub_category === "専門基幹" && subject.field === "数学" && subject.requirement_type === "選択必修";
  });

  const usedCoreBaseRequired = Math.min(coreBaseRequiredCredits, requirements.professional.coreBaseRequiredCredits);
  const usedMathChoice = Math.min(mathChoiceCredits, requirements.professional.mathChoiceCredits);
  const coreBaseOtherCredits = Math.max(0, coreBaseCredits - usedCoreBaseRequired - usedMathChoice);

  const appliedCredits = sumCreditsBy(selectedSubjects, function (subject) {
    return subject.sub_category === "専門応用";
  });
  const appliedRequiredCredits = sumCreditsBy(selectedSubjects, function (subject) {
    return subject.sub_category === "専門応用" && subject.requirement_type === "必修";
  });
  const programmingChoiceCredits = sumCreditsBy(selectedSubjects, function (subject) {
    return subject.sub_category === "専門応用" && subject.field === "プログラミング" && subject.requirement_type === "選択必修";
  });

  const usedAppliedRequired = Math.min(appliedRequiredCredits, requirements.professional.appliedRequiredCredits);
  const usedProgrammingChoice = Math.min(programmingChoiceCredits, requirements.professional.programmingChoiceCredits);
  const appliedRestCredits = Math.max(0, appliedCredits - usedAppliedRequired - usedProgrammingChoice);
  const courseAppliedChoiceCredits = Math.min(appliedRestCredits, requirements.professional.courseAppliedChoiceCredits);
  const departmentAppliedCredits = Math.max(0, appliedRestCredits - requirements.professional.courseAppliedChoiceCredits);

  const usedCommonCredits = Math.min(commonCredits, requirements.commonCredits);
  const usedProfessionalCredits = Math.min(professionalCredits, requirements.professionalCredits);
  const freeCredits = Math.max(0, totalCredits - usedCommonCredits - usedProfessionalCredits);

  const missingRequiredSubjects = [];
  const missingRegisterSubjects = [];

  for (const subject of subjects) {
    if (subject.requirement_type === "必修" && !selectedIds.includes(subject.id)) {
      missingRequiredSubjects.push(subject);
    }

    if (subject.requirement_type === "登録必須" && !selectedIds.includes(subject.id)) {
      missingRegisterSubjects.push(subject);
    }
  }

  const checks = [
    makeCheck("総単位", totalCredits, requirements.totalCredits),
    makeCheck("共通科目", commonCredits, requirements.commonCredits),
    makeCheck("教養・保健体育", liberalHealthCredits, requirements.common.liberalHealthCredits),
    makeCheck("教養必修", liberalRequiredCredits, requirements.common.liberalRequiredCredits),
    makeCheck("教養選択必修", liberalChoiceRequiredCredits, requirements.common.liberalChoiceRequiredCredits),
    makeCheck("教養・保健体育の選択", liberalHealthOtherCredits, requirements.common.liberalHealthOtherCredits),
    makeCheck("外国語", foreignLanguageCredits, requirements.common.foreignLanguageCredits),
    makeCheck("必修英語", foreignRequiredCredits, requirements.common.foreignRequiredCredits),
    makeCheck("同一外国語の選択必修", sameLanguageChoiceCredits, requirements.common.sameLanguageChoiceCredits),
    makeCheck("専門科目", professionalCredits, requirements.professionalCredits),
    makeCheck("専門基幹・専門基礎", coreBaseCredits, requirements.professional.coreBaseCredits),
    makeCheck("専門基幹・専門基礎の必修", coreBaseRequiredCredits, requirements.professional.coreBaseRequiredCredits),
    makeCheck("数学分野の選択必修", mathChoiceCredits, requirements.professional.mathChoiceCredits),
    makeCheck("専門基幹・専門基礎の選択", coreBaseOtherCredits, requirements.professional.coreBaseOtherCredits),
    makeCheck("専門応用", appliedCredits, requirements.professional.appliedCredits),
    makeCheck("専門応用の必修", appliedRequiredCredits, requirements.professional.appliedRequiredCredits),
    makeCheck("プログラミング選択必修", programmingChoiceCredits, requirements.professional.programmingChoiceCredits),
    makeCheck("専門応用の選択", courseAppliedChoiceCredits, requirements.professional.courseAppliedChoiceCredits),
    makeCheck("理工学科専門応用", departmentAppliedCredits, requirements.professional.departmentAppliedCredits),
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
    sumCredits
  };
}