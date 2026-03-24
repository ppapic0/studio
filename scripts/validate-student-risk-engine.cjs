const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');

const sourcePath = path.resolve(__dirname, '../src/lib/student-risk-engine.ts');
const sourceText = fs.readFileSync(sourcePath, 'utf8');
const compiled = ts.transpileModule(sourceText, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
  fileName: sourcePath,
});

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'student-risk-engine-'));
const tempPath = path.join(tempDir, 'student-risk-engine.cjs');
fs.writeFileSync(tempPath, compiled.outputText, 'utf8');

const {
  analyzeStudentRisk,
  buildExecutiveRiskSummary,
} = require(tempPath);

const baseInput = {
  growthRate: 0.7,
  lowStudyStreak: 0,
  completionRate: 88,
  penalty: 0,
  focusStat: 82,
  consistency: 86,
  studyVariance: 18,
  todayMinutes: 310,
  achievement: 84,
  resilience: 82,
  avgStudyMinutes7d: 280,
  trend14d: 0.12,
  todayVsAverageDeltaRate: 0.08,
  consecutiveLowPerformanceDays: 0,
  observedDays: 14,
  lastActivityDaysAgo: 0,
  hasTodayStat: true,
  hasGrowthProgress: true,
  hasRecentStudyLogs: true,
};

function analyze(overrides = {}, revenue = {}) {
  return analyzeStudentRisk(
    { ...baseInput, ...overrides },
    {
      studentId: `student-${Math.random().toString(36).slice(2, 8)}`,
      studentName: '테스트 학생',
      className: 'A반',
    },
    revenue,
  );
}

try {
  const healthy = analyze();
  const risky = analyze({
    growthRate: 0.12,
    lowStudyStreak: 5,
    completionRate: 42,
    penalty: 7,
    focusStat: 28,
    consistency: 34,
    studyVariance: 82,
    todayMinutes: 75,
    achievement: 38,
    resilience: 30,
    avgStudyMinutes7d: 105,
    trend14d: -0.32,
    todayVsAverageDeltaRate: -0.58,
    consecutiveLowPerformanceDays: 4,
    lastActivityDaysAgo: 3,
  }, { latestInvoiceAmount: 420000, outstandingAmount: 180000 });

  assert.ok(
    healthy.dimensions.overall < risky.dimensions.overall,
    '좋은 지표 학생보다 위험 학생의 종합 점수가 더 높아야 합니다.',
  );

  const focusBaseline = analyze({ todayMinutes: 250, todayVsAverageDeltaRate: 0 });
  const focusWorse = analyze({ todayMinutes: 90, todayVsAverageDeltaRate: -0.6 });
  assert.ok(
    focusWorse.dimensions.focus > focusBaseline.dimensions.focus,
    '당일 학습량이 악화되면 focus 차원 점수가 올라가야 합니다.',
  );
  assert.equal(
    focusWorse.topFactors.some((factor) => factor.dimension === 'focus'),
    true,
    '집중 저하 상황에서는 상위 요인에 focus 차원 요인이 포함되어야 합니다.',
  );

  const boundaryA = analyze({ completionRate: 61, growthRate: 0.42, todayMinutes: 195 });
  const boundaryB = analyze({ completionRate: 59, growthRate: 0.39, todayMinutes: 185 });
  assert.ok(
    Math.abs(boundaryA.dimensions.overall - boundaryB.dimensions.overall) <= 12,
    '인접한 경계값에서 점수가 비정상적으로 급등하면 안 됩니다.',
  );

  const newStudent = analyze({
    observedDays: 3,
    hasRecentStudyLogs: false,
    hasTodayStat: false,
    todayMinutes: 0,
    avgStudyMinutes7d: 0,
    todayVsAverageDeltaRate: -1,
  });
  const experiencedStudent = analyze({
    observedDays: 14,
    hasRecentStudyLogs: true,
    hasTodayStat: true,
  });
  assert.ok(
    newStudent.confidenceScore < experiencedStudent.confidenceScore,
    '관측일이 적은 학생은 신뢰도가 더 낮아야 합니다.',
  );

  const invoiceExposure = analyze({}, { latestInvoiceAmount: 350000, monthlyFee: 180000, outstandingAmount: 120000 });
  const membershipExposure = analyze({}, { monthlyFee: 180000 });
  assert.equal(invoiceExposure.revenue.basisSource, 'invoice', '인보이스가 있으면 인보이스 기준을 우선 사용해야 합니다.');
  assert.equal(membershipExposure.revenue.basisSource, 'membership', '인보이스가 없으면 월회비를 폴백으로 사용해야 합니다.');

  const executive = buildExecutiveRiskSummary([healthy, risky, focusWorse, newStudent]);
  assert.ok(executive.ceo.topStudents.length > 0, 'CEO 요약에는 우선 관리 학생이 포함되어야 합니다.');
  assert.ok(executive.cfo.revenueAtRisk >= risky.revenue.revenueAtRisk, 'CFO 요약은 학생별 위험 매출을 집계해야 합니다.');
  assert.ok(executive.coo.actionQueue.length > 0, 'COO 요약에는 운영 액션 큐가 생성되어야 합니다.');
  assert.ok(executive.cto.lowConfidenceStudents >= 1, 'CTO 요약에는 저신뢰 학생 집계가 포함되어야 합니다.');

  console.log('student-risk-engine checks passed');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
