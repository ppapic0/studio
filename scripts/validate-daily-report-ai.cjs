const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');

const sourcePath = path.resolve(__dirname, '../src/lib/daily-report-ai.ts');
const sourceText = fs.readFileSync(sourcePath, 'utf8');
const compiled = ts.transpileModule(sourceText, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
  fileName: sourcePath,
});

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'daily-report-ai-'));
const tempPath = path.join(tempDir, 'daily-report-ai.cjs');
fs.writeFileSync(tempPath, compiled.outputText, 'utf8');

const {
  resolveDailyReportLevel,
  selectDailyReportVariation,
  normalizeDailyReportContentFingerprint,
  isDailyReportFingerprintBlocked,
} = require(tempPath);

const variationBaseInput = {
  studentId: 'student-alpha',
  dateKey: '2026-04-07',
  stateBucket: '기준학습|상승|양호|안정|정상|유지중',
  pedagogyLens: '자기조절',
  internalStage: 10,
};

try {
  assert.equal(resolveDailyReportLevel(30, 100).internalStage, 1, '30분은 내부 1단계여야 합니다.');
  assert.equal(resolveDailyReportLevel(31, 100).internalStage, 2, '31분은 내부 2단계여야 합니다.');
  assert.equal(resolveDailyReportLevel(300, 100).internalStage, 10, '300분은 내부 10단계여야 합니다.');
  assert.equal(resolveDailyReportLevel(301, 100).internalStage, 11, '301분은 내부 11단계여야 합니다.');
  assert.equal(resolveDailyReportLevel(570, 100).internalStage, 19, '570분은 내부 19단계여야 합니다.');
  assert.equal(resolveDailyReportLevel(600, 100).internalStage, 20, '600분은 내부 20단계여야 합니다.');

  const firstVariation = selectDailyReportVariation({
    ...variationBaseInput,
    generationAttempt: 1,
  });
  const secondVariation = selectDailyReportVariation({
    ...variationBaseInput,
    generationAttempt: 2,
    excludedVariationSignatures: [firstVariation.variationSignature],
    excludedContentFingerprints: ['기존본문지문'],
  });
  assert.notEqual(
    firstVariation.variationSignature,
    secondVariation.variationSignature,
    '생성 시도 횟수가 바뀌면 variation 시그니처가 달라져야 합니다.',
  );

  const recentVariationSignatures = [];
  for (let attempt = 1; attempt <= 7; attempt += 1) {
    const variation = selectDailyReportVariation({
      ...variationBaseInput,
      generationAttempt: attempt,
      excludedVariationSignatures: recentVariationSignatures,
    });
    recentVariationSignatures.push(variation.variationSignature);
  }
  const nextVariation = selectDailyReportVariation({
    ...variationBaseInput,
    generationAttempt: 8,
    excludedVariationSignatures: recentVariationSignatures,
  });
  assert.equal(
    recentVariationSignatures.includes(nextVariation.variationSignature),
    false,
    '최근 7개 시그니처에 포함된 variation은 재사용하지 않아야 합니다.',
  );

  const fingerprintA = normalizeDailyReportContentFingerprint('🕒 2026-04-07 학습 완료');
  const fingerprintB = normalizeDailyReportContentFingerprint('학습 완료');
  assert.equal(
    fingerprintA,
    fingerprintB,
    'fingerprint는 날짜/숫자/공백/이모지 차이를 제거한 뒤 동일해야 합니다.',
  );
  assert.equal(
    isDailyReportFingerprintBlocked('🕒 2026-04-07 학습 완료', [fingerprintB]),
    true,
    '정규화 fingerprint가 같으면 중복으로 판단해야 합니다.',
  );

  console.log('daily-report-ai checks passed');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
