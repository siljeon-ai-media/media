/* 클라이언트 스크립트: 코드블록 복사 버튼, 이미지 미리보기, 제출 버튼 중복 방지 */
(function () {
  'use strict';

  // 1) 코드블록마다 "복사하기" 버튼 부착
  function legacyCopy(text) {
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.left = '-9999px';
      document.body.appendChild(ta); ta.focus(); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error('copy failed'));
    });
  }
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
    }
    return legacyCopy(text);
  }

  document.querySelectorAll('.codeblock').forEach(function (block) {
    if (block.querySelector('.copy-btn')) return;
    var code = block.querySelector('pre code') || block.querySelector('pre');
    var lang = block.getAttribute('data-lang');
    if (lang) { var l = document.createElement('span'); l.className = 'lang'; l.textContent = lang; block.appendChild(l); }
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'copy-btn'; btn.textContent = '복사하기';
    btn.addEventListener('click', function () {
      copyText(code.textContent).then(function () {
        btn.textContent = '복사됨 ✓'; btn.classList.add('done');
        setTimeout(function () { btn.textContent = '복사하기'; btn.classList.remove('done'); }, 1800);
      }).catch(function () { btn.textContent = '복사 실패'; });
    });
    block.appendChild(btn);
  });

  // 마크다운 코드블록이 래퍼 없이 렌더된 경우도 대비 (관리자 미리보기 등)
  document.querySelectorAll('.mission pre').forEach(function (pre) {
    if (pre.closest('.codeblock')) return;
    var wrap = document.createElement('div'); wrap.className = 'codeblock';
    pre.parentNode.insertBefore(wrap, pre); wrap.appendChild(pre);
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'copy-btn'; btn.textContent = '복사하기';
    btn.addEventListener('click', function () {
      copyText(pre.textContent).then(function () { btn.textContent = '복사됨 ✓'; setTimeout(function () { btn.textContent = '복사하기'; }, 1800); });
    });
    wrap.appendChild(btn);
  });

  // 2) 제출 폼: 이미지 미리보기 + 5MB/3장 사전 검사 + 중복 제출 방지
  var fileInput = document.querySelector('input[type=file][name=images]');
  if (fileInput) {
    var grid = document.getElementById('preview');
    var msg = document.getElementById('file-msg');
    fileInput.addEventListener('change', function () {
      if (grid) grid.innerHTML = '';
      var files = Array.prototype.slice.call(fileInput.files || []);
      var problems = [];
      if (files.length > 3) problems.push('이미지는 최대 3장까지예요.');
      files.forEach(function (f) {
        if (f.size > 5 * 1024 * 1024) problems.push(f.name + ' 은(는) 5MB를 넘어요.');
        if (!/^image\/(jpeg|png|webp)$/.test(f.type)) problems.push(f.name + ' 은(는) jpg/png/webp가 아니에요.');
        if (grid && /^image\//.test(f.type)) {
          var img = document.createElement('img'); img.src = URL.createObjectURL(f); grid.appendChild(img);
        }
      });
      if (msg) { msg.textContent = problems.length ? problems.join(' ') : (files.length ? files.length + '장 선택됨' : ''); msg.style.color = problems.length ? '#ff6b6b' : ''; }
    });
  }

  document.querySelectorAll('form[data-once]').forEach(function (form) {
    form.addEventListener('submit', function () {
      setTimeout(function(){ form.querySelectorAll('button[type=submit]').forEach(function(btn){ btn.disabled = true; btn.textContent = '전송 중...'; }); }, 0);
    });
  });

  // 3) 코드 목록 전체 복사 (관리자)
  var copyAll = document.getElementById('copy-codes');
  if (copyAll) {
    copyAll.addEventListener('click', function () {
      var src = document.getElementById('codes-out');
      copyText(src.textContent).then(function () { copyAll.textContent = '복사됨 ✓'; });
    });
  }
})();
