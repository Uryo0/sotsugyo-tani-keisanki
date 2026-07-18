const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { calculateResult } = require("../frontend/calculate.js");

const rootDir = path.join(__dirname, "..");
const subjects = JSON.parse(fs.readFileSync(path.join(rootDir, "data", "subjects.json"), "utf8"));
const requirements = JSON.parse(fs.readFileSync(path.join(rootDir, "data", "requirements.json"), "utf8"));

function findSubject(name) {
  const subject = subjects.find(function (item) {
    return item.name === name;
  });

  assert.ok(subject, name + " が subjects.json に見つかりません。");
  return subject;
}

function ids(names) {
  return names.map(function (name) {
    return findSubject(name).id;
  });
}

function getCheck(result, name) {
  const check = result.checks.find(function (item) {
    return item.name === name;
  });

  assert.ok(check, name + " の計算結果が見つかりません。");
  return check;
}

function calculateByNames(names, mainLanguage) {
  return calculateResult(subjects, ids(names), requirements, mainLanguage);
}

test("英語を5単位選ぶと、同一外国語4単位と自主選択学修1単位になる", function () {
  const result = calculateByNames([
    "英語講読（科学・基礎）",
    "英語講読（科学）",
    "英語講読（文学）",
    "資格英語（TOEIC基礎）",
    "資格英語（TOEIC中級）"
  ], "英語");

  assert.equal(getCheck(result, "同一外国語（英語）").earned, 4);
  assert.equal(getCheck(result, "自主選択学修").earned, 1);
});

test("英語がメインの時にドイツ語を2単位選ぶと、自主選択学修2単位になる", function () {
  const result = calculateByNames([
    "ドイツ語ⅠＡ（文法）",
    "ドイツ語ⅠＢ（文法）"
  ], "英語");

  assert.equal(getCheck(result, "同一外国語（英語）").earned, 0);
  assert.equal(getCheck(result, "自主選択学修").earned, 2);
});

test("教養選択必修を4単位選ぶと、2単位を超えた分は自主選択学修になる", function () {
  const result = calculateByNames([
    "かながわ学（ＩＴ産業）",
    "かながわ学（環境）"
  ], "英語");

  assert.equal(getCheck(result, "教養選択必修").earned, 2);
  assert.equal(getCheck(result, "教養・保健体育の選択").earned, 0);
  assert.equal(getCheck(result, "自主選択学修").earned, 2);
});

test("counts_as が自主選択学修の科目は、通常の枠に入らず自主選択学修になる", function () {
  const result = calculateByNames(["数学基礎Ⅰ"], "英語");

  assert.equal(getCheck(result, "外国語").earned, 0);
  assert.equal(getCheck(result, "専門基幹・専門基礎").earned, 0);
  assert.equal(getCheck(result, "自主選択学修").earned, 2);
});

test("数学選択必修を8単位選ぶと、6単位を超えた分は専門基幹・専門基礎の選択に流れる", function () {
  const result = calculateByNames([
    "微分積分学Ⅰ",
    "微分積分学Ⅱ",
    "線形数学Ⅰ",
    "線形数学Ⅱ"
  ], "英語");

  assert.equal(getCheck(result, "数学分野の選択必修").earned, 6);
  assert.equal(getCheck(result, "専門基幹・専門基礎の選択").earned, 2);
  assert.equal(getCheck(result, "自主選択学修").earned, 0);
});

test("自コース専門応用の超過分は理工学科専門応用6単位に流れ、さらに超過すると自主選択学修になる", function () {
  const result = calculateByNames([
    "情報数学",
    "情報理論",
    "情報システム論",
    "コンピュータアーキテクチャ",
    "データ構造とアルゴリズムⅠ",
    "人工知能演習",
    "オペレーティングシステム",
    "情報セキュリティ",
    "プログラミング[アルゴリズム論]",
    "プログラミング[構造化]",
    "プログラミング[JAVA応用Ⅰ]",
    "ネットワーク工学",
    "ソフトウェア設計",
    "情報学実験",
    "情報ネット・メディア総合演習",
    "卒業研究基礎",
    "卒業研究Ⅰ",
    "卒業研究Ⅱ",
    "プログラミング[JAVA応用Ⅱ]",
    "パソコン製作演習",
    "アセンブラプログラミング",
    "データ構造とアルゴリズムⅡ",
    "データ解析基礎",
    "ソフトウェア工学Ⅰ",
    "ソフトウェア工学",
    "情報ネット・メディア技術英語",
    "情報倫理",
    "ヒューマンコンピュータインタラクション",
    "ＵＮＩＸ演習",
    "データベース理論及び演習",
    "データベース応用及び演習",
    "数値解析",
    "信号処理Ⅰ",
    "信号処理Ⅱ"
  ], "英語");

  assert.equal(getCheck(result, "専門応用の必修").earned, 38);
  assert.equal(getCheck(result, "プログラミング選択必修").earned, 2);
  assert.equal(getCheck(result, "専門応用の選択").earned, 18);
  assert.equal(getCheck(result, "理工学科専門応用").earned, 6);
  assert.equal(getCheck(result, "自主選択学修").earned, 6);
});

test("他コースの実験・実習・実技・卒業研究関連科目は理工学科専門応用に入らない", function () {
  const result = calculateByNames([
    "生物学・化学基礎実験",
    "施設見学実習",
    "人間情報学実習Ⅰ",
    "応用化学研究基礎"
  ], "英語");

  assert.equal(getCheck(result, "理工学科専門応用").earned, 0);
  assert.equal(getCheck(result, "自主選択学修").earned, 8);
});

test("フィールド調査実習は実習科目として理工学科専門応用に入らない", function () {
  const fieldTraining = findSubject("フィールド調査実習");
  const result = calculateResult(subjects, [fieldTraining.id], requirements, "英語");

  assert.equal(fieldTraining.class_type, "実習");
  assert.equal(getCheck(result, "理工学科専門応用").earned, 0);
  assert.equal(getCheck(result, "自主選択学修").earned, 2);
});

test("防災・復興論は自主選択学修に直接入る", function () {
  const disasterSubject = findSubject("防災・復興論");
  const result = calculateResult(subjects, [disasterSubject.id], requirements, "英語");

  assert.equal(disasterSubject.counts_as, "自主選択学修");
  assert.equal(getCheck(result, "理工学科専門応用").earned, 0);
  assert.equal(getCheck(result, "自主選択学修").earned, 2);
});
