// 입장 페이지: 여러 장의 카드가 겹쳐 보이고, 스크롤로 내 포트폴리오 카드를 골라 누르면 메인으로 들어갑니다.
(function () {
  var root = document.documentElement;
  var intro = document.getElementById('intro');
  if (!intro) return;
  var active = root.classList.contains('intro-on');

  var cards = Array.prototype.slice.call(intro.querySelectorAll('.ic'));
  var N = cards.length;
  var me = cards.findIndex(function (c) { return c.hasAttribute('data-me'); });
  var count = intro.querySelector('.intro__count');
  var p = 0, target = 0, fm = 0, snapTimer = null, done = !active, raf = 0;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function render() {
    var u = window.innerHeight / 100;
    // 내 카드(me)가 앞의 카드 2장을 밀어내며 올라오는 정도(0~1): me 가 앞에서 약 2장 뒤에 올 때부터 시작
    var dm = me - p, g = dm >= 0 ? clamp((2.2 - dm) / 2.2, 0, 1) : clamp(1 + dm, 0, 1), ge = g * g * (3 - 2 * g);
    for (var i = 0; i < N; i++) {
      var d = i - p, el = cards[i], ty, tz, rx, op;
      if (d >= 0) {
        if (i < me) {            // 내 카드 앞에 있는 카드: 앞쪽(아래)으로 밀려남
          ty = (33 - d * 7 + ge * 21) * u; tz = -d * 140 + ge * 70; rx = -26; op = 0.86;
        } else {                 // 내 카드 포함, 뒤쪽 카드: 위로 쌓임
          ty = (33 * (1 - ge) - 10.5 * ge) * u - d * (7 * (1 - ge) + 3.6 * ge) * u; tz = -d * 140; rx = -26; op = 0.86;
        }
      } else {
        var t = -d; ty = ((33 + t * 12) * (1 - ge) + (35 + t * 5.5) * ge) * u; tz = t * 90 * (1 - ge) + ge * 70; rx = -26; op = clamp(1 - Math.max(0, t - 1.5) * 0.7, 0, 1);
        if (i > me) { ty = (33 + t * 12) * u; tz = t * 90; }
      }
      var f = (i === me) ? ge : 0, s = 1;
      if (f > 0) { ty = ty * (1 - f) + (-3 * u) * f; rx = rx * (1 - f * 0.9); tz = tz * (1 - f); s = 1 + f * 0.34; op = 1; }
      el.style.transform = 'translate(-50%,-50%) translate3d(0,' + ty.toFixed(1) + 'px,' + tz.toFixed(1) + 'px) rotateX(' + rx.toFixed(1) + 'deg) scale(' + s.toFixed(3) + ')';
      el.style.opacity = op.toFixed(3);
      el.style.setProperty("--v", (f > 0.02 ? 0 : (d < 0 ? 0.12 : 0.08 + Math.min(d, 6) * 0.01)).toFixed(3));
      el.style.zIndex = String(f > 0.02 ? 520 : (d < 0 ? 480 + Math.round(d * 10) : 500 - Math.round(d * 10)));
      el.style.pointerEvents = (d < -0.6 || op < 0.05) ? 'none' : 'auto';
      el.classList.toggle('is-front', Math.abs(d) < 0.5);
    }
    var near = Math.round(p);
    if (count) count.textContent = ('0' + (near + 1)).slice(-2) + ' / ' + N;
    intro.classList.toggle('intro--me', near === me);
  }

  function loop() {
    var diff = target - p, want = (Math.round(target) === me && Math.abs(diff) < 0.15) ? 1 : 0, fd = want - fm, dirty = false;
    if (Math.abs(diff) > 0.0008) { p += diff * 0.085; dirty = true; }
    else if (p !== target) { p = target; dirty = true; }
    if (Math.abs(fd) > 0.0005) { fm += fd * 0.045; dirty = true; }
    else if (fm !== want) { fm = want; dirty = true; }
    if (dirty) render();
    raf = requestAnimationFrame(loop);
  }

  function nudge(delta) {
    target = clamp(target + delta, 0, me);
    clearTimeout(snapTimer);
    snapTimer = setTimeout(function () { target = Math.round(target); }, 140);
  }
  function go(i) { clearTimeout(snapTimer); target = clamp(i, 0, me); }

  function enter(fast) {
    if (done) return; done = true;
    try { sessionStorage.setItem('intro', '1'); } catch (e) {}
    intro.classList.add('go'); if (fast) intro.classList.add('go--fast');
    setTimeout(function () {
      cancelAnimationFrame(raf);
      root.classList.remove('intro-on');
      intro.classList.remove('go', 'go--fast');
      window.scrollTo(0, 0);
    }, fast ? 250 : 800);
  }

  intro.addEventListener('wheel', function (e) {
    e.preventDefault();
    nudge(clamp(e.deltaY, -120, 120) * 0.004);
  }, { passive: false });

  var ty0 = null;
  intro.addEventListener('touchstart', function (e) { ty0 = e.touches[0].clientY; }, { passive: true });
  intro.addEventListener('touchmove', function (e) {
    if (ty0 === null) return;
    var y = e.touches[0].clientY; nudge((ty0 - y) / 220); ty0 = y;
  }, { passive: true });
  intro.addEventListener('touchend', function () { ty0 = null; clearTimeout(snapTimer); snapTimer = setTimeout(function () { target = Math.round(target); }, 60); });

  cards.forEach(function (c, i) {
    c.addEventListener('click', function () {
      var near = Math.round(target);
      if (i !== near) { go(i); return; }
      if (i === me) enter(false); else go(i + 1);
    });
  });
  intro.querySelector('.intro__skip').addEventListener('click', function () { enter(true); });
  intro.querySelector('.intro__enter').addEventListener('click', function () { if (Math.round(target) === me) enter(false); else go(me); });

  document.addEventListener('keydown', function (e) {
    if (done) return;
    var k = e.key;
    if (k === 'ArrowDown' || k === 'ArrowRight' || k === 'PageDown') { e.preventDefault(); go(Math.round(target) + 1); }
    else if (k === 'ArrowUp' || k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); go(Math.round(target) - 1); }
    else if (k === 'Enter') { if (Math.round(target) === me) enter(false); else go(me); }
    else if (k === 'Escape') { enter(true); }
  });
  window.addEventListener('resize', render);

  function reopen() {
    p = target = fm = 0; done = false;
    intro.classList.remove("go", "go--fast");
    root.classList.add("intro-on");
    cancelAnimationFrame(raf); render(); raf = requestAnimationFrame(loop);
  }
  var logo = document.querySelector("header a[href=\"#top\"]");
  if (logo) logo.addEventListener("click", function (e) { e.preventDefault(); reopen(); });

  if (active) { render(); raf = requestAnimationFrame(loop); }
})();
