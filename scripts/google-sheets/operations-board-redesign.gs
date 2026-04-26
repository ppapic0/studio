/**
 * Track study center operations board redesign.
 *
 * Usage:
 * 1. Open the original Google Sheet.
 * 2. Extensions > Apps Script.
 * 3. Paste this file, save, then run createRedesignedOperationsBoard().
 *
 * The script copies the source spreadsheet first and only mutates the copy.
 */
const OPS_BOARD = {
  SOURCE_SPREADSHEET_ID: '1_f4q9m1U6U4NEw2qdB3W-ug43BmuYYfeEHS6qHspIiI',
  COPY_PREFIX: '트랙 운영보드 리디자인',
  TIME_ZONE: 'Asia/Seoul',
  BRAND: {
    navy: '#14295F',
    orange: '#FF7A16',
    blueSurface: '#F4F7FD',
    softBlue: '#E9EEF9',
    softOrange: '#FFF2E8',
    white: '#FFFFFF',
    line: '#DDE4F2',
    muted: '#6D7892',
    darkText: '#17213A',
    grayTab: '#C9CED8',
    green: '#2E7D57',
    greenBg: '#E9F7EF',
    yellowBg: '#FFF7D6',
    redBg: '#FCE8E6',
    red: '#B3261E',
    blue: '#2E5AAC',
    blueBg: '#EAF1FF',
  },
  NEW_SHEETS: [
    '00_운영 허브',
    '01_업무 큐',
    '02_인수인계',
    '03_운영 체크',
    '04_상담·연락',
    '05_결제·재등록 체크',
    '06_운영 리포트',
    '99_설정',
  ],
  SHEETS: {
    hub: '00_운영 허브',
    queue: '01_업무 큐',
    handoff: '02_인수인계',
    checklist: '03_운영 체크',
    contact: '04_상담·연락',
    billing: '05_결제·재등록 체크',
    report: '06_운영 리포트',
    settings: '99_설정',
  },
  SOURCE: {
    dashboard: '📋 대시보드',
    director: '원장 스케줄 관리',
    timetable: '⏰ 근무 타임테이블',
    studentBasic: '👥 학생 기본 DB',
    studentDetail: '👥학생 세부DB',
    marketing: '📣 마케팅 관리',
    incident: '📝 특이사항 일지',
    consultation: '💬 상담 관리',
    blog: '✍️ 블로그 관리',
    notice: '📢 공지사항',
    todoLegacy: '해야할일',
    dailyTodo: '✅ 일자별 해야할 일',
  },
  STATUS: ['예정', '진행중', '대기', '완료', '보류'],
  PRIORITY: ['긴급', '높음', '보통', '낮음'],
  CATEGORY: ['연락', '방문상담', '결제확인', '후속관리', '원장일정', '상담', '시설', '학생행동', '공지', '기타'],
  CONTACT_TYPE: ['연락', '방문', '전화', '문자', '대면', '없음'],
  SHIFT: ['오픈', '오후', '저녁', '마감', '긴급'],
  CHECK_STATUS: ['미확인', '정상', '확인필요', '완료'],
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('운영보드 리디자인')
    .addItem('복사본 생성', 'createRedesignedOperationsBoard')
    .addSeparator()
    .addItem('소스 점검', 'dryRunRedesignSourceCheck')
    .addToUi();
}

function createRedesignedOperationsBoard() {
  const source = getSourceSpreadsheet_();
  const copyName = `${OPS_BOARD.COPY_PREFIX}_${Utilities.formatDate(new Date(), OPS_BOARD.TIME_ZONE, 'yyyyMMdd')}`;
  const copyFile = makeCopyInSameFolder_(source, copyName);
  const redesigned = SpreadsheetApp.openById(copyFile.getId());

  buildRedesignedBoard_(redesigned);
  SpreadsheetApp.flush();

  const url = redesigned.getUrl();
  Logger.log(`Created redesigned operations board: ${url}`);
  try {
    SpreadsheetApp.getUi().alert('운영보드 복사본 생성 완료', url, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (error) {
    Logger.log(url);
  }
  return url;
}

function dryRunRedesignSourceCheck() {
  const source = getSourceSpreadsheet_();
  const report = source.getSheets()
    .map((sheet) => `${sheet.getName()}: ${sheet.getLastRow()}행 x ${sheet.getLastColumn()}열`)
    .join('\n');
  Logger.log(report);
  try {
    SpreadsheetApp.getUi().alert('소스 시트 점검', report, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (error) {
    Logger.log(report);
  }
}

function getSourceSpreadsheet_() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  return SpreadsheetApp.openById(OPS_BOARD.SOURCE_SPREADSHEET_ID);
}

function makeCopyInSameFolder_(sourceSpreadsheet, copyName) {
  const sourceFile = DriveApp.getFileById(sourceSpreadsheet.getId());
  const parents = sourceFile.getParents();
  const targetFolder = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  return sourceFile.makeCopy(copyName, targetFolder);
}

function buildRedesignedBoard_(spreadsheet) {
  spreadsheet.setSpreadsheetTimeZone(OPS_BOARD.TIME_ZONE);
  removeGeneratedSheets_(spreadsheet);

  const settings = spreadsheet.insertSheet(OPS_BOARD.SHEETS.settings);
  buildSettingsSheet_(spreadsheet, settings);

  const queue = spreadsheet.insertSheet(OPS_BOARD.SHEETS.queue);
  buildTaskQueueSheet_(spreadsheet, queue);

  const handoff = spreadsheet.insertSheet(OPS_BOARD.SHEETS.handoff);
  buildHandoffSheet_(spreadsheet, handoff);

  const checklist = spreadsheet.insertSheet(OPS_BOARD.SHEETS.checklist);
  buildChecklistSheet_(spreadsheet, checklist);

  const contact = spreadsheet.insertSheet(OPS_BOARD.SHEETS.contact);
  buildContactSheet_(spreadsheet, contact);

  const billing = spreadsheet.insertSheet(OPS_BOARD.SHEETS.billing);
  buildBillingSheet_(spreadsheet, billing);

  const report = spreadsheet.insertSheet(OPS_BOARD.SHEETS.report);
  buildReportSheet_(spreadsheet, report);

  const hub = spreadsheet.insertSheet(OPS_BOARD.SHEETS.hub);
  buildHubSheet_(spreadsheet, hub);

  moveGeneratedSheetsToFront_(spreadsheet);
  styleOriginalSheets_(spreadsheet);
  spreadsheet.setActiveSheet(hub);
}

function removeGeneratedSheets_(spreadsheet) {
  OPS_BOARD.NEW_SHEETS.forEach((name) => {
    const sheet = spreadsheet.getSheetByName(name);
    if (sheet) spreadsheet.deleteSheet(sheet);
  });
}

function moveGeneratedSheetsToFront_(spreadsheet) {
  OPS_BOARD.NEW_SHEETS.forEach((name, index) => {
    const sheet = spreadsheet.getSheetByName(name);
    if (!sheet) return;
    spreadsheet.setActiveSheet(sheet);
    spreadsheet.moveActiveSheet(index + 1);
  });
}

function styleOriginalSheets_(spreadsheet) {
  const generated = new Set(OPS_BOARD.NEW_SHEETS);
  spreadsheet.getSheets().forEach((sheet) => {
    if (generated.has(sheet.getName())) return;
    sheet.setTabColor(OPS_BOARD.BRAND.grayTab);
    try {
      const protection = sheet.protect();
      protection.setDescription('리디자인 복사본의 원본 보존 탭입니다. 수정 전 확인하세요.');
      protection.setWarningOnly(true);
    } catch (error) {
      Logger.log(`Protection skipped for ${sheet.getName()}: ${error.message}`);
    }
  });
}

function buildSettingsSheet_(spreadsheet, sheet) {
  prepareSheet_(sheet, OPS_BOARD.BRAND.blueSurface);
  sheet.setTabColor(OPS_BOARD.BRAND.navy);
  sheet.getRange('A1:H1').merge().setValue('운영보드 설정')
    .setBackground(OPS_BOARD.BRAND.navy)
    .setFontColor(OPS_BOARD.BRAND.white)
    .setFontWeight('bold')
    .setFontSize(18)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 44);
  sheet.getRange('A2:H2').merge().setValue('드롭다운, 담당자, 상태값, 브랜드 색상을 관리하는 탭입니다.')
    .setFontColor(OPS_BOARD.BRAND.muted)
    .setBackground(OPS_BOARD.BRAND.white);

  writeSettingsList_(sheet, 4, 1, '상태', OPS_BOARD.STATUS);
  writeSettingsList_(sheet, 4, 2, '우선순위', OPS_BOARD.PRIORITY);
  writeSettingsList_(sheet, 4, 3, '업무 구분', OPS_BOARD.CATEGORY);
  writeSettingsList_(sheet, 4, 4, '연락/방문', OPS_BOARD.CONTACT_TYPE);
  writeSettingsList_(sheet, 4, 5, '담당자', collectAssignees_(spreadsheet));
  writeSettingsList_(sheet, 4, 6, '교대', OPS_BOARD.SHIFT);
  writeSettingsList_(sheet, 4, 7, '점검 상태', OPS_BOARD.CHECK_STATUS);

  const colorRows = [
    ['Navy', OPS_BOARD.BRAND.navy],
    ['Orange', OPS_BOARD.BRAND.orange],
    ['Blue Surface', OPS_BOARD.BRAND.blueSurface],
    ['Line', OPS_BOARD.BRAND.line],
  ];
  sheet.getRange('A32:B32').setValues([['브랜드 토큰', 'HEX']])
    .setBackground(OPS_BOARD.BRAND.navy)
    .setFontColor(OPS_BOARD.BRAND.white)
    .setFontWeight('bold');
  sheet.getRange(33, 1, colorRows.length, 2).setValues(colorRows);
  colorRows.forEach((row, index) => sheet.getRange(33 + index, 2).setBackground(row[1]));

  replaceNamedRange_(spreadsheet, 'OPS_STATUS', sheet.getRange(5, 1, OPS_BOARD.STATUS.length, 1));
  replaceNamedRange_(spreadsheet, 'OPS_PRIORITY', sheet.getRange(5, 2, OPS_BOARD.PRIORITY.length, 1));
  replaceNamedRange_(spreadsheet, 'OPS_CATEGORY', sheet.getRange(5, 3, OPS_BOARD.CATEGORY.length, 1));
  replaceNamedRange_(spreadsheet, 'OPS_CONTACT_TYPE', sheet.getRange(5, 4, OPS_BOARD.CONTACT_TYPE.length, 1));
  replaceNamedRange_(spreadsheet, 'OPS_ASSIGNEE', sheet.getRange(5, 5, Math.max(1, collectAssignees_(spreadsheet).length), 1));
  replaceNamedRange_(spreadsheet, 'OPS_SHIFT', sheet.getRange(5, 6, OPS_BOARD.SHIFT.length, 1));
  replaceNamedRange_(spreadsheet, 'OPS_CHECK_STATUS', sheet.getRange(5, 7, OPS_BOARD.CHECK_STATUS.length, 1));

  setWidths_(sheet, [150, 130, 150, 130, 150, 120, 130, 120]);
  sheet.setFrozenRows(4);
}

function buildTaskQueueSheet_(spreadsheet, sheet) {
  prepareSheet_(sheet, OPS_BOARD.BRAND.blueSurface);
  sheet.setTabColor(OPS_BOARD.BRAND.orange);
  const headers = ['업무ID', '날짜', '구분', '우선순위', '학생명', '학부모 연락처', '학생 연락처', '연락/방문', '업무내용', '담당자', '상태', '완료일', '메모', '원본'];
  const parsedTasks = [
    ...parseDailyTodos_(spreadsheet),
    ...parseDirectorSchedule_(spreadsheet),
  ];
  const rowCount = Math.max(250, parsedTasks.length + 40);

  writeTitle_(sheet, 'A1:N1', '업무 큐', '기존 할 일/원장 일정에서 초기 데이터를 가져온 조교용 통합 업무판입니다.');
  sheet.getRange(5, 1, 1, headers.length).setValues([headers]);
  styleTableHeader_(sheet.getRange(5, 1, 1, headers.length));

  const rows = Array.from({ length: rowCount }, (_, index) => {
    const task = parsedTasks[index] || {};
    return [
      task.id || `TASK-${String(index + 1).padStart(4, '0')}`,
      task.date || '',
      task.category || '',
      task.priority || '',
      task.studentName || '',
      '',
      '',
      task.contactType || '',
      task.description || '',
      task.assignee || '',
      task.status || '',
      '',
      task.memo || '',
      task.source || '',
    ];
  });
  sheet.getRange(6, 1, rowCount, headers.length).setValues(rows);
  setContactLookupFormulas_(sheet, rowCount, 6, 5, 6, 7);
  applyQueueValidations_(spreadsheet, sheet, rowCount, 6);
  applyOperationalTableStyle_(sheet, 5, 1, rowCount + 1, headers.length);
  applyStatusConditionalFormatting_(sheet, sheet.getRange(6, 1, rowCount, headers.length), 11, 2, 4);

  setWidths_(sheet, [110, 105, 120, 90, 120, 135, 135, 95, 300, 110, 95, 105, 260, 150]);
  sheet.setFrozenRows(5);
  sheet.setFrozenColumns(2);
  createFilter_(sheet, 5, 1, rowCount + 1, headers.length);
}

function buildHandoffSheet_(spreadsheet, sheet) {
  prepareSheet_(sheet, OPS_BOARD.BRAND.blueSurface);
  sheet.setTabColor(OPS_BOARD.BRAND.navy);
  const headers = ['날짜', '교대', '우선순위', '구분', '학생명/좌석', '내용', '담당자', '상태', '다음 액션', '확인자'];
  const rowCount = 120;

  writeTitle_(sheet, 'A1:J1', '인수인계', '교대 사이에 놓치면 안 되는 학생/시설/업무 이슈를 남기는 탭입니다.');
  sheet.getRange(5, 1, 1, headers.length).setValues([headers]);
  styleTableHeader_(sheet.getRange(5, 1, 1, headers.length));
  sheet.getRange(6, 1, rowCount, headers.length).clearContent();
  applyHandoffValidations_(spreadsheet, sheet, rowCount, 6);
  applyOperationalTableStyle_(sheet, 5, 1, rowCount + 1, headers.length);
  applyStatusConditionalFormatting_(sheet, sheet.getRange(6, 1, rowCount, headers.length), 8, 1, 3);

  setWidths_(sheet, [105, 90, 90, 110, 130, 360, 110, 95, 260, 110]);
  sheet.setFrozenRows(5);
  sheet.setFrozenColumns(1);
  createFilter_(sheet, 5, 1, rowCount + 1, headers.length);
}

function buildChecklistSheet_(spreadsheet, sheet) {
  prepareSheet_(sheet, OPS_BOARD.BRAND.blueSurface);
  sheet.setTabColor(OPS_BOARD.BRAND.orange);
  const headers = ['구역', '점검항목', '기준', '오픈', '오후', '마감', '담당자', '상태', '메모'];
  const rows = [
    ['오픈', '출입문/보안', '문 열림, CCTV/보안 이상 없음', false, false, false, '', '미확인', ''],
    ['오픈', '조명/좌석', '전체 좌석 조명과 콘센트 확인', false, false, false, '', '미확인', ''],
    ['오픈', '냉난방/환기', '실내 온도, 공기청정기, 환기 상태 확인', false, false, false, '', '미확인', ''],
    ['운영중', '정숙/좌석 분위기', '소음, 자리 이동, 불편 민원 확인', false, false, false, '', '미확인', ''],
    ['운영중', '학생 요청', '깨워달라는 요청, 시설 요청, 상담 요청 확인', false, false, false, '', '미확인', ''],
    ['운영중', '프린터/와이파이', '장비 오류와 소모품 부족 확인', false, false, false, '', '미확인', ''],
    ['운영중', '화장실/공용공간', '청결, 비품, 냄새, 파손 확인', false, false, false, '', '미확인', ''],
    ['마감', '미완료 업무', '업무 큐 미완료와 인수인계 작성 확인', false, false, false, '', '미확인', ''],
    ['마감', '정리/소등', '좌석 정리, 분실물, 소등, 문단속 확인', false, false, false, '', '미확인', ''],
  ];

  writeTitle_(sheet, 'A1:I1', '운영 체크', '오픈/운영/마감 루틴을 같은 기준으로 확인합니다.');
  sheet.getRange('A3').setValue('점검일').setFontWeight('bold').setFontColor(OPS_BOARD.BRAND.navy);
  sheet.getRange('B3').setFormula('=TODAY()').setNumberFormat('yyyy-mm-dd').setBackground(OPS_BOARD.BRAND.white);
  sheet.getRange(5, 1, 1, headers.length).setValues([headers]);
  styleTableHeader_(sheet.getRange(5, 1, 1, headers.length));
  sheet.getRange(6, 1, rows.length, headers.length).setValues(rows);
  sheet.getRange(6, 4, rows.length, 3).insertCheckboxes();

  const extraRows = 80;
  sheet.getRange(6 + rows.length, 1, extraRows, headers.length).clearContent();
  applyChecklistValidations_(spreadsheet, sheet, rows.length + extraRows, 6);
  applyOperationalTableStyle_(sheet, 5, 1, rows.length + extraRows + 1, headers.length);
  applyCheckStatusConditionalFormatting_(sheet, sheet.getRange(6, 1, rows.length + extraRows, headers.length), 8);

  setWidths_(sheet, [95, 155, 310, 70, 70, 70, 110, 100, 280]);
  sheet.setFrozenRows(5);
  createFilter_(sheet, 5, 1, rows.length + extraRows + 1, headers.length);
}

function buildContactSheet_(spreadsheet, sheet) {
  prepareSheet_(sheet, OPS_BOARD.BRAND.blueSurface);
  sheet.setTabColor(OPS_BOARD.BRAND.navy);
  const headers = ['번호', '신청일', '상담일', '학생명', '상담유형', '학부모 연락처', '신청경로', '담당자', '상담내용 요약', '다음 상담일', '팔로업 상태', '메모', '원본'];
  const consultations = parseConsultations_(spreadsheet);
  const rowCount = Math.max(160, consultations.length + 40);

  writeTitle_(sheet, 'A1:M1', '상담·연락', '상담 예정과 팔로업 연락을 조교/관리자가 함께 확인하는 탭입니다.');
  sheet.getRange(5, 1, 1, headers.length).setValues([headers]);
  styleTableHeader_(sheet.getRange(5, 1, 1, headers.length));

  const rows = Array.from({ length: rowCount }, (_, index) => {
    const item = consultations[index] || {};
    return [
      item.no || index + 1,
      item.requestedAt || '',
      item.consultedAt || '',
      item.studentName || '',
      item.type || '',
      '',
      item.channel || '',
      item.assignee || '',
      item.summary || '',
      item.nextDate || '',
      item.followupStatus || '',
      item.memo || '',
      item.source || '',
    ];
  });
  sheet.getRange(6, 1, rowCount, headers.length).setValues(rows);
  setSingleContactLookupFormula_(sheet, rowCount, 6, 4, 6);
  applyContactValidations_(spreadsheet, sheet, rowCount, 6);
  applyOperationalTableStyle_(sheet, 5, 1, rowCount + 1, headers.length);
  applyStatusConditionalFormatting_(sheet, sheet.getRange(6, 1, rowCount, headers.length), 11, 3, 11);

  setWidths_(sheet, [70, 105, 105, 120, 110, 135, 110, 110, 360, 105, 105, 250, 120]);
  sheet.setFrozenRows(5);
  sheet.setFrozenColumns(3);
  createFilter_(sheet, 5, 1, rowCount + 1, headers.length);
}

function buildBillingSheet_(spreadsheet, sheet) {
  prepareSheet_(sheet, OPS_BOARD.BRAND.blueSurface);
  sheet.setTabColor(OPS_BOARD.BRAND.orange);
  const headers = ['학생명', '학교', '학년', '재원상태', '재등록', '확인 구분', '확인 마감일', '담당자', '상태', '학부모 연락처', '학생 연락처', '메모'];
  const students = parseStudents_(spreadsheet);
  const rowCount = Math.max(160, students.length + 40);

  writeTitle_(sheet, 'A1:L1', '결제·재등록 체크', '결제 DB가 아니라 운영자가 확인할 항목만 모아두는 체크리스트입니다.');
  sheet.getRange(5, 1, 1, headers.length).setValues([headers]);
  styleTableHeader_(sheet.getRange(5, 1, 1, headers.length));

  const rows = Array.from({ length: rowCount }, (_, index) => {
    const student = students[index] || {};
    return [
      student.name || '',
      student.school || '',
      student.grade || '',
      student.status || '',
      student.renewal || '',
      student.name ? '재등록 확인' : '',
      '',
      '',
      student.name ? '예정' : '',
      student.parentPhone || '',
      student.studentPhone || '',
      student.memo || '',
    ];
  });
  sheet.getRange(6, 1, rowCount, headers.length).setValues(rows);
  applyBillingValidations_(spreadsheet, sheet, rowCount, 6);
  applyOperationalTableStyle_(sheet, 5, 1, rowCount + 1, headers.length);
  applyStatusConditionalFormatting_(sheet, sheet.getRange(6, 1, rowCount, headers.length), 9, 7, 9);

  setWidths_(sheet, [120, 115, 90, 100, 110, 120, 105, 110, 95, 135, 135, 280]);
  sheet.setFrozenRows(5);
  sheet.setFrozenColumns(1);
  createFilter_(sheet, 5, 1, rowCount + 1, headers.length);
}

function buildReportSheet_(spreadsheet, sheet) {
  prepareSheet_(sheet, OPS_BOARD.BRAND.blueSurface);
  sheet.setTabColor(OPS_BOARD.BRAND.navy);
  writeTitle_(sheet, 'A1:L1', '운영 리포트', '이번 주 업무, 상담, 특이사항, 콘텐츠 운영을 한 화면에서 보는 관리자용 요약입니다.');

  sheet.getRange('A4').setValue('주간 기준일').setFontWeight('bold').setFontColor(OPS_BOARD.BRAND.navy);
  sheet.getRange('B4').setFormula('=TODAY()').setNumberFormat('yyyy-mm-dd').setBackground(OPS_BOARD.BRAND.white);
  sheet.getRange('D4').setValue('주 시작').setFontWeight('bold').setFontColor(OPS_BOARD.BRAND.navy);
  sheet.getRange('E4').setFormula('=$B$4-WEEKDAY($B$4,2)+1').setNumberFormat('yyyy-mm-dd').setBackground(OPS_BOARD.BRAND.white);
  sheet.getRange('G4').setValue('주 종료').setFontWeight('bold').setFontColor(OPS_BOARD.BRAND.navy);
  sheet.getRange('H4').setFormula('=$E$4+6').setNumberFormat('yyyy-mm-dd').setBackground(OPS_BOARD.BRAND.white);

  const cards = [
    ['A6:B8', '이번 주 업무', '=COUNTIFS(\'01_업무 큐\'!$B:$B,">="&$E$4,\'01_업무 큐\'!$B:$B,"<="&$H$4,\'01_업무 큐\'!$K:$K,"<>")'],
    ['C6:D8', '미완료', '=COUNTIFS(\'01_업무 큐\'!$B:$B,">="&$E$4,\'01_업무 큐\'!$B:$B,"<="&$H$4,\'01_업무 큐\'!$K:$K,"<>완료",\'01_업무 큐\'!$K:$K,"<>")'],
    ['E6:F8', '상담/연락', '=COUNTIFS(\'04_상담·연락\'!$C:$C,">="&$E$4,\'04_상담·연락\'!$C:$C,"<="&$H$4)'],
    ['G6:H8', '미처리 특이사항', '=COUNTIF(\'📝 특이사항 일지\'!$I:$I,"<>처리완료")-COUNTBLANK(\'📝 특이사항 일지\'!$I:$I)'],
    ['I6:J8', '마케팅 발행', '=COUNTIF(\'📣 마케팅 관리\'!$I:$I,"발행완료")+COUNTIF(\'✍️ 블로그 관리\'!$I:$I,"발행완료")'],
  ];
  cards.forEach((card) => writeKpiCard_(sheet, card[0], card[1], card[2]));

  sheet.getRange('A11:B11').setValues([['상태', '건수']]);
  styleTableHeader_(sheet.getRange('A11:B11'));
  const statusRows = OPS_BOARD.STATUS.map((status) => [status, `=COUNTIF('01_업무 큐'!$K:$K,"${status}")`]);
  sheet.getRange(12, 1, statusRows.length, 2).setValues(statusRows);

  sheet.getRange('D11:E11').setValues([['업무 구분', '건수']]);
  styleTableHeader_(sheet.getRange('D11:E11'));
  const categoryRows = OPS_BOARD.CATEGORY.map((category) => [category, `=COUNTIF('01_업무 큐'!$C:$C,"${category}")`]);
  sheet.getRange(12, 4, categoryRows.length, 2).setValues(categoryRows);

  sheet.getRange('A25:F25').merge().setValue('이번 주 담당자별 미완료')
    .setBackground(OPS_BOARD.BRAND.navy)
    .setFontColor(OPS_BOARD.BRAND.white)
    .setFontWeight('bold');
  sheet.getRange('A26:F26').setValues([['담당자', '미완료', '완료', '긴급', '높음', '보류']]);
  styleTableHeader_(sheet.getRange('A26:F26'));
  const assignees = collectAssignees_(spreadsheet).slice(0, 20);
  const assigneeRows = assignees.map((name) => [
    name,
    `=COUNTIFS('01_업무 큐'!$J:$J,A${27 + assignees.indexOf(name)},'01_업무 큐'!$K:$K,"<>완료",'01_업무 큐'!$K:$K,"<>")`,
    `=COUNTIFS('01_업무 큐'!$J:$J,A${27 + assignees.indexOf(name)},'01_업무 큐'!$K:$K,"완료")`,
    `=COUNTIFS('01_업무 큐'!$J:$J,A${27 + assignees.indexOf(name)},'01_업무 큐'!$D:$D,"긴급")`,
    `=COUNTIFS('01_업무 큐'!$J:$J,A${27 + assignees.indexOf(name)},'01_업무 큐'!$D:$D,"높음")`,
    `=COUNTIFS('01_업무 큐'!$J:$J,A${27 + assignees.indexOf(name)},'01_업무 큐'!$K:$K,"보류")`,
  ]);
  if (assigneeRows.length) sheet.getRange(27, 1, assigneeRows.length, 6).setValues(assigneeRows);

  applyOperationalTableStyle_(sheet, 11, 1, 6, 2);
  applyOperationalTableStyle_(sheet, 11, 4, OPS_BOARD.CATEGORY.length + 1, 2);
  applyOperationalTableStyle_(sheet, 26, 1, Math.max(2, assigneeRows.length + 1), 6);
  tryInsertReportCharts_(sheet);

  setWidths_(sheet, [130, 95, 24, 130, 95, 95, 130, 95, 130, 95, 120, 120]);
  sheet.setFrozenRows(4);
}

function buildHubSheet_(spreadsheet, sheet) {
  prepareSheet_(sheet, OPS_BOARD.BRAND.blueSurface);
  sheet.setTabColor(OPS_BOARD.BRAND.orange);
  sheet.getRange('A1:L1').merge().setValue('오늘 운영 상황판')
    .setBackground(OPS_BOARD.BRAND.navy)
    .setFontColor(OPS_BOARD.BRAND.white)
    .setFontSize(20)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 48);
  sheet.getRange('A2:L2').merge().setValue('조교 선생님과 관리자가 하루 운영을 빠르게 확인하는 첫 화면입니다.')
    .setBackground(OPS_BOARD.BRAND.white)
    .setFontColor(OPS_BOARD.BRAND.muted)
    .setHorizontalAlignment('center');

  sheet.getRange('A3').setValue('운영일').setFontWeight('bold').setFontColor(OPS_BOARD.BRAND.navy);
  sheet.getRange('B3').setFormula('=TODAY()').setNumberFormat('yyyy-mm-dd').setBackground(OPS_BOARD.BRAND.white);
  sheet.getRange('D3').setValue('수정 원칙').setFontWeight('bold').setFontColor(OPS_BOARD.BRAND.navy);
  sheet.getRange('E3:L3').merge().setValue('입력은 업무 큐/인수인계/운영 체크에서, 이 화면은 조회 중심으로 사용합니다.')
    .setFontColor(OPS_BOARD.BRAND.muted)
    .setBackground(OPS_BOARD.BRAND.white);

  const kpis = [
    ['A5:B7', '미완료 업무', '=COUNTIFS(\'01_업무 큐\'!$B:$B,$B$3,\'01_업무 큐\'!$K:$K,"<>완료",\'01_업무 큐\'!$K:$K,"<>")'],
    ['C5:D7', '상담/연락', '=COUNTIFS(\'01_업무 큐\'!$B:$B,$B$3,\'01_업무 큐\'!$C:$C,"연락")+COUNTIFS(\'01_업무 큐\'!$B:$B,$B$3,\'01_업무 큐\'!$C:$C,"상담")+COUNTIFS(\'01_업무 큐\'!$B:$B,$B$3,\'01_업무 큐\'!$C:$C,"방문상담")'],
    ['E5:F7', '근무 인원', '=IFERROR(ROWS(UNIQUE(FILTER(\'⏰ 근무 타임테이블\'!$B$2:$B$500,TO_TEXT(\'⏰ 근무 타임테이블\'!$A$2:$A$500)=TEXT($B$3,"m/d"),BYROW(\'⏰ 근무 타임테이블\'!$D$2:$AK$500,LAMBDA(r,COUNTIF(r,"■")>0))))),0)'],
    ['G5:H7', '미처리 특이사항', '=IFERROR(ROWS(FILTER(\'📝 특이사항 일지\'!$A$2:$A$500,TO_TEXT(\'📝 특이사항 일지\'!$A$2:$A$500)=TEXT($B$3,"yyyy-mm-dd"),\'📝 특이사항 일지\'!$I$2:$I$500<>"처리완료")),0)'],
    ['I5:J7', '결제·재등록', '=COUNTIFS(\'01_업무 큐\'!$B:$B,$B$3,\'01_업무 큐\'!$C:$C,"결제확인",\'01_업무 큐\'!$K:$K,"<>완료")+COUNTIFS(\'05_결제·재등록 체크\'!$G:$G,"<="&$B$3,\'05_결제·재등록 체크\'!$I:$I,"<>완료",\'05_결제·재등록 체크\'!$I:$I,"<>")'],
  ];
  kpis.forEach((card) => writeKpiCard_(sheet, card[0], card[1], card[2]));

  writeSectionHeader_(sheet, 'A10:H10', '오늘 미완료 업무');
  sheet.getRange('A11:H11').setValues([['구분', '우선순위', '학생명', '학부모 연락처', '연락/방문', '업무내용', '담당자', '상태']]);
  styleTableHeader_(sheet.getRange('A11:H11'));
  sheet.getRange('A12').setFormula('=IFERROR(FILTER({\'01_업무 큐\'!$C$6:$C,\'01_업무 큐\'!$D$6:$D,\'01_업무 큐\'!$E$6:$E,\'01_업무 큐\'!$F$6:$F,\'01_업무 큐\'!$H$6:$H,\'01_업무 큐\'!$I$6:$I,\'01_업무 큐\'!$J$6:$J,\'01_업무 큐\'!$K$6:$K},\'01_업무 큐\'!$B$6:$B=$B$3,\'01_업무 큐\'!$K$6:$K<>"완료"),{"오늘 미완료 업무가 없습니다.","","","","","","",""})');

  writeSectionHeader_(sheet, 'J10:L10', '오늘 근무자');
  sheet.getRange('J11:L11').setValues([['이름', '직책', '근무블록']]);
  styleTableHeader_(sheet.getRange('J11:L11'));
  sheet.getRange('J12').setFormula('=IFERROR(FILTER({\'⏰ 근무 타임테이블\'!$B$2:$B$500,\'⏰ 근무 타임테이블\'!$C$2:$C$500,MMULT(--(\'⏰ 근무 타임테이블\'!$D$2:$AK$500="■"),TRANSPOSE(COLUMN(\'⏰ 근무 타임테이블\'!$D$2:$AK$2)^0))},TO_TEXT(\'⏰ 근무 타임테이블\'!$A$2:$A$500)=TEXT($B$3,"m/d"),BYROW(\'⏰ 근무 타임테이블\'!$D$2:$AK$500,LAMBDA(r,COUNTIF(r,"■")>0))),{"근무 입력 없음","",""})');

  writeSectionHeader_(sheet, 'A27:F27', '인수인계 핵심');
  sheet.getRange('A28:F28').setValues([['교대', '우선순위', '구분', '학생명/좌석', '내용', '상태']]);
  styleTableHeader_(sheet.getRange('A28:F28'));
  sheet.getRange('A29').setFormula('=IFERROR(FILTER({\'02_인수인계\'!$B$6:$B,\'02_인수인계\'!$C$6:$C,\'02_인수인계\'!$D$6:$D,\'02_인수인계\'!$E$6:$E,\'02_인수인계\'!$F$6:$F,\'02_인수인계\'!$H$6:$H},\'02_인수인계\'!$A$6:$A=$B$3,\'02_인수인계\'!$H$6:$H<>"완료"),{"오늘 인수인계가 없습니다.","","","","",""})');

  writeSectionHeader_(sheet, 'H27:L27', '최근 공지');
  sheet.getRange('H28:L28').setValues([['날짜', '분류', '제목', '작성자', '확인']]);
  styleTableHeader_(sheet.getRange('H28:L28'));
  sheet.getRange('H29').setFormula('=IFERROR(SORT(FILTER({\'📢 공지사항\'!$B$2:$B$100,\'📢 공지사항\'!$C$2:$C$100,\'📢 공지사항\'!$D$2:$D$100,\'📢 공지사항\'!$F$2:$F$100,\'📢 공지사항\'!$G$2:$G$100},\'📢 공지사항\'!$B$2:$B$100<>""),1,FALSE),{"공지 없음","","","",""})');

  writeSectionHeader_(sheet, 'A43:L43', '오늘 미처리 특이사항');
  sheet.getRange('A44:L44').setValues([['날짜', '요일', '분류', '제목', '상세 내용', '관련 학생', '담당자', '조치사항', '처리상태', '비고', '', '']]);
  styleTableHeader_(sheet.getRange('A44:L44'));
  sheet.getRange('A45').setFormula('=IFERROR(FILTER(\'📝 특이사항 일지\'!$A$2:$J$500,TO_TEXT(\'📝 특이사항 일지\'!$A$2:$A$500)=TEXT($B$3,"yyyy-mm-dd"),\'📝 특이사항 일지\'!$I$2:$I$500<>"처리완료"),{"오늘 미처리 특이사항이 없습니다.","","","","","","","","",""})');

  [12, 29, 45].forEach((row) => {
    sheet.getRange(row, 1, 14, 12).setBackground(OPS_BOARD.BRAND.white).setBorder(true, true, true, true, true, true, OPS_BOARD.BRAND.line, SpreadsheetApp.BorderStyle.SOLID);
  });
  setWidths_(sheet, [120, 95, 115, 135, 95, 270, 110, 90, 24, 120, 100, 100]);
  sheet.setFrozenRows(10);
}

function writeSettingsList_(sheet, row, column, title, values) {
  sheet.getRange(row, column).setValue(title)
    .setBackground(OPS_BOARD.BRAND.navy)
    .setFontColor(OPS_BOARD.BRAND.white)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.getRange(row + 1, column, Math.max(values.length, 1), 1).setValues((values.length ? values : ['']).map((value) => [value]));
  sheet.getRange(row + 1, column, Math.max(values.length, 1), 1)
    .setBackground(OPS_BOARD.BRAND.white)
    .setBorder(true, true, true, true, true, true, OPS_BOARD.BRAND.line, SpreadsheetApp.BorderStyle.SOLID);
}

function writeTitle_(sheet, titleRange, title, subtitle) {
  sheet.getRange(titleRange).merge().setValue(title)
    .setBackground(OPS_BOARD.BRAND.navy)
    .setFontColor(OPS_BOARD.BRAND.white)
    .setFontSize(18)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 44);
  const lastColumn = sheet.getRange(titleRange).getLastColumn();
  sheet.getRange(2, 1, 1, lastColumn).merge().setValue(subtitle)
    .setBackground(OPS_BOARD.BRAND.white)
    .setFontColor(OPS_BOARD.BRAND.muted)
    .setHorizontalAlignment('center');
}

function writeSectionHeader_(sheet, rangeA1, text) {
  sheet.getRange(rangeA1).merge().setValue(text)
    .setBackground(OPS_BOARD.BRAND.navy)
    .setFontColor(OPS_BOARD.BRAND.white)
    .setFontWeight('bold')
    .setFontSize(12);
}

function writeKpiCard_(sheet, rangeA1, label, formula) {
  const range = sheet.getRange(rangeA1);
  range.setBackground(OPS_BOARD.BRAND.white)
    .setBorder(true, true, true, true, null, null, OPS_BOARD.BRAND.line, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  const topRow = range.getRow();
  const leftCol = range.getColumn();
  const width = range.getNumColumns();
  sheet.getRange(topRow, leftCol, 1, width).merge().setValue(label)
    .setFontColor(OPS_BOARD.BRAND.muted)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.getRange(topRow + 1, leftCol, 2, width).merge().setFormula(formula)
    .setFontColor(OPS_BOARD.BRAND.navy)
    .setFontWeight('bold')
    .setFontSize(22)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
}

function prepareSheet_(sheet, background) {
  sheet.clear();
  sheet.clearConditionalFormatRules();
  try {
    sheet.getCharts().forEach((chart) => sheet.removeChart(chart));
  } catch (error) {
    Logger.log(`Chart cleanup skipped on ${sheet.getName()}: ${error.message}`);
  }
  sheet.setHiddenGridlines(true);
  sheet.setFrozenRows(0);
  sheet.setFrozenColumns(0);
  sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 200), Math.max(sheet.getMaxColumns(), 12)).setBackground(background);
}

function styleTableHeader_(range) {
  range.setBackground(OPS_BOARD.BRAND.navy)
    .setFontColor(OPS_BOARD.BRAND.white)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true)
    .setBorder(true, true, true, true, true, true, OPS_BOARD.BRAND.navy, SpreadsheetApp.BorderStyle.SOLID);
}

function applyOperationalTableStyle_(sheet, startRow, startCol, numRows, numCols) {
  const bodyRows = Math.max(1, numRows - 1);
  const body = sheet.getRange(startRow + 1, startCol, bodyRows, numCols);
  body.setBackground(OPS_BOARD.BRAND.white)
    .setFontColor(OPS_BOARD.BRAND.darkText)
    .setVerticalAlignment('middle')
    .setWrap(true)
    .setBorder(true, true, true, true, true, true, OPS_BOARD.BRAND.line, SpreadsheetApp.BorderStyle.SOLID);
  for (let offset = 0; offset < bodyRows; offset += 2) {
    sheet.getRange(startRow + 1 + offset, startCol, 1, numCols).setBackground('#FAFBFE');
  }
}

function applyQueueValidations_(spreadsheet, sheet, rowCount, startRow) {
  applyDateValidation_(sheet.getRange(startRow, 2, rowCount, 1));
  applyNamedValidation_(spreadsheet, sheet.getRange(startRow, 3, rowCount, 1), 'OPS_CATEGORY');
  applyNamedValidation_(spreadsheet, sheet.getRange(startRow, 4, rowCount, 1), 'OPS_PRIORITY');
  applyNamedValidation_(spreadsheet, sheet.getRange(startRow, 8, rowCount, 1), 'OPS_CONTACT_TYPE');
  applyNamedValidation_(spreadsheet, sheet.getRange(startRow, 10, rowCount, 1), 'OPS_ASSIGNEE');
  applyNamedValidation_(spreadsheet, sheet.getRange(startRow, 11, rowCount, 1), 'OPS_STATUS');
  applyDateValidation_(sheet.getRange(startRow, 12, rowCount, 1));
}

function applyHandoffValidations_(spreadsheet, sheet, rowCount, startRow) {
  applyDateValidation_(sheet.getRange(startRow, 1, rowCount, 1));
  applyNamedValidation_(spreadsheet, sheet.getRange(startRow, 2, rowCount, 1), 'OPS_SHIFT');
  applyNamedValidation_(spreadsheet, sheet.getRange(startRow, 3, rowCount, 1), 'OPS_PRIORITY');
  applyNamedValidation_(spreadsheet, sheet.getRange(startRow, 4, rowCount, 1), 'OPS_CATEGORY');
  applyNamedValidation_(spreadsheet, sheet.getRange(startRow, 7, rowCount, 1), 'OPS_ASSIGNEE');
  applyNamedValidation_(spreadsheet, sheet.getRange(startRow, 8, rowCount, 1), 'OPS_STATUS');
}

function applyChecklistValidations_(spreadsheet, sheet, rowCount, startRow) {
  applyNamedValidation_(spreadsheet, sheet.getRange(startRow, 7, rowCount, 1), 'OPS_ASSIGNEE');
  applyNamedValidation_(spreadsheet, sheet.getRange(startRow, 8, rowCount, 1), 'OPS_CHECK_STATUS');
}

function applyContactValidations_(spreadsheet, sheet, rowCount, startRow) {
  applyDateValidation_(sheet.getRange(startRow, 2, rowCount, 2));
  applyDateValidation_(sheet.getRange(startRow, 10, rowCount, 1));
  applyNamedValidation_(spreadsheet, sheet.getRange(startRow, 8, rowCount, 1), 'OPS_ASSIGNEE');
  applyNamedValidation_(spreadsheet, sheet.getRange(startRow, 11, rowCount, 1), 'OPS_STATUS');
}

function applyBillingValidations_(spreadsheet, sheet, rowCount, startRow) {
  applyDateValidation_(sheet.getRange(startRow, 7, rowCount, 1));
  applyNamedValidation_(spreadsheet, sheet.getRange(startRow, 8, rowCount, 1), 'OPS_ASSIGNEE');
  applyNamedValidation_(spreadsheet, sheet.getRange(startRow, 9, rowCount, 1), 'OPS_STATUS');
}

function applyDateValidation_(range) {
  const rule = SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(true).build();
  range.setDataValidation(rule).setNumberFormat('yyyy-mm-dd');
}

function applyNamedValidation_(spreadsheet, range, namedRange) {
  const source = spreadsheet.getRangeByName(namedRange);
  if (!source) return;
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(source, true)
    .setAllowInvalid(false)
    .build();
  range.setDataValidation(rule);
}

function applyStatusConditionalFormatting_(sheet, range, statusColumn, dateColumn, priorityColumn) {
  const startRow = range.getRow();
  const rules = sheet.getConditionalFormatRules();
  const statusLetter = colToLetter_(statusColumn);
  const dateLetter = colToLetter_(dateColumn);
  const priorityLetter = colToLetter_(priorityColumn);
  const rangeA1 = range.getA1Notation();
  const statusColors = [
    ['완료', OPS_BOARD.BRAND.greenBg, OPS_BOARD.BRAND.green],
    ['진행중', OPS_BOARD.BRAND.blueBg, OPS_BOARD.BRAND.blue],
    ['대기', OPS_BOARD.BRAND.yellowBg, OPS_BOARD.BRAND.darkText],
    ['보류', OPS_BOARD.BRAND.redBg, OPS_BOARD.BRAND.red],
    ['예정', OPS_BOARD.BRAND.white, OPS_BOARD.BRAND.darkText],
  ];
  statusColors.forEach(([status, bg, fg]) => {
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(`=$${statusLetter}${startRow}="${status}"`)
      .setBackground(bg)
      .setFontColor(fg)
      .setRanges([range])
      .build());
  });
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied(`=AND($${dateLetter}${startRow}<TODAY(),$${dateLetter}${startRow}<>"",$${statusLetter}${startRow}<>"완료",$${statusLetter}${startRow}<>"")`)
    .setBackground(OPS_BOARD.BRAND.softOrange)
    .setFontColor(OPS_BOARD.BRAND.red)
    .setRanges([range])
    .build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied(`=$${priorityLetter}${startRow}="긴급"`)
    .setBackground(OPS_BOARD.BRAND.redBg)
    .setFontColor(OPS_BOARD.BRAND.red)
    .setRanges([sheet.getRange(rangeA1)])
    .build());
  sheet.setConditionalFormatRules(rules);
}

function applyCheckStatusConditionalFormatting_(sheet, range, statusColumn) {
  const rules = sheet.getConditionalFormatRules();
  const statusLetter = colToLetter_(statusColumn);
  const startRow = range.getRow();
  [
    ['완료', OPS_BOARD.BRAND.greenBg, OPS_BOARD.BRAND.green],
    ['정상', OPS_BOARD.BRAND.blueBg, OPS_BOARD.BRAND.blue],
    ['확인필요', OPS_BOARD.BRAND.redBg, OPS_BOARD.BRAND.red],
    ['미확인', OPS_BOARD.BRAND.yellowBg, OPS_BOARD.BRAND.darkText],
  ].forEach(([status, bg, fg]) => {
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(`=$${statusLetter}${startRow}="${status}"`)
      .setBackground(bg)
      .setFontColor(fg)
      .setRanges([range])
      .build());
  });
  sheet.setConditionalFormatRules(rules);
}

function setContactLookupFormulas_(sheet, rowCount, startRow, nameColumn, parentColumn, studentColumn) {
  const studentDb = q_(OPS_BOARD.SOURCE.studentBasic);
  const parentFormulas = [];
  const studentFormulas = [];
  for (let index = 0; index < rowCount; index += 1) {
    const row = startRow + index;
    const nameCell = `$${colToLetter_(nameColumn)}${row}`;
    parentFormulas.push([`=IF(${nameCell}="","",IFNA(VLOOKUP(${nameCell},${studentDb}!$B:$G,5,FALSE),""))`]);
    studentFormulas.push([`=IF(${nameCell}="","",IFNA(VLOOKUP(${nameCell},${studentDb}!$B:$G,6,FALSE),""))`]);
  }
  sheet.getRange(startRow, parentColumn, rowCount, 1).setFormulas(parentFormulas);
  sheet.getRange(startRow, studentColumn, rowCount, 1).setFormulas(studentFormulas);
}

function setSingleContactLookupFormula_(sheet, rowCount, startRow, nameColumn, contactColumn) {
  const studentDb = q_(OPS_BOARD.SOURCE.studentBasic);
  const formulas = [];
  for (let index = 0; index < rowCount; index += 1) {
    const row = startRow + index;
    const nameCell = `$${colToLetter_(nameColumn)}${row}`;
    formulas.push([`=IF(${nameCell}="","",IFNA(VLOOKUP(${nameCell},${studentDb}!$B:$G,5,FALSE),""))`]);
  }
  sheet.getRange(startRow, contactColumn, rowCount, 1).setFormulas(formulas);
}

function parseDailyTodos_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(OPS_BOARD.SOURCE.dailyTodo);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  const tasks = [];
  let currentDate = null;

  values.forEach((row) => {
    const first = asText_(row[0]);
    const dateMatch = first.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) {
      currentDate = new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]));
      return;
    }
    if (!currentDate || first === '시간') return;
    const category = asText_(row[1]);
    const studentName = asText_(row[2]);
    const contactType = asText_(row[4]);
    const description = asText_(row[5]);
    const status = normalizeStatus_(asText_(row[7]));
    const memo = asText_(row[8]);
    const time = asText_(row[0]);
    if (![category, studentName, contactType, description, status, memo, time].some(Boolean)) return;
    tasks.push({
      id: `TODO-${String(tasks.length + 1).padStart(4, '0')}`,
      date: currentDate,
      category: category || '기타',
      priority: defaultPriority_(category),
      studentName,
      contactType: normalizeContactType_(contactType || category),
      description: description || [time, category].filter(Boolean).join(' '),
      assignee: '',
      status: status || '예정',
      memo,
      source: OPS_BOARD.SOURCE.dailyTodo,
    });
  });
  return tasks;
}

function parseDirectorSchedule_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(OPS_BOARD.SOURCE.director);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  const tasks = [];
  let currentDate = null;

  values.forEach((row) => {
    const first = asText_(row[0]);
    const dateMatch = first.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) {
      currentDate = new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]));
      return;
    }
    if (!currentDate || first === '시작') return;
    const start = asText_(row[0]);
    const end = asText_(row[1]);
    const category = asText_(row[2]);
    const title = asText_(row[4]);
    const target = asText_(row[6]);
    const followup = asText_(row[8]);
    if (![start, end, category, title, target, followup].some(Boolean)) return;
    tasks.push({
      id: `DIR-${String(tasks.length + 1).padStart(4, '0')}`,
      date: currentDate,
      category: category || '원장일정',
      priority: defaultPriority_(category || '원장일정'),
      studentName: target,
      contactType: normalizeContactType_(category),
      description: [start && end ? `${start}-${end}` : start || end, title || '원장 일정', followup].filter(Boolean).join(' · '),
      assignee: '김재윤',
      status: '예정',
      memo: '',
      source: OPS_BOARD.SOURCE.director,
    });
  });
  return tasks;
}

function parseConsultations_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(OPS_BOARD.SOURCE.consultation);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  const headerIndex = values.findIndex((row) => asText_(row[0]) === '번호' && asText_(row[3]) === '학생명');
  if (headerIndex < 0) return [];
  return values.slice(headerIndex + 1)
    .filter((row) => asText_(row[3]))
    .map((row, index) => ({
      no: row[0] || index + 1,
      requestedAt: row[1] || '',
      consultedAt: row[2] || '',
      studentName: asText_(row[3]),
      type: asText_(row[4]),
      channel: asText_(row[5]),
      assignee: asText_(row[6]),
      summary: asText_(row[7]),
      nextDate: row[10] || '',
      followupStatus: normalizeStatus_(asText_(row[11])) || '예정',
      memo: asText_(row[12]),
      source: OPS_BOARD.SOURCE.consultation,
    }));
}

function parseStudents_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(OPS_BOARD.SOURCE.studentBasic);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  const headerIndex = values.findIndex((row) => asText_(row[1]) === '이름' && asText_(row[5]).indexOf('학부모') >= 0);
  if (headerIndex < 0) return [];
  return values.slice(headerIndex + 1)
    .filter((row) => asText_(row[1]))
    .map((row) => ({
      id: asText_(row[0]),
      name: asText_(row[1]),
      school: asText_(row[2]),
      grade: asText_(row[3]),
      parentPhone: asText_(row[5]),
      studentPhone: asText_(row[6]),
      registeredAt: row[7] || '',
      renewal: asText_(row[8]),
      status: asText_(row[9]),
      memo: asText_(row[10]),
    }));
}

function collectAssignees_(spreadsheet) {
  const names = new Set(['김재윤', '김다은']);
  [
    { sheetName: OPS_BOARD.SOURCE.timetable, column: 2 },
    { sheetName: OPS_BOARD.SOURCE.marketing, column: 8 },
    { sheetName: OPS_BOARD.SOURCE.consultation, column: 7 },
    { sheetName: OPS_BOARD.SOURCE.blog, column: 8 },
    { sheetName: OPS_BOARD.SOURCE.incident, column: 7 },
    { sheetName: OPS_BOARD.SOURCE.notice, column: 6 },
  ].forEach(({ sheetName, column }) => {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) return;
    sheet.getRange(1, column, sheet.getLastRow(), 1).getValues()
      .flat()
      .map(asText_)
      .filter((value) => value && !['이름', '담당자', '작성자'].includes(value))
      .forEach((value) => names.add(value));
  });
  return Array.from(names).slice(0, 80);
}

function tryInsertReportCharts_(sheet) {
  try {
    const statusChart = sheet.newChart()
      .asPieChart()
      .addRange(sheet.getRange('A11:B16'))
      .setPosition(11, 7, 0, 0)
      .setOption('title', '업무 상태 분포')
      .setOption('pieHole', 0.45)
      .setOption('colors', [OPS_BOARD.BRAND.orange, OPS_BOARD.BRAND.blue, '#F2C94C', OPS_BOARD.BRAND.green, OPS_BOARD.BRAND.red])
      .build();
    sheet.insertChart(statusChart);

    const categoryChart = sheet.newChart()
      .asColumnChart()
      .addRange(sheet.getRange(11, 4, OPS_BOARD.CATEGORY.length + 1, 2))
      .setPosition(25, 7, 0, 0)
      .setOption('title', '업무 구분별 건수')
      .setOption('legend', { position: 'none' })
      .setOption('colors', [OPS_BOARD.BRAND.navy])
      .build();
    sheet.insertChart(categoryChart);
  } catch (error) {
    Logger.log(`Chart insert skipped: ${error.message}`);
  }
}

function replaceNamedRange_(spreadsheet, name, range) {
  spreadsheet.getNamedRanges()
    .filter((namedRange) => namedRange.getName() === name)
    .forEach((namedRange) => namedRange.remove());
  spreadsheet.setNamedRange(name, range);
}

function createFilter_(sheet, startRow, startCol, numRows, numCols) {
  try {
    const existing = sheet.getFilter();
    if (existing) existing.remove();
    sheet.getRange(startRow, startCol, numRows, numCols).createFilter();
  } catch (error) {
    Logger.log(`Filter skipped on ${sheet.getName()}: ${error.message}`);
  }
}

function setWidths_(sheet, widths) {
  widths.forEach((width, index) => sheet.setColumnWidth(index + 1, width));
}

function asText_(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return Utilities.formatDate(value, OPS_BOARD.TIME_ZONE, 'yyyy-MM-dd');
  return String(value).trim();
}

function normalizeStatus_(value) {
  if (!value) return '';
  if (OPS_BOARD.STATUS.includes(value)) return value;
  if (['처리완료', '완료', '전체확인', '불필요'].includes(value)) return '완료';
  if (['진행', '작성중'].includes(value)) return '진행중';
  if (['보류', '확인필요'].includes(value)) return '보류';
  if (['대기'].includes(value)) return '대기';
  return '예정';
}

function normalizeContactType_(value) {
  const text = value || '';
  if (text.indexOf('방문') >= 0) return '방문';
  if (text.indexOf('전화') >= 0) return '전화';
  if (text.indexOf('문자') >= 0) return '문자';
  if (text.indexOf('상담') >= 0) return '대면';
  if (text.indexOf('연락') >= 0) return '연락';
  return text ? '연락' : '';
}

function defaultPriority_(category) {
  const text = category || '';
  if (text.indexOf('결제') >= 0 || text.indexOf('방문') >= 0) return '높음';
  if (text.indexOf('긴급') >= 0) return '긴급';
  return '보통';
}

function q_(sheetName) {
  return `'${sheetName.replace(/'/g, "''")}'`;
}

function colToLetter_(column) {
  let letter = '';
  let temp = column;
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter;
}
