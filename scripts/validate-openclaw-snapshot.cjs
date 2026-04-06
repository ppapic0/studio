const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const sourcePath = path.resolve(__dirname, '../functions/src/openclawSnapshot.ts');
const sourceText = fs.readFileSync(sourcePath, 'utf8');
const compiled = ts.transpileModule(sourceText, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
  fileName: sourcePath,
});

const tempDir = fs.mkdtempSync(path.join(__dirname, 'openclaw-snapshot-'));
const tempPath = path.join(tempDir, 'openclawSnapshot.cjs');
fs.writeFileSync(tempPath, compiled.outputText, 'utf8');

const {
  OPENCLAW_SCHEMA_VERSION,
  OPENCLAW_TIMEZONE,
  buildOpenClawHistoryPath,
  createEmptyOpenClawSnapshot,
  isDateKeyInRange,
  serializeSnapshotValue,
} = require(tempPath);

try {
  const windows = {
    attendance: {
      fromDateKey: '2026-03-04',
      toDateKey: '2026-04-07',
      days: 35,
    },
    consultations: {
      logsFromISO: '2026-01-09T00:00:00.000Z',
      logsToISO: '2026-04-07T00:00:00.000Z',
      reservationsFromISO: '2026-03-08T00:00:00.000Z',
      reservationsToISO: '2026-05-07T00:00:00.000Z',
    },
    billing: {
      invoicesFromISO: '2025-10-10T00:00:00.000Z',
      paymentsFromISO: '2025-10-10T00:00:00.000Z',
      kpiFromDateKey: '2026-03-04',
      kpiToDateKey: '2026-04-07',
    },
    studyRoomUsage: {
      fromDateKey: '2026-03-04',
      toDateKey: '2026-04-07',
      sessionFromDateKey: '2026-03-25',
      sessionToDateKey: '2026-04-07',
    },
    derived: {
      kpiFromDateKey: '2026-03-04',
      kpiToDateKey: '2026-04-07',
      latestOnly: ['riskCache', 'classroomSignals'],
    },
  };

  const emptySnapshot = createEmptyOpenClawSnapshot({
    centerId: 'center-alpha',
    generatedAt: '2026-04-07T04:10:00.000Z',
    windows,
  });

  assert.equal(emptySnapshot.schemaVersion, OPENCLAW_SCHEMA_VERSION, '스키마 버전이 고정되어야 합니다.');
  assert.equal(emptySnapshot.timezone, OPENCLAW_TIMEZONE, '타임존은 KST로 고정되어야 합니다.');
  assert.deepEqual(emptySnapshot.windows, windows, '윈도우 정보는 그대로 유지되어야 합니다.');
  assert.deepEqual(emptySnapshot.students, { memberships: [], profiles: [], growthProgress: [] });
  assert.deepEqual(emptySnapshot.attendance, { records: [], schedules: [], currentSeats: [] });
  assert.deepEqual(emptySnapshot.consultations, { logs: [], reservations: [] });
  assert.deepEqual(emptySnapshot.billing, { invoices: [], payments: [], kpiDaily: [] });
  assert.deepEqual(emptySnapshot.studyRoomUsage, { dailyStudentStats: [], studyLogDays: [], sessions: [] });
  assert.deepEqual(emptySnapshot.derived, { riskCache: null, classroomSignals: null, kpiDaily: [] });

  const serialized = serializeSnapshotValue({
    createdAt: new Date('2026-04-07T04:10:00.000Z'),
    updatedAt: { toDate: () => new Date('2026-04-07T05:20:30.000Z') },
    nested: {
      lastSeenAt: { seconds: 1775535600, nanoseconds: 0 },
      keep: true,
      drop: undefined,
    },
    list: [
      'ok',
      undefined,
      new Date('2026-04-06T23:59:59.000Z'),
    ],
  });

  assert.deepEqual(serialized, {
    createdAt: '2026-04-07T04:10:00.000Z',
    updatedAt: '2026-04-07T05:20:30.000Z',
    nested: {
      lastSeenAt: '2026-04-07T04:20:00.000Z',
      keep: true,
    },
    list: [
      'ok',
      '2026-04-06T23:59:59.000Z',
    ],
  }, '날짜/타임스탬프는 ISO 문자열로 직렬화되고 undefined 는 제거되어야 합니다.');

  assert.equal(isDateKeyInRange('2026-04-07', '2026-04-07', '2026-04-07'), true, '경계값은 포함되어야 합니다.');
  assert.equal(isDateKeyInRange('2026-04-01', '2026-04-02', '2026-04-07'), false, '범위 밖 날짜는 제외되어야 합니다.');

  const historyPath = buildOpenClawHistoryPath('center-alpha', new Date('2026-04-07T04:10:09+09:00'));
  assert.equal(
    historyPath,
    'openclaw/centers/center-alpha/history/2026/04/07/041009.json',
    '히스토리 경로는 KST 기준 경로 규칙을 따라야 합니다.',
  );

  console.log('openclaw snapshot checks passed');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
