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

  // 작업물 필터
  var chips = document.querySelectorAll('.chip');
  var works = document.querySelectorAll('.work');
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var f = chip.getAttribute('data-filter');
      chips.forEach(function (c) {
        c.classList.toggle('on', c === chip);
        c.setAttribute('aria-pressed', c === chip ? 'true' : 'false');
      });
      works.forEach(function (w) {
        w.classList.toggle('is-hidden', f !== 'all' && w.getAttribute('data-cat') !== f);
      });
    });
  });

  // 상세 이미지 보기
  var lb = document.getElementById('lightbox');
  var lbImg = document.getElementById('lbImg');
  var lbTitle = document.getElementById('lbTitle');
  var lbBody = lb.querySelector('.lightbox__body');
  var lastFocus = null;

  function openLb(btn) {
    lastFocus = btn;
    lbImg.src = btn.getAttribute('data-full');
    lbImg.alt = btn.getAttribute('data-title') || '';
    lbTitle.textContent = btn.getAttribute('data-title') || '';
    lb.hidden = false;
    lbBody.scrollTop = 0;
    document.body.style.overflow = 'hidden';
    document.getElementById('lbClose').focus();
  }
  function closeLb() {
    lb.hidden = true;
    lbImg.removeAttribute('src');
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }
  document.querySelectorAll('.work__img').forEach(function (b) {
    b.setAttribute('aria-label', (b.getAttribute('data-title') || '작업물') + ' 전체 페이지 보기');
    b.addEventListener('click', function () { openLb(b); });
  });
  document.getElementById('lbClose').addEventListener('click', closeLb);
  lb.addEventListener('click', function (e) { if (e.target === lb || e.target === lbBody) closeLb(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !lb.hidden) closeLb(); });
})();
