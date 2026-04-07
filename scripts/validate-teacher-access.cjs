const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function compileModule(sourcePath, outputPath, replacements = []) {
  let sourceText = fs.readFileSync(sourcePath, 'utf8');
  replacements.forEach(({ from, to }) => {
    sourceText = sourceText.replace(from, to);
  });

  const compiled = ts.transpileModule(sourceText, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: sourcePath,
  });

  fs.writeFileSync(outputPath, compiled.outputText, 'utf8');
}

const repoRoot = path.resolve(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(repoRoot, '.tmp-teacher-access-'));

try {
  const dashboardAccessPath = path.join(repoRoot, 'src/lib/dashboard-access.ts');
  const serverAccessPath = path.join(repoRoot, 'src/lib/server-dashboard-access.ts');
  const heatmapPath = path.join(repoRoot, 'src/lib/center-admin-heatmap.ts');
  const seatHeatmapPath = path.join(repoRoot, 'src/lib/center-admin-seat-heatmap.ts');

  const dashboardAccessOutput = path.join(tempDir, 'dashboard-access.cjs');
  const serverAccessOutput = path.join(tempDir, 'server-dashboard-access.cjs');
  const heatmapOutput = path.join(tempDir, 'center-admin-heatmap.cjs');
  const seatHeatmapOutput = path.join(tempDir, 'center-admin-seat-heatmap.cjs');

  compileModule(dashboardAccessPath, dashboardAccessOutput);
  compileModule(serverAccessPath, serverAccessOutput, [
    { from: /import 'server-only';\r?\n/g, to: '' },
    { from: /import \{ adminDb \} from '@\/lib\/firebase-admin';\r?\n/g, to: 'const adminDb = null;\n' },
    { from: /from '@\/lib\/dashboard-access'/g, to: "from './dashboard-access.cjs'" },
  ]);
  compileModule(heatmapPath, heatmapOutput);
  compileModule(seatHeatmapPath, seatHeatmapOutput, [
    { from: /from '@\/lib\/center-admin-heatmap'/g, to: "from './center-admin-heatmap.cjs'" },
  ]);

  const {
    canReadSharedOps,
    canReadLeadOps,
    canTransitionLeadPipeline,
    canManageLeadRecords,
    canReadFinance,
    canManageSettings,
    canManageStaff,
    canRunExports,
  } = require(dashboardAccessOutput);
  const {
    getDashboardRouteAccess,
    canAccessDashboardPath,
  } = require(serverAccessOutput);
  const {
    buildCenterAdminSecondaryFlags,
    buildCenterAdminSeatLegend,
    buildCenterAdminSeatOverlaySummary,
    getCenterAdminDomainSummary,
  } = require(seatHeatmapOutput);

  assert.equal(canReadSharedOps('teacher'), true, 'teacher should access shared ops');
  assert.equal(canReadLeadOps('teacher'), true, 'teacher should access lead ops');
  assert.equal(canTransitionLeadPipeline('teacher'), true, 'teacher should transition lead pipeline');
  assert.equal(canManageLeadRecords('teacher'), false, 'teacher should not manage lead records');
  assert.equal(canManageLeadRecords('centerAdmin'), true, 'admin should manage lead records');
  assert.equal(canReadFinance('teacher'), false, 'teacher should not access finance');
  assert.equal(canReadFinance('centerAdmin'), true, 'admin should access finance');
  assert.equal(canManageSettings('teacher'), false, 'teacher should not manage settings');
  assert.equal(canManageSettings('owner'), true, 'owner should manage settings');
  assert.equal(canManageStaff('teacher'), false, 'teacher should not manage staff');
  assert.equal(canManageStaff('centerAdmin'), true, 'admin should manage staff');
  assert.equal(canRunExports('teacher'), false, 'teacher should not run exports');
  assert.equal(canRunExports('centerAdmin'), true, 'admin should run exports');

  assert.equal(getDashboardRouteAccess('/dashboard/reports'), 'sharedOps');
  assert.equal(getDashboardRouteAccess('/dashboard/leads'), 'leadOps');
  assert.equal(getDashboardRouteAccess('/dashboard/revenue'), 'finance');
  assert.equal(getDashboardRouteAccess('/dashboard/analytics'), 'finance');
  assert.equal(getDashboardRouteAccess('/dashboard/settings/notifications'), 'settings');

  const teacherMemberships = [{ id: 'center-a', role: 'teacher', status: 'active' }];
  const adminMemberships = [{ id: 'center-a', role: 'centerAdmin', status: 'active' }];

  assert.equal(canAccessDashboardPath('/dashboard/reports', teacherMemberships), true);
  assert.equal(canAccessDashboardPath('/dashboard/leads', teacherMemberships), true);
  assert.equal(canAccessDashboardPath('/dashboard/revenue', teacherMemberships), false);
  assert.equal(canAccessDashboardPath('/dashboard/settings/notifications', teacherMemberships), false);
  assert.equal(canAccessDashboardPath('/dashboard/revenue', adminMemberships), true);
  assert.equal(canAccessDashboardPath('/dashboard/settings/invites', adminMemberships), true);

  const flags = buildCenterAdminSecondaryFlags(
    {
      hasUnreadReport: true,
      hasCounselingToday: true,
      invoiceStatus: 'overdue',
      currentAwayMinutes: 25,
      status: 'away',
    },
    { includeFinancialSignals: false },
  );
  assert.equal(flags.includes('미수금'), false, 'financial flags should be hidden');
  assert.deepEqual(buildCenterAdminSeatLegend({ includeFinancialSignals: false }).billing, []);

  const sampleSignal = {
    studentId: 'student-a',
    seatId: 'seat-1',
    studentName: '학생 A',
    attendanceStatus: 'studying',
    compositeHealth: 72,
    domainScores: {
      operational: 80,
      parent: 76,
      risk: 68,
      billing: 20,
      efficiency: 74,
    },
    todayMinutes: 180,
    weeklyStudyMinutes: 600,
    weeklyStudyLabel: '주간 10h 0m',
    effectivePenaltyPoints: 4,
    hasUnreadReport: true,
    hasCounselingToday: false,
    currentAwayMinutes: 0,
    invoiceStatus: 'overdue',
    primaryChip: '건강 72',
    secondaryFlags: ['미열람'],
    topReason: '미수금 신호',
  };

  const summary = buildCenterAdminSeatOverlaySummary([sampleSignal], { includeFinancialSignals: false });
  assert.equal(summary.overdueCount, 0, 'overdue summary should be hidden');

  const domainSummary = getCenterAdminDomainSummary(sampleSignal, { includeFinancialSignals: false });
  assert.equal(domainSummary.some((item) => item.key === 'billing'), false, 'billing domain should be hidden');

  const firestoreRules = fs.readFileSync(path.join(repoRoot, 'firestore.rules'), 'utf8');
  assert.match(
    firestoreRules,
    /function canTeacherCreateWebsiteLead\(centerId\)\s*\{[\s\S]*request\.resource\.data\.source == 'website'[\s\S]*request\.resource\.data\.sourceRequestId is string[\s\S]*request\.resource\.data\.createdByUid == request\.auth\.uid;[\s\S]*\}/,
    'teacher website-to-lead transitions should be limited',
  );
  assert.match(
    firestoreRules,
    /match \/consultingLeads\/\{leadId\}\s*\{[\s\S]*allow create: if isCenterAdmin\(centerId\) \|\| canTeacherCreateWebsiteLead\(centerId\);[\s\S]*allow update: if isCenterAdmin\(centerId\) \|\| canTeacherLinkLeadToWaitlist\(centerId\);[\s\S]*allow delete: if isCenterAdmin\(centerId\);[\s\S]*\}/,
    'consultingLeads should allow teacher transitions only',
  );
  assert.match(
    firestoreRules,
    /match \/admissionWaitlist\/\{entryId\}\s*\{[\s\S]*allow create: if isCenterAdmin\(centerId\) \|\| canTeacherCreateWaitlistFromLead\(centerId\);[\s\S]*allow update: if isCenterAdmin\(centerId\) \|\| canTeacherAttachWebsiteWaitlistToLead\(centerId\);[\s\S]*allow delete: if isCenterAdmin\(centerId\);[\s\S]*\}/,
    'admissionWaitlist should allow teacher transitions only',
  );
  assert.match(
    firestoreRules,
    /match \/websiteConsultRequests\/\{reqId\}\s*\{[\s\S]*allow create: if isCenterAdmin\(centerId\);[\s\S]*allow update: if isCenterAdmin\(centerId\) \|\| canTeacherLinkWebsiteRequestToLead\(centerId\);[\s\S]*allow delete: if isCenterAdmin\(centerId\);[\s\S]*\}/,
    'websiteConsultRequests should allow teacher link updates only',
  );
  assert.match(
    firestoreRules,
    /match \/billingProfiles\/\{studentId\}\s*\{\s*allow read, write: if isCenterAdmin\(centerId\);/s,
    'billingProfiles should be admin-only',
  );
  assert.match(
    firestoreRules,
    /match \/websiteEntryEvents\/\{eventId\}\s*\{\s*allow read: if isTeacherOrAdmin\(centerId\);\s*allow write: if isCenterAdmin\(centerId\);/s,
    'websiteEntryEvents should be explicitly allowlisted',
  );
  assert.match(
    firestoreRules,
    /match \/kpiDaily\/\{dateKey\}\s*\{\s*allow read, write: if isCenterAdmin\(centerId\);/s,
    'kpiDaily should be admin-only',
  );
  assert.match(
    firestoreRules,
    /match \/\{document=\*\*\}\s*\{\s*allow read, write: if isCenterAdmin\(centerId\);/s,
    'center catch-all should be admin-only',
  );

  console.log('teacher-access checks passed');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
