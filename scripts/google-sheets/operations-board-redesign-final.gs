const OPS = {
  sourceId: '1_f4q9m1U6U4NEw2qdB3W-ug43BmuYYfeEHS6qHspIiI',
  tz: 'Asia/Seoul',
  copyPrefix: '트랙 운영보드 리디자인',
  navy: '#14295F',
  orange: '#FF7A16',
  surface: '#F4F7FD',
  line: '#DDE4F2',
  muted: '#6D7892',
  text: '#17213A',
  white: '#FFFFFF',
  redBg: '#FCE8E6',
  red: '#B3261E',
  greenBg: '#E9F7EF',
  green: '#2E7D57',
  blueBg: '#EAF1FF',
  blue: '#2E5AAC',
  yellowBg: '#FFF7D6',
  newSheets: ['00_운영 허브', '01_업무 큐', '02_인수인계', '03_운영 체크', '04_상담·연락', '05_결제·재등록 체크', '06_운영 리포트', '99_설정'],
  src: {
    director: '원장 스케줄 관리',
    timetable: '⏰ 근무 타임테이블',
    student: '👥 학생 기본 DB',
    marketing: '📣 마케팅 관리',
    incident: '📝 특이사항 일지',
    consultation: '💬 상담 관리',
    blog: '✍️ 블로그 관리',
    notice: '📢 공지사항',
    dailyTodo: '✅ 일자별 해야할 일',
  },
  status: ['예정', '진행중', '대기', '완료', '보류'],
  priority: ['긴급', '높음', '보통', '낮음'],
  category: ['연락', '방문상담', '결제확인', '후속관리', '원장일정', '상담', '시설', '학생행동', '공지', '기타'],
  contactType: ['연락', '방문', '전화', '문자', '대면', '없음'],
  shift: ['오픈', '오후', '저녁', '마감', '긴급'],
  checkStatus: ['미확인', '정상', '확인필요', '완료'],
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('운영보드 리디자인')
    .addItem('복사본 생성', 'createRedesignedOperationsBoard')
    .addToUi();
}

function createRedesignedOperationsBoard() {
  const source = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(OPS.sourceId);
  const name = `${OPS.copyPrefix}_${Utilities.formatDate(new Date(), OPS.tz, 'yyyyMMdd')}`;
  const file = DriveApp.getFileById(source.getId());
  const parents = file.getParents();
  const folder = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  const copy = file.makeCopy(name, folder);
  const ss = SpreadsheetApp.openById(copy.getId());

  ss.setSpreadsheetTimeZone(OPS.tz);
  OPS.newSheets.forEach((n) => {
    const old = ss.getSheetByName(n);
    if (old) ss.deleteSheet(old);
  });

  buildSettings(ss, ss.insertSheet('99_설정'));
  buildQueue(ss, ss.insertSheet('01_업무 큐'));
  buildHandoff(ss, ss.insertSheet('02_인수인계'));
  buildChecklist(ss, ss.insertSheet('03_운영 체크'));
  buildContact(ss, ss.insertSheet('04_상담·연락'));
  buildBilling(ss, ss.insertSheet('05_결제·재등록 체크'));
  buildReport(ss, ss.insertSheet('06_운영 리포트'));
  buildHub(ss, ss.insertSheet('00_운영 허브'));

  OPS.newSheets.forEach((n, i) => {
    const s = ss.getSheetByName(n);
    if (!s) return;
    ss.setActiveSheet(s);
    ss.moveActiveSheet(i + 1);
  });

  const generated = new Set(OPS.newSheets);
  ss.getSheets().forEach((s) => {
    if (generated.has(s.getName())) return;
    s.setTabColor('#C9CED8');
    try {
      const p = s.protect();
      p.setWarningOnly(true);
      p.setDescription('리디자인 복사본의 원본 보존 탭입니다.');
    } catch (e) {
      Logger.log(e.message);
    }
  });

  ss.setActiveSheet(ss.getSheetByName('00_운영 허브'));
  SpreadsheetApp.flush();
  SpreadsheetApp.getUi().alert('운영보드 복사본 생성 완료', ss.getUrl(), SpreadsheetApp.getUi().ButtonSet.OK);
  return ss.getUrl();
}

function buildSettings(ss, sh) {
  prep(sh);
  sh.setTabColor(OPS.navy);
  title(sh, 'A1:H1', '운영보드 설정', '드롭다운과 기본값을 관리합니다.');
  list(sh, 4, 1, '상태', OPS.status);
  list(sh, 4, 2, '우선순위', OPS.priority);
  list(sh, 4, 3, '업무 구분', OPS.category);
  list(sh, 4, 4, '연락/방문', OPS.contactType);
  list(sh, 4, 5, '담당자', assignees(ss));
  list(sh, 4, 6, '교대', OPS.shift);
  list(sh, 4, 7, '점검 상태', OPS.checkStatus);
  named(ss, 'OPS_STATUS', sh.getRange(5, 1, OPS.status.length, 1));
  named(ss, 'OPS_PRIORITY', sh.getRange(5, 2, OPS.priority.length, 1));
  named(ss, 'OPS_CATEGORY', sh.getRange(5, 3, OPS.category.length, 1));
  named(ss, 'OPS_CONTACT_TYPE', sh.getRange(5, 4, OPS.contactType.length, 1));
  named(ss, 'OPS_ASSIGNEE', sh.getRange(5, 5, Math.max(1, assignees(ss).length), 1));
  named(ss, 'OPS_SHIFT', sh.getRange(5, 6, OPS.shift.length, 1));
  named(ss, 'OPS_CHECK_STATUS', sh.getRange(5, 7, OPS.checkStatus.length, 1));
  widths(sh, [130, 110, 130, 110, 130, 110, 110, 110]);
}

function buildQueue(ss, sh) {
  prep(sh);
  sh.setTabColor(OPS.orange);
  title(sh, 'A1:N1', '업무 큐', '조교와 관리자가 함께 쓰는 통합 업무판입니다.');
  const headers = ['업무ID', '날짜', '구분', '우선순위', '학생명', '학부모 연락처', '학생 연락처', '연락/방문', '업무내용', '담당자', '상태', '완료일', '메모', '원본'];
  const tasks = parseDailyTodos(ss).concat(parseDirector(ss));
  const count = Math.max(250, tasks.length + 40);
  sh.getRange(5, 1, 1, headers.length).setValues([headers]);
  header(sh.getRange(5, 1, 1, headers.length));
  const rows = Array.from({ length: count }, (_, i) => {
    const t = tasks[i] || {};
    return [t.id || `TASK-${String(i + 1).padStart(4, '0')}`, t.date || '', t.category || '', t.priority || '', t.student || '', '', '', t.contact || '', t.desc || '', t.owner || '', t.status || '', '', t.memo || '', t.source || ''];
  });
  sh.getRange(6, 1, count, headers.length).setValues(rows);
  contactFormulas(sh, count, 6, 5, 6, 7);
  dateVal(sh.getRange(6, 2, count, 1));
  val(ss, sh.getRange(6, 3, count, 1), 'OPS_CATEGORY');
  val(ss, sh.getRange(6, 4, count, 1), 'OPS_PRIORITY');
  val(ss, sh.getRange(6, 8, count, 1), 'OPS_CONTACT_TYPE');
  val(ss, sh.getRange(6, 10, count, 1), 'OPS_ASSIGNEE');
  val(ss, sh.getRange(6, 11, count, 1), 'OPS_STATUS');
  dateVal(sh.getRange(6, 12, count, 1));
  table(sh, 5, 1, count + 1, headers.length);
  statusRules(sh, sh.getRange(6, 1, count, headers.length), 11, 2, 4);
  widths(sh, [105, 100, 110, 85, 110, 130, 130, 90, 280, 105, 90, 100, 240, 135]);
  addFilter(sh, 5, 1, count + 1, headers.length);
  sh.setFrozenRows(5);
}

function buildHandoff(ss, sh) {
  prep(sh);
  sh.setTabColor(OPS.navy);
  title(sh, 'A1:J1', '인수인계', '교대 사이 핵심 이슈를 기록합니다.');
  const h = ['날짜', '교대', '우선순위', '구분', '학생명/좌석', '내용', '담당자', '상태', '다음 액션', '확인자'];
  sh.getRange(5, 1, 1, h.length).setValues([h]);
  header(sh.getRange(5, 1, 1, h.length));
  dateVal(sh.getRange(6, 1, 120, 1));
  val(ss, sh.getRange(6, 2, 120, 1), 'OPS_SHIFT');
  val(ss, sh.getRange(6, 3, 120, 1), 'OPS_PRIORITY');
  val(ss, sh.getRange(6, 4, 120, 1), 'OPS_CATEGORY');
  val(ss, sh.getRange(6, 7, 120, 1), 'OPS_ASSIGNEE');
  val(ss, sh.getRange(6, 8, 120, 1), 'OPS_STATUS');
  table(sh, 5, 1, 121, h.length);
  statusRules(sh, sh.getRange(6, 1, 120, h.length), 8, 1, 3);
  widths(sh, [100, 85, 85, 105, 125, 340, 105, 90, 240, 105]);
  addFilter(sh, 5, 1, 121, h.length);
  sh.setFrozenRows(5);
}

function buildChecklist(ss, sh) {
  prep(sh);
  sh.setTabColor(OPS.orange);
  title(sh, 'A1:I1', '운영 체크', '오픈/운영/마감 루틴 체크리스트입니다.');
  sh.getRange('A3').setValue('점검일').setFontWeight('bold').setFontColor(OPS.navy);
  sh.getRange('B3').setFormula('=TODAY()').setNumberFormat('yyyy-mm-dd').setBackground(OPS.white);
  const h = ['구역', '점검항목', '기준', '오픈', '오후', '마감', '담당자', '상태', '메모'];
  const rows = [
    ['오픈', '출입문/보안', '문 열림, CCTV/보안 이상 없음', false, false, false, '', '미확인', ''],
    ['오픈', '조명/좌석', '좌석 조명과 콘센트 확인', false, false, false, '', '미확인', ''],
    ['오픈', '냉난방/환기', '온도, 공기청정기, 환기 확인', false, false, false, '', '미확인', ''],
    ['운영중', '정숙/좌석 분위기', '소음, 자리 이동, 민원 확인', false, false, false, '', '미확인', ''],
    ['운영중', '학생 요청', '깨워달라는 요청, 시설 요청 확인', false, false, false, '', '미확인', ''],
    ['운영중', '프린터/와이파이', '장비 오류와 소모품 부족 확인', false, false, false, '', '미확인', ''],
    ['마감', '미완료 업무', '업무 큐와 인수인계 작성 확인', false, false, false, '', '미확인', ''],
    ['마감', '정리/소등', '좌석 정리, 분실물, 문단속 확인', false, false, false, '', '미확인', ''],
  ];
  sh.getRange(5, 1, 1, h.length).setValues([h]);
  header(sh.getRange(5, 1, 1, h.length));
  sh.getRange(6, 1, rows.length, h.length).setValues(rows);
  sh.getRange(6, 4, rows.length, 3).insertCheckboxes();
  val(ss, sh.getRange(6, 7, 100, 1), 'OPS_ASSIGNEE');
  val(ss, sh.getRange(6, 8, 100, 1), 'OPS_CHECK_STATUS');
  table(sh, 5, 1, 101, h.length);
  checkRules(sh, sh.getRange(6, 1, 100, h.length), 8);
  widths(sh, [90, 150, 290, 65, 65, 65, 105, 95, 260]);
  addFilter(sh, 5, 1, 101, h.length);
  sh.setFrozenRows(5);
}

function buildContact(ss, sh) {
  prep(sh);
  sh.setTabColor(OPS.navy);
  title(sh, 'A1:M1', '상담·연락', '상담 예정과 팔로업 연락을 확인합니다.');
  const h = ['번호', '신청일', '상담일', '학생명', '상담유형', '학부모 연락처', '신청경로', '담당자', '상담내용 요약', '다음 상담일', '팔로업 상태', '메모', '원본'];
  const data = parseConsultations(ss);
  const count = Math.max(160, data.length + 40);
  sh.getRange(5, 1, 1, h.length).setValues([h]);
  header(sh.getRange(5, 1, 1, h.length));
  const rows = Array.from({ length: count }, (_, i) => {
    const x = data[i] || {};
    return [x.no || i + 1, x.req || '', x.date || '', x.student || '', x.type || '', '', x.channel || '', x.owner || '', x.summary || '', x.next || '', x.status || '', x.memo || '', x.source || ''];
  });
  sh.getRange(6, 1, count, h.length).setValues(rows);
  singleContact(sh, count, 6, 4, 6);
  dateVal(sh.getRange(6, 2, count, 2));
  dateVal(sh.getRange(6, 10, count, 1));
  val(ss, sh.getRange(6, 8, count, 1), 'OPS_ASSIGNEE');
  val(ss, sh.getRange(6, 11, count, 1), 'OPS_STATUS');
  table(sh, 5, 1, count + 1, h.length);
  statusRules(sh, sh.getRange(6, 1, count, h.length), 11, 3, 11);
  widths(sh, [65, 100, 100, 110, 105, 130, 105, 105, 330, 100, 105, 230, 120]);
  addFilter(sh, 5, 1, count + 1, h.length);
  sh.setFrozenRows(5);
}

function buildBilling(ss, sh) {
  prep(sh);
  sh.setTabColor(OPS.orange);
  title(sh, 'A1:L1', '결제·재등록 체크', '결제 DB가 아닌 운영 확인용 체크리스트입니다.');
  const h = ['학생명', '학교', '학년', '재원상태', '재등록', '확인 구분', '확인 마감일', '담당자', '상태', '학부모 연락처', '학생 연락처', '메모'];
  const students = parseStudents(ss);
  const count = Math.max(160, students.length + 40);
  sh.getRange(5, 1, 1, h.length).setValues([h]);
  header(sh.getRange(5, 1, 1, h.length));
  const rows = Array.from({ length: count }, (_, i) => {
    const s = students[i] || {};
    return [s.name || '', s.school || '', s.grade || '', s.status || '', s.renewal || '', s.name ? '재등록 확인' : '', '', '', s.name ? '예정' : '', s.parent || '', s.studentPhone || '', s.memo || ''];
  });
  sh.getRange(6, 1, count, h.length).setValues(rows);
  dateVal(sh.getRange(6, 7, count, 1));
  val(ss, sh.getRange(6, 8, count, 1), 'OPS_ASSIGNEE');
  val(ss, sh.getRange(6, 9, count, 1), 'OPS_STATUS');
  table(sh, 5, 1, count + 1, h.length);
  statusRules(sh, sh.getRange(6, 1, count, h.length), 9, 7, 9);
  widths(sh, [110, 110, 85, 95, 105, 115, 100, 105, 90, 130, 130, 260]);
  addFilter(sh, 5, 1, count + 1, h.length);
  sh.setFrozenRows(5);
}

function buildReport(ss, sh) {
  prep(sh);
  sh.setTabColor(OPS.navy);
  title(sh, 'A1:L1', '운영 리포트', '이번 주 업무, 상담, 특이사항, 콘텐츠 운영 요약입니다.');
  sh.getRange('A4').setValue('주간 기준일').setFontWeight('bold').setFontColor(OPS.navy);
  sh.getRange('B4').setFormula('=TODAY()').setNumberFormat('yyyy-mm-dd').setBackground(OPS.white);
  sh.getRange('D4').setValue('주 시작').setFontWeight('bold').setFontColor(OPS.navy);
  sh.getRange('E4').setFormula('=$B$4-WEEKDAY($B$4,2)+1').setNumberFormat('yyyy-mm-dd').setBackground(OPS.white);
  sh.getRange('G4').setValue('주 종료').setFontWeight('bold').setFontColor(OPS.navy);
  sh.getRange('H4').setFormula('=$E$4+6').setNumberFormat('yyyy-mm-dd').setBackground(OPS.white);
  kpi(sh, 'A6:B8', '이번 주 업무', '=COUNTIFS(\'01_업무 큐\'!$B:$B,">="&$E$4,\'01_업무 큐\'!$B:$B,"<="&$H$4,\'01_업무 큐\'!$K:$K,"<>")');
  kpi(sh, 'C6:D8', '미완료', '=COUNTIFS(\'01_업무 큐\'!$B:$B,">="&$E$4,\'01_업무 큐\'!$B:$B,"<="&$H$4,\'01_업무 큐\'!$K:$K,"<>완료",\'01_업무 큐\'!$K:$K,"<>")');
  kpi(sh, 'E6:F8', '상담/연락', '=COUNTIFS(\'04_상담·연락\'!$C:$C,">="&$E$4,\'04_상담·연락\'!$C:$C,"<="&$H$4)');
  kpi(sh, 'G6:H8', '미처리 특이사항', '=COUNTIF(\'📝 특이사항 일지\'!$I:$I,"<>처리완료")-COUNTBLANK(\'📝 특이사항 일지\'!$I:$I)');
  kpi(sh, 'I6:J8', '마케팅 발행', '=COUNTIF(\'📣 마케팅 관리\'!$I:$I,"발행완료")+COUNTIF(\'✍️ 블로그 관리\'!$I:$I,"발행완료")');
  sh.getRange('A11:B11').setValues([['상태', '건수']]);
  header(sh.getRange('A11:B11'));
  sh.getRange(12, 1, OPS.status.length, 2).setValues(OPS.status.map((s) => [s, `=COUNTIF('01_업무 큐'!$K:$K,"${s}")`]));
  sh.getRange('D11:E11').setValues([['업무 구분', '건수']]);
  header(sh.getRange('D11:E11'));
  sh.getRange(12, 4, OPS.category.length, 2).setValues(OPS.category.map((c) => [c, `=COUNTIF('01_업무 큐'!$C:$C,"${c}")`]));
  table(sh, 11, 1, 6, 2);
  table(sh, 11, 4, OPS.category.length + 1, 2);
  widths(sh, [125, 90, 24, 125, 90, 90, 125, 90, 125, 90, 110, 110]);
}

function buildHub(ss, sh) {
  prep(sh);
  sh.setTabColor(OPS.orange);
  sh.getRange('A1:L1').merge().setValue('오늘 운영 상황판').setBackground(OPS.navy).setFontColor(OPS.white).setFontSize(20).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(1, 48);
  sh.getRange('A2:L2').merge().setValue('조교 선생님과 관리자가 하루 운영을 빠르게 확인하는 첫 화면입니다.').setBackground(OPS.white).setFontColor(OPS.muted).setHorizontalAlignment('center');
  sh.getRange('A3').setValue('운영일').setFontWeight('bold').setFontColor(OPS.navy);
  sh.getRange('B3').setFormula('=TODAY()').setNumberFormat('yyyy-mm-dd').setBackground(OPS.white);
  sh.getRange('D3').setValue('수정 원칙').setFontWeight('bold').setFontColor(OPS.navy);
  sh.getRange('E3:L3').merge().setValue('입력은 업무 큐/인수인계/운영 체크에서, 이 화면은 조회 중심으로 사용합니다.').setFontColor(OPS.muted).setBackground(OPS.white);
  kpi(sh, 'A5:B7', '미완료 업무', '=COUNTIFS(\'01_업무 큐\'!$B:$B,$B$3,\'01_업무 큐\'!$K:$K,"<>완료",\'01_업무 큐\'!$K:$K,"<>")');
  kpi(sh, 'C5:D7', '상담/연락', '=COUNTIFS(\'01_업무 큐\'!$B:$B,$B$3,\'01_업무 큐\'!$C:$C,"연락")+COUNTIFS(\'01_업무 큐\'!$B:$B,$B$3,\'01_업무 큐\'!$C:$C,"상담")+COUNTIFS(\'01_업무 큐\'!$B:$B,$B$3,\'01_업무 큐\'!$C:$C,"방문상담")');
  kpi(sh, 'E5:F7', '근무 인원', '=IFERROR(ROWS(UNIQUE(FILTER(\'⏰ 근무 타임테이블\'!$B$2:$B$500,TO_TEXT(\'⏰ 근무 타임테이블\'!$A$2:$A$500)=TEXT($B$3,"m/d"),BYROW(\'⏰ 근무 타임테이블\'!$D$2:$AK$500,LAMBDA(r,COUNTIF(r,"■")>0))))),0)');
  kpi(sh, 'G5:H7', '미처리 특이사항', '=IFERROR(ROWS(FILTER(\'📝 특이사항 일지\'!$A$2:$A$500,TO_TEXT(\'📝 특이사항 일지\'!$A$2:$A$500)=TEXT($B$3,"yyyy-mm-dd"),\'📝 특이사항 일지\'!$I$2:$I$500<>"처리완료")),0)');
  kpi(sh, 'I5:J7', '결제·재등록', '=COUNTIFS(\'01_업무 큐\'!$B:$B,$B$3,\'01_업무 큐\'!$C:$C,"결제확인",\'01_업무 큐\'!$K:$K,"<>완료")+COUNTIFS(\'05_결제·재등록 체크\'!$G:$G,"<="&$B$3,\'05_결제·재등록 체크\'!$I:$I,"<>완료",\'05_결제·재등록 체크\'!$I:$I,"<>")');
  section(sh, 'A10:H10', '오늘 미완료 업무');
  sh.getRange('A11:H11').setValues([['구분', '우선순위', '학생명', '학부모 연락처', '연락/방문', '업무내용', '담당자', '상태']]);
  header(sh.getRange('A11:H11'));
  sh.getRange('A12').setFormula('=IFERROR(FILTER({\'01_업무 큐\'!$C$6:$C,\'01_업무 큐\'!$D$6:$D,\'01_업무 큐\'!$E$6:$E,\'01_업무 큐\'!$F$6:$F,\'01_업무 큐\'!$H$6:$H,\'01_업무 큐\'!$I$6:$I,\'01_업무 큐\'!$J$6:$J,\'01_업무 큐\'!$K$6:$K},\'01_업무 큐\'!$B$6:$B=$B$3,\'01_업무 큐\'!$K$6:$K<>"완료"),{"오늘 미완료 업무가 없습니다.","","","","","","",""})');
  section(sh, 'J10:L10', '오늘 근무자');
  sh.getRange('J11:L11').setValues([['이름', '직책', '근무블록']]);
  header(sh.getRange('J11:L11'));
  sh.getRange('J12').setFormula('=IFERROR(FILTER({\'⏰ 근무 타임테이블\'!$B$2:$B$500,\'⏰ 근무 타임테이블\'!$C$2:$C$500,MMULT(--(\'⏰ 근무 타임테이블\'!$D$2:$AK$500="■"),TRANSPOSE(COLUMN(\'⏰ 근무 타임테이블\'!$D$2:$AK$2)^0))},TO_TEXT(\'⏰ 근무 타임테이블\'!$A$2:$A$500)=TEXT($B$3,"m/d"),BYROW(\'⏰ 근무 타임테이블\'!$D$2:$AK$500,LAMBDA(r,COUNTIF(r,"■")>0))),{"근무 입력 없음","",""})');
  section(sh, 'A27:F27', '인수인계 핵심');
  sh.getRange('A28:F28').setValues([['교대', '우선순위', '구분', '학생명/좌석', '내용', '상태']]);
  header(sh.getRange('A28:F28'));
  sh.getRange('A29').setFormula('=IFERROR(FILTER({\'02_인수인계\'!$B$6:$B,\'02_인수인계\'!$C$6:$C,\'02_인수인계\'!$D$6:$D,\'02_인수인계\'!$E$6:$E,\'02_인수인계\'!$F$6:$F,\'02_인수인계\'!$H$6:$H},\'02_인수인계\'!$A$6:$A=$B$3,\'02_인수인계\'!$H$6:$H<>"완료"),{"오늘 인수인계가 없습니다.","","","","",""})');
  section(sh, 'H27:L27', '최근 공지');
  sh.getRange('H28:L28').setValues([['날짜', '분류', '제목', '작성자', '확인']]);
  header(sh.getRange('H28:L28'));
  sh.getRange('H29').setFormula('=IFERROR(SORT(FILTER({\'📢 공지사항\'!$B$2:$B$100,\'📢 공지사항\'!$C$2:$C$100,\'📢 공지사항\'!$D$2:$D$100,\'📢 공지사항\'!$F$2:$F$100,\'📢 공지사항\'!$G$2:$G$100},\'📢 공지사항\'!$B$2:$B$100<>""),1,FALSE),{"공지 없음","","","",""})');
  section(sh, 'A43:J43', '오늘 미처리 특이사항');
  sh.getRange('A44:J44').setValues([['날짜', '요일', '분류', '제목', '상세 내용', '관련 학생', '담당자', '조치사항', '처리상태', '비고']]);
  header(sh.getRange('A44:J44'));
  sh.getRange('A45').setFormula('=IFERROR(FILTER(\'📝 특이사항 일지\'!$A$2:$J$500,TO_TEXT(\'📝 특이사항 일지\'!$A$2:$A$500)=TEXT($B$3,"yyyy-mm-dd"),\'📝 특이사항 일지\'!$I$2:$I$500<>"처리완료"),{"오늘 미처리 특이사항이 없습니다.","","","","","","","","",""})');
  widths(sh, [115, 90, 110, 130, 90, 260, 105, 85, 24, 115, 95, 95]);
  sh.setFrozenRows(10);
}

function prep(sh) {
  sh.clear();
  sh.clearConditionalFormatRules();
  sh.setHiddenGridlines(true);
  sh.getRange(1, 1, Math.max(sh.getMaxRows(), 200), Math.max(sh.getMaxColumns(), 12)).setBackground(OPS.surface);
}

function title(sh, a1, main, sub) {
  const r = sh.getRange(a1);
  r.merge().setValue(main).setBackground(OPS.navy).setFontColor(OPS.white).setFontSize(18).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(1, 44);
  sh.getRange(2, 1, 1, r.getNumColumns()).merge().setValue(sub).setBackground(OPS.white).setFontColor(OPS.muted).setHorizontalAlignment('center');
}

function header(r) {
  r.setBackground(OPS.navy).setFontColor(OPS.white).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true).setBorder(true, true, true, true, true, true, OPS.navy, SpreadsheetApp.BorderStyle.SOLID);
}

function section(sh, a1, text) {
  sh.getRange(a1).merge().setValue(text).setBackground(OPS.navy).setFontColor(OPS.white).setFontWeight('bold');
}

function kpi(sh, a1, label, formula) {
  const r = sh.getRange(a1);
  r.setBackground(OPS.white).setBorder(true, true, true, true, null, null, OPS.line, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  const row = r.getRow();
  const col = r.getColumn();
  const cols = r.getNumColumns();
  sh.getRange(row, col, 1, cols).merge().setValue(label).setFontColor(OPS.muted).setFontWeight('bold').setHorizontalAlignment('center');
  sh.getRange(row + 1, col, 2, cols).merge().setFormula(formula).setFontColor(OPS.navy).setFontWeight('bold').setFontSize(22).setHorizontalAlignment('center').setVerticalAlignment('middle');
}

function table(sh, row, col, rows, cols) {
  sh.getRange(row + 1, col, Math.max(1, rows - 1), cols).setBackground(OPS.white).setFontColor(OPS.text).setVerticalAlignment('middle').setWrap(true).setBorder(true, true, true, true, true, true, OPS.line, SpreadsheetApp.BorderStyle.SOLID);
}

function list(sh, row, col, name, values) {
  sh.getRange(row, col).setValue(name).setBackground(OPS.navy).setFontColor(OPS.white).setFontWeight('bold').setHorizontalAlignment('center');
  sh.getRange(row + 1, col, Math.max(1, values.length), 1).setValues((values.length ? values : ['']).map((v) => [v])).setBackground(OPS.white).setBorder(true, true, true, true, true, true, OPS.line, SpreadsheetApp.BorderStyle.SOLID);
}

function named(ss, name, range) {
  ss.getNamedRanges().filter((n) => n.getName() === name).forEach((n) => n.remove());
  ss.setNamedRange(name, range);
}

function val(ss, range, name) {
  const source = ss.getRangeByName(name);
  if (!source) return;
  range.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInRange(source, true).setAllowInvalid(false).build());
}

function dateVal(range) {
  range.setDataValidation(SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(true).build()).setNumberFormat('yyyy-mm-dd');
}

function statusRules(sh, range, statusCol, dateCol, priorityCol) {
  const row = range.getRow();
  const s = col(statusCol);
  const d = col(dateCol);
  const p = col(priorityCol);
  const rules = sh.getConditionalFormatRules();
  [['완료', OPS.greenBg, OPS.green], ['진행중', OPS.blueBg, OPS.blue], ['대기', OPS.yellowBg, OPS.text], ['보류', OPS.redBg, OPS.red]].forEach(([v, bg, fg]) => {
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(`=$${s}${row}="${v}"`).setBackground(bg).setFontColor(fg).setRanges([range]).build());
  });
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(`=AND($${d}${row}<TODAY(),$${d}${row}<>"",$${s}${row}<>"완료",$${s}${row}<>"")`).setBackground('#FFF2E8').setFontColor(OPS.red).setRanges([range]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(`=$${p}${row}="긴급"`).setBackground(OPS.redBg).setFontColor(OPS.red).setRanges([range]).build());
  sh.setConditionalFormatRules(rules);
}

function checkRules(sh, range, statusCol) {
  const row = range.getRow();
  const s = col(statusCol);
  const rules = sh.getConditionalFormatRules();
  [['완료', OPS.greenBg, OPS.green], ['정상', OPS.blueBg, OPS.blue], ['확인필요', OPS.redBg, OPS.red], ['미확인', OPS.yellowBg, OPS.text]].forEach(([v, bg, fg]) => {
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(`=$${s}${row}="${v}"`).setBackground(bg).setFontColor(fg).setRanges([range]).build());
  });
  sh.setConditionalFormatRules(rules);
}

function contactFormulas(sh, rows, startRow, nameCol, parentCol, studentCol) {
  const db = `'${OPS.src.student}'`;
  const parent = [];
  const student = [];
  for (let i = 0; i < rows; i++) {
    const row = startRow + i;
    const name = `$${col(nameCol)}${row}`;
    parent.push([`=IF(${name}="","",IFNA(VLOOKUP(${name},${db}!$B:$G,5,FALSE),""))`]);
    student.push([`=IF(${name}="","",IFNA(VLOOKUP(${name},${db}!$B:$G,6,FALSE),""))`]);
  }
  sh.getRange(startRow, parentCol, rows, 1).setFormulas(parent);
  sh.getRange(startRow, studentCol, rows, 1).setFormulas(student);
}

function singleContact(sh, rows, startRow, nameCol, contactCol) {
  const db = `'${OPS.src.student}'`;
  const formulas = [];
  for (let i = 0; i < rows; i++) {
    const row = startRow + i;
    const name = `$${col(nameCol)}${row}`;
    formulas.push([`=IF(${name}="","",IFNA(VLOOKUP(${name},${db}!$B:$G,5,FALSE),""))`]);
  }
  sh.getRange(startRow, contactCol, rows, 1).setFormulas(formulas);
}

function parseDailyTodos(ss) {
  const sh = ss.getSheetByName(OPS.src.dailyTodo);
  if (!sh) return [];
  const values = sh.getDataRange().getValues();
  const tasks = [];
  let currentDate = null;
  values.forEach((r) => {
    const first = text(r[0]);
    const m = first.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      currentDate = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      return;
    }
    if (!currentDate || first === '시간') return;
    const category = text(r[1]);
    const student = text(r[2]);
    const contact = text(r[4]);
    const desc = text(r[5]);
    const status = normStatus(text(r[7]));
    const memo = text(r[8]);
    const time = text(r[0]);
    if (![category, student, contact, desc, status, memo, time].some(Boolean)) return;
    tasks.push({ id: `TODO-${String(tasks.length + 1).padStart(4, '0')}`, date: currentDate, category: category || '기타', priority: priority(category), student, contact: normContact(contact || category), desc: desc || [time, category].filter(Boolean).join(' '), owner: '', status: status || '예정', memo, source: OPS.src.dailyTodo });
  });
  return tasks;
}

function parseDirector(ss) {
  const sh = ss.getSheetByName(OPS.src.director);
  if (!sh) return [];
  const values = sh.getDataRange().getValues();
  const tasks = [];
  let currentDate = null;
  values.forEach((r) => {
    const first = text(r[0]);
    const m = first.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      currentDate = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      return;
    }
    if (!currentDate || first === '시작') return;
    const start = text(r[0]);
    const end = text(r[1]);
    const category = text(r[2]);
    const title = text(r[4]);
    const target = text(r[6]);
    const follow = text(r[8]);
    if (![start, end, category, title, target, follow].some(Boolean)) return;
    tasks.push({ id: `DIR-${String(tasks.length + 1).padStart(4, '0')}`, date: currentDate, category: category || '원장일정', priority: priority(category || '원장일정'), student: target, contact: normContact(category), desc: [start && end ? `${start}-${end}` : start || end, title || '원장 일정', follow].filter(Boolean).join(' · '), owner: '김재윤', status: '예정', memo: '', source: OPS.src.director });
  });
  return tasks;
}

function parseConsultations(ss) {
  const sh = ss.getSheetByName(OPS.src.consultation);
  if (!sh) return [];
  const values = sh.getDataRange().getValues();
  const header = values.findIndex((r) => text(r[0]) === '번호' && text(r[3]) === '학생명');
  if (header < 0) return [];
  return values.slice(header + 1).filter((r) => text(r[3])).map((r, i) => ({ no: r[0] || i + 1, req: r[1] || '', date: r[2] || '', student: text(r[3]), type: text(r[4]), channel: text(r[5]), owner: text(r[6]), summary: text(r[7]), next: r[10] || '', status: normStatus(text(r[11])) || '예정', memo: text(r[12]), source: OPS.src.consultation }));
}

function parseStudents(ss) {
  const sh = ss.getSheetByName(OPS.src.student);
  if (!sh) return [];
  const values = sh.getDataRange().getValues();
  const header = values.findIndex((r) => text(r[1]) === '이름' && text(r[5]).indexOf('학부모') >= 0);
  if (header < 0) return [];
  return values.slice(header + 1).filter((r) => text(r[1])).map((r) => ({ name: text(r[1]), school: text(r[2]), grade: text(r[3]), parent: text(r[5]), studentPhone: text(r[6]), renewal: text(r[8]), status: text(r[9]), memo: text(r[10]) }));
}

function assignees(ss) {
  const names = new Set(['김재윤', '김다은']);
  [[OPS.src.timetable, 2], [OPS.src.marketing, 8], [OPS.src.consultation, 7], [OPS.src.blog, 8], [OPS.src.incident, 7], [OPS.src.notice, 6]].forEach(([name, c]) => {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) return;
    sh.getRange(1, c, sh.getLastRow(), 1).getValues().flat().map(text).filter((v) => v && !['이름', '담당자', '작성자'].includes(v)).forEach((v) => names.add(v));
  });
  return Array.from(names).slice(0, 80);
}

function addFilter(sh, row, colNo, rows, cols) {
  try {
    const f = sh.getFilter();
    if (f) f.remove();
    sh.getRange(row, colNo, rows, cols).createFilter();
  } catch (e) {
    Logger.log(e.message);
  }
}

function widths(sh, ws) {
  ws.forEach((w, i) => sh.setColumnWidth(i + 1, w));
}

function text(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return Utilities.formatDate(v, OPS.tz, 'yyyy-MM-dd');
  return String(v).trim();
}

function normStatus(v) {
  if (!v) return '';
  if (OPS.status.includes(v)) return v;
  if (['처리완료', '완료', '전체확인', '불필요'].includes(v)) return '완료';
  if (['진행', '작성중'].includes(v)) return '진행중';
  if (['보류', '확인필요'].includes(v)) return '보류';
  if (v === '대기') return '대기';
  return '예정';
}

function normContact(v) {
  const s = v || '';
  if (s.indexOf('방문') >= 0) return '방문';
  if (s.indexOf('전화') >= 0) return '전화';
  if (s.indexOf('문자') >= 0) return '문자';
  if (s.indexOf('상담') >= 0) return '대면';
  if (s.indexOf('연락') >= 0) return '연락';
  return s ? '연락' : '';
}

function priority(v) {
  const s = v || '';
  if (s.indexOf('결제') >= 0 || s.indexOf('방문') >= 0) return '높음';
  if (s.indexOf('긴급') >= 0) return '긴급';
  return '보통';
}

function col(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - m) / 26);
  }
  return s;
}
