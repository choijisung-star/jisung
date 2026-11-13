(function () {
  document.documentElement.classList.add('js');

  // 등장 애니메이션
  var items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('in'); });
  }

  // 작업물 챕터 페이지: 분야별로 모아 보기
  var pchips = document.querySelectorAll('.pj-chip');
  var pworks = document.querySelectorAll('.pw');
  pchips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var f = chip.getAttribute('data-filter');
      pchips.forEach(function (c) {
        var on = c === chip;
        c.classList.toggle('on', on);
        c.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      var n = 0;
      pworks.forEach(function (w) {
        var hide = f !== 'all' && w.getAttribute('data-cat') !== f;
        w.classList.toggle('is-hidden', hide);
        if (!hide) {
          n++;
          // 번호를 보이는 순서대로 다시 매김
          var num = w.querySelector('.pw__n');
          if (num) num.textContent = (n < 10 ? '0' : '') + n;
        }
      });
    });
  });

  // 문의 폼
  var form = document.getElementById('inquiryForm');
  if (form) {
    var statusEl = document.getElementById('formStatus');
    var submitBtn = form.querySelector('button[type="submit"]');
    var OWNER_EMAIL = 'jisungwltjd@naver.com';
    var FIELDS = ['name', 'email', 'phone', 'company', 'message'];

    var say = function (msg, type) {
      statusEl.textContent = msg;
      statusEl.className = 'form__status' + (type ? ' ' + type : '');
    };

    // 보내는 동안: 버튼 잠금 + 글자 변경 + 안내 문구
    var sending = false;
    var idleLabel = submitBtn.textContent;
    var setSending = function (on) {
      sending = on;
      submitBtn.disabled = on;
      submitBtn.textContent = on ? '보내는 중…' : idleLabel;
      form.setAttribute('aria-busy', on ? 'true' : 'false');
      if (on) say('보내는 중입니다. 잠시만 기다려 주세요.');
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }

      var endpoint = form.getAttribute('data-endpoint') || '';
      var data = new FormData(form);
      if (data.get('website')) { form.reset(); say('문의가 전달되었습니다.', 'ok'); return; } // 스팸 봇

      var values = {};
      FIELDS.forEach(function (k) { values[k] = String(data.get(k) || '').trim(); });

      // 전송 주소가 없거나 구글 Apps Script 주소가 아니면(잘못 붙여넣은 경우):
      // 방문자의 메일 앱을 열어 내게 보내는 방식으로 대신함
      if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(endpoint)) {
        var body = '이름: ' + values.name + '\n이메일: ' + values.email +
          '\n전화번호: ' + (values.phone || '-') + '\n회사,직함: ' + (values.company || '-') +
          '\n\n외주 요청·문의 내용:\n' + values.message;
        window.location.href = 'mailto:' + OWNER_EMAIL +
          '?subject=' + encodeURIComponent('[포트폴리오 문의] ' + values.name + '님') +
          '&body=' + encodeURIComponent(body);
        say('메일 앱이 열립니다. 내용을 확인하고 보내기를 눌러 주세요.', 'ok');
        return;
      }

      // 이미 보내는 중이면 무시 (버튼 연타, 엔터 두 번 방지)
      if (sending) return;
      setSending(true);

      var params = new URLSearchParams();
      FIELDS.forEach(function (k) { params.append(k, values[k]); });
      params.append('website', '');

      // 15초 안에 응답이 없으면 실패로 처리
      var ctrl = 'AbortController' in window ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 15000) : null;

      // Apps Script 는 다른 주소라 응답 내용은 읽을 수 없습니다(no-cors). 전송 성공 여부만 알 수 있어요.
      fetch(endpoint, { method: 'POST', mode: 'no-cors', body: params, signal: ctrl ? ctrl.signal : undefined })
        .then(function () {
          form.reset();
          say('문의가 접수되었습니다. 확인 후 연락드리겠습니다. (접수 확인 메일이 오지 않으면 ' + OWNER_EMAIL + ' 로 연락 주세요.)', 'ok');
        })
        .catch(function () {
          say('전송에 실패했습니다. 잠시 후 다시 시도하거나 ' + OWNER_EMAIL + ' 로 연락 주세요.', 'err');
        })
        .then(function () {
          if (timer) clearTimeout(timer);
          setSending(false);
        });
    });
  }
})();

/* 메인 첫 화면 제목 타이핑: 일단 / 해보자, / 그 / 리고 / 끝까지 / 해 / 냅니다. 순서로 한 글자씩 */
(function () {
  var h = document.getElementById('hero-title');
  if (!h || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
  var chars = [];
  (function wrap(node) {
    Array.prototype.slice.call(node.childNodes).forEach(function (n) {
      if (n.nodeType === 3) {
        var frag = document.createDocumentFragment();
        n.nodeValue.split('').forEach(function (c) {
          if (/\s/.test(c)) { frag.appendChild(document.createTextNode(c)); return; }
          var s = document.createElement('span'); s.className = 'tc'; s.setAttribute('aria-hidden', 'true'); s.textContent = c;
          chars.push(s); frag.appendChild(s);
        });
        n.parentNode.replaceChild(frag, n);
      } else if (n.nodeType === 1 && !n.classList.contains('sr-only') && n.tagName !== 'BR') { wrap(n); }
    });
  })(h);
  if (!chars.length) return;
  var pauseAfter = { 2: 450, 6: 520, 7: 700, 9: 480, 12: 560, 13: 720 };   // 글자 수 기준: 일단|해보자,|그|리고|끝까지|해|냅니다.
  var i = 0, cur = null, started = false;
  function step() {
    if (cur) cur.classList.remove('tc--cur');
    if (i >= chars.length) { return; }
    cur = chars[i]; cur.classList.add('tc--on', 'tc--cur'); i++;
    setTimeout(function () { if (i >= chars.length && cur) { setTimeout(function () { cur.classList.remove('tc--cur'); }, 900); } step(); }, pauseAfter[i] || 120);
  }
  function start() { if (started) return; started = true; setTimeout(step, 350); }
  var root = document.documentElement;
  if (root.classList.contains('intro-on')) {
    var mo = new MutationObserver(function () { if (!root.classList.contains('intro-on')) { mo.disconnect(); start(); } });
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
  } else { start(); }
})();

/* 챕터 상단 메뉴 높이를 CSS 변수로 알려 줌 (분야 칩이 메뉴 바로 아래에 붙도록) */
(function(){
  var bar=document.querySelector('.pj-bar'); if(!bar) return;
  function set(){document.documentElement.style.setProperty('--bar-h',bar.getBoundingClientRect().height+'px')}
  set(); window.addEventListener('resize',set); window.addEventListener('load',set);
})();
