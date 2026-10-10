/**
 * 최지성 포트폴리오 — 문의 폼 → 구글 시트 저장 + 알림 메일 + 신청자 자동회신
 *
 * 사용법: 구글 시트 > 확장 프로그램 > Apps Script 에 이 코드를 붙여넣고
 *        아래 CONFIG.OWNER_EMAIL 만 본인 이메일로 바꾼 뒤 웹 앱으로 배포하세요.
 *
 * 받는 값(POST): name, email, phone, company, message
 *   (website 는 스팸 방지용 숨김 칸이라 사람이 채우면 안 됩니다)
 */

const CONFIG = {
  OWNER_EMAIL: 'jisungwltjd@naver.com',        // 알림을 받을 본인 이메일
  SENDER_NAME: '최지성',                       // 자동회신 보낸 사람 이름
  SHEET_ID: '',                                // 시트 안에서 만든 스크립트면 비워 두세요. 시트 밖(script.google.com)에서 만들었다면 시트 주소의 /d/ 와 /edit 사이 긴 문자열을 넣으세요
  SHEET_NAME: '',                              // 비워 두면 첫 번째 탭 사용
  ADD_TIMESTAMP: true,                         // 맨 끝에 '접수시각' 열 추가 (원치 않으면 false)
  DAILY_LIMIT: 30,                             // 하루 최대 접수 건수 (스팸·메일 한도 보호)
  RESEND_BLOCK_SECONDS: 300                    // 같은 이메일로 연속 접수 차단 시간
};

// 시트 헤더 순서 (요청하신 순서 그대로)
const HEADERS = ['이름', '이메일', '전화번호', '회사,직함', '외주 요청 내용'];
const MAX_LEN = { name: 50, email: 120, phone: 30, company: 100, message: 3000 };

/** 폼에서 POST 로 호출되는 진입점 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const data = parseRequest_(e);

    // 스팸 봇이 숨김 칸을 채웠다면 성공한 척하고 조용히 버림
    if (data.website) return json_({ ok: true });

    const error = validate_(data);
    if (error) return json_({ ok: false, error: error });

    lock.waitLock(10000); // 동시에 여러 건이 들어와도 줄이 섞이지 않게

    const limitError = checkLimits_(data.email);
    if (limitError) return json_({ ok: false, error: limitError });

    appendRow_(data);
    markAccepted_(data.email);
    lock.releaseLock();

    // 메일은 저장 후에 보냄: 메일이 실패해도 문의 내용은 시트에 남음
    sendOwnerNotice_(data);
    sendAutoReply_(data);

    return json_({ ok: true });
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    return json_({ ok: false, error: 'server_error' });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

/** 주소를 브라우저로 열었을 때 동작 확인용 */
function doGet() {
  return ContentService.createTextOutput('문의 접수 서버가 동작 중입니다.');
}

/* ───────────── 요청 해석 · 검증 ───────────── */

function parseRequest_(e) {
  let p = (e && e.parameter) || {};

  // fetch 를 text/plain 또는 JSON 으로 보낸 경우도 처리
  const raw = e && e.postData && e.postData.contents;
  if ((!p || !p.name) && raw && raw.trim().charAt(0) === '{') {
    try { p = JSON.parse(raw); } catch (_) { /* 무시 */ }
  }

  return {
    name: oneLine_(p.name),
    email: oneLine_(p.email).toLowerCase(),
    phone: oneLine_(p.phone),
    company: oneLine_(p.company),
    message: String(p.message || '').replace(/\r\n/g, '\n').trim(),
    website: oneLine_(p.website)
  };
}

function oneLine_(v) {
  return String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').trim();
}

function validate_(d) {
  if (!d.name) return 'name_required';
  if (!d.email) return 'email_required';
  if (!/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(d.email)) return 'email_invalid';
  if (!d.message) return 'message_required';
  if (d.phone && !/^[0-9+\-\s()]{7,30}$/.test(d.phone)) return 'phone_invalid';
  if (d.name.length > MAX_LEN.name || d.email.length > MAX_LEN.email ||
      d.phone.length > MAX_LEN.phone || d.company.length > MAX_LEN.company ||
      d.message.length > MAX_LEN.message) return 'too_long';
  return '';
}

/* ───────────── 스팸·한도 방지 ───────────── */

function today_() {
  return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd');
}

function checkLimits_(email) {
  if (CacheService.getScriptCache().get('e:' + email)) return 'too_frequent';

  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('day') === today_() &&
      Number(props.getProperty('count') || 0) >= CONFIG.DAILY_LIMIT) {
    return 'daily_limit';
  }
  return '';
}

function markAccepted_(email) {
  CacheService.getScriptCache().put('e:' + email, '1', CONFIG.RESEND_BLOCK_SECONDS);

  const props = PropertiesService.getScriptProperties();
  const day = today_();
  const count = props.getProperty('day') === day ? Number(props.getProperty('count') || 0) : 0;
  props.setProperties({ day: day, count: String(count + 1) });
}

/* ───────────── 시트 저장 ───────────── */

function getSheet_() {
  // 시트 안에서 만든 스크립트면 자동으로 그 시트를 쓰고, 아니면 SHEET_ID 로 시트를 엽니다
  const ss = CONFIG.SHEET_ID
    ? SpreadsheetApp.openById(CONFIG.SHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('저장할 시트를 찾을 수 없습니다. 구글 시트의 [확장 프로그램 > Apps Script]에서 만들거나, CONFIG.SHEET_ID 를 채우세요.');
  return (CONFIG.SHEET_NAME && ss.getSheetByName(CONFIG.SHEET_NAME)) || ss.getSheets()[0];
}

function appendRow_(d) {
  const sheet = getSheet_();
  const headers = CONFIG.ADD_TIMESTAMP ? HEADERS.concat(['접수시각']) : HEADERS;

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  const row = [d.name, d.email, d.phone, d.company, d.message];
  if (CONFIG.ADD_TIMESTAMP) {
    row.push(Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'));
  }

  // 서식을 '일반 텍스트'로 지정해 =, + 로 시작하는 입력이 수식으로 실행되는 것을 막고
  // 전화번호 앞자리 0 이 지워지지 않게 함
  const range = sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length);
  range.setNumberFormat('@').setValues([row]);
}

/* ───────────── 메일 ───────────── */

function esc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;').replace(/\n/g, '<br>');
}

function summaryHtml_(d) {
  const rows = [
    ['이름', d.name], ['이메일', d.email], ['전화번호', d.phone || '-'],
    ['회사,직함', d.company || '-'], ['외주 요청 내용', d.message]
  ];
  return '<table style="border-collapse:collapse;font-size:14px">' + rows.map(function (r) {
    return '<tr><td style="padding:6px 14px 6px 0;color:#666;vertical-align:top;white-space:nowrap">' +
           r[0] + '</td><td style="padding:6px 0">' + esc_(r[1]) + '</td></tr>';
  }).join('') + '</table>';
}

function summaryText_(d) {
  return '이름: ' + d.name + '\n이메일: ' + d.email + '\n전화번호: ' + (d.phone || '-') +
         '\n회사,직함: ' + (d.company || '-') + '\n\n외주 요청 내용:\n' + d.message;
}

/** 내게 오는 '새 문의 도착' 알림 */
function sendOwnerNotice_(d) {
  try {
    MailApp.sendEmail({
      to: CONFIG.OWNER_EMAIL,
      replyTo: d.email, // 이 메일에 '답장'하면 바로 신청자에게 감
      subject: '[새 문의 도착] ' + d.name + '님' + (d.company ? ' (' + d.company + ')' : ''),
      body: '포트폴리오 사이트로 새 문의가 도착했습니다.\n\n' + summaryText_(d),
      htmlBody: '<p>포트폴리오 사이트로 새 문의가 도착했습니다.</p>' + summaryHtml_(d),
      name: '포트폴리오 문의 알림'
    });
  } catch (err) {
    console.error('알림 메일 실패: ' + err);
  }
}

/** 신청자에게 가는 '접수되었습니다' 자동회신 */
function sendAutoReply_(d) {
  try {
    MailApp.sendEmail({
      to: d.email,
      replyTo: CONFIG.OWNER_EMAIL,
      subject: '[' + CONFIG.SENDER_NAME + '] 문의가 접수되었습니다',
      body: d.name + '님, 안녕하세요.\n' +
            '보내주신 외주 요청 문의가 정상적으로 접수되었습니다.\n' +
            '내용을 확인한 뒤 빠른 시일 내에 연락드리겠습니다.\n\n' +
            '── 접수 내용 ──\n' + summaryText_(d) + '\n\n' +
            '본 메일은 자동 발송되었습니다. 감사합니다.\n' + CONFIG.SENDER_NAME + ' 드림',
      htmlBody: '<p>' + esc_(d.name) + '님, 안녕하세요.<br>' +
                '보내주신 외주 요청 문의가 정상적으로 접수되었습니다.<br>' +
                '내용을 확인한 뒤 빠른 시일 내에 연락드리겠습니다.</p>' +
                '<p style="margin:20px 0 6px;color:#666">접수 내용</p>' + summaryHtml_(d) +
                '<p style="margin-top:24px;color:#888;font-size:12px">본 메일은 자동 발송되었습니다.</p>' +
                '<p>감사합니다.<br>' + esc_(CONFIG.SENDER_NAME) + ' 드림</p>',
      name: CONFIG.SENDER_NAME
    });
  } catch (err) {
    console.error('자동회신 실패: ' + err);
  }
}

/* ───────────── 응답 · 테스트 ───────────── */

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
                       .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 배포 전 테스트용: 편집기에서 이 함수를 선택하고 [실행]을 누르세요.
 * - 처음 실행하면 권한 허용 창이 뜹니다 (시트, 메일 보내기 권한).
 * - 시트에 한 줄이 추가되고, 알림과 자동회신이 모두 내 이메일로 도착하면 성공입니다.
 */
function testSubmit() {
  const out = doPost({
    parameter: {
      name: '테스트',
      email: CONFIG.OWNER_EMAIL,
      phone: '010-0000-0000',
      company: '테스트 회사, 채용담당',
      message: '테스트 문의입니다.\n여러 줄 입력도 확인합니다.'
    }
  });
  console.log(out.getContent());
}
