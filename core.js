var PAGES = {};
var ST = { token: '', user: null, jobs: null, page: 'calendar' };
var NAV = ['calendar', 'daytime', 'rawmat', 'rcy', 'report', 'setting'];
var NAV_TITLES = { calendar: 'ปฏิทิน', daytime: 'Daytime Record', rawmat: 'Raw Mat Record', rcy: 'RCY Record', report: 'Report', setting: 'Setting' };
var TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
var CLASSES = ['Operator', 'Leader', 'Engineer', 'Manager', 'Admin'];
var DEPTS = ['Daytime', 'Raw Material', 'RCY'];
var LINES = ['Line#1', 'Line#2', 'Line#3', 'UT', 'Solvent', 'Other'];
var LEADER_UP = ['Leader', 'Engineer', 'Manager', 'Admin'];
var STATUS_TH = { PENDING: 'รอตรวจ', APPROVED: 'อนุมัติ', REJECTED: 'ส่งกลับ' };
var PHOTO_CACHE = {};

// ---------- เก็บ session ----------
var mem = {};
var store = {
  get: function (k) { try { return localStorage.getItem(k); } catch (e) { return mem[k] || null; } },
  set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { mem[k] = v; } },
  del: function (k) { try { localStorage.removeItem(k); } catch (e) { delete mem[k]; } }
};

// ---------- ฟังก์ชันทั่วไป ----------
function $(id) { return document.getElementById(id); }
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function pad(n) { return (n < 10 ? '0' : '') + n; }
function ymd(d) { return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
function pd(s) { var a = String(s).split('-').map(Number); return new Date(Date.UTC(a[0], a[1] - 1, a[2])); }
function addD(s, n) { var d = pd(s); d.setUTCDate(d.getUTCDate() + n); return ymd(d); }
function todayStr() { return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' }); }
function thD(s) { var d = pd(s); return d.getUTCDate() + ' ' + TH_M[d.getUTCMonth()]; }
function dayDiff(a, b) { return Math.round((pd(a) - pd(b)) / 86400000); }
function isWE(s) { var w = pd(s).getUTCDay(); return w === 0 || w === 6; }
function shiftMonth(ym, n) {
  var a = ym.split('-').map(Number);
  var d = new Date(Date.UTC(a[0], a[1] - 1 + n, 1));
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1);
}
function monthRange(ym) {
  var a = ym.split('-').map(Number);
  return { from: ym + '-01', to: ymd(new Date(Date.UTC(a[0], a[1], 0))) };
}
function monthTitle(ym) { return TH_M[Number(ym.slice(5)) - 1] + ' ' + (Number(ym.slice(0, 4)) + 543); }
function uniq(arr) {
  var seen = {}, out = [];
  arr.forEach(function (x) { if (x && !seen[x]) { seen[x] = 1; out.push(x); } });
  return out.sort();
}
function jobLabel(x) { return (x.line ? x.line + ' · ' : '') + (x.machine ? x.machine + ' · ' : '') + x.job_name; }
function optHtml(list, selected) {
  var h = '';
  for (var i = 0; i < list.length; i++) {
    var v = Array.isArray(list[i]) ? list[i][0] : list[i];
    var l = Array.isArray(list[i]) ? list[i][1] : list[i];
    h += '<option value="' + esc(v) + '"' + (String(v) === String(selected) ? ' selected' : '') + '>' + esc(l) + '</option>';
  }
  return h;
}

// ---------- สิทธิ์ ----------
function can(list) { return !!ST.user && list.indexOf(ST.user['class']) >= 0; }
function canRecord(dept) {
  return !!ST.user && (LEADER_UP.indexOf(ST.user['class']) >= 0 || ST.user.department === dept);
}
function canPage(k) { return k === 'setting' ? can(['Admin', 'Engineer']) : true; }
function viewNote(dept) {
  return '<p class="note">โหมดดูอย่างเดียว: ลงข้อมูลได้เฉพาะแผน ' + esc(dept) + ' หรือระดับ Leader ขึ้นไป</p>';
}
function homePage() {
  if (ST.user && ST.user['class'] === 'Operator') {
    var m = { 'Daytime': 'daytime', 'Raw Material': 'rawmat', 'RCY': 'rcy' };
    return m[ST.user.department] || 'calendar';
  }
  return 'calendar';
}

// ---------- เรียก Server ----------
function api(action, payload) {
  var url = window.APP_CONFIG && window.APP_CONFIG.API_URL;
  if (!url || url.indexOf('http') !== 0) return Promise.reject(new Error('ยังไม่ได้ตั้งค่า API_URL ในไฟล์ config.js'));
  return fetch(url, { method: 'POST', body: JSON.stringify({ token: ST.token, action: action, payload: payload || {} }) })
    .then(function (r) { return r.text(); })
    .then(function (t) {
      var res;
      try { res = JSON.parse(t); } catch (e) { throw new Error('Server ตอบกลับไม่ถูกต้อง (ตรวจ URL ใน config.js และสิทธิ์ Anyone)'); }
      if (!res.ok) {
        if (res.error === 'SESSION') { doLogout(); throw new Error('หมดเวลาใช้งาน กรุณา Login ใหม่'); }
        throw new Error(res.error || 'เกิดข้อผิดพลาด');
      }
      return res.data;
    })
    .catch(function (e) {
      if (e && e.name === 'TypeError') throw new Error('เชื่อมต่อ Server ไม่ได้ (ตรวจอินเทอร์เน็ตและ URL)');
      throw e;
    });
}
function getJobs(force) {
  if (ST.jobs && !force) return Promise.resolve(ST.jobs);
  return api('jobs.list').then(function (j) { ST.jobs = j; return j; });
}

// ---------- UI ช่วยเหลือ ----------
function toast(msg, isErr) {
  var t = document.createElement('div');
  t.className = 'toast' + (isErr ? ' err' : '');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3500);
}
function showErr(e) { toast(e && e.message ? e.message : String(e), true); }
function busy(btn, fn) {
  btn.disabled = true;
  var p;
  try { p = Promise.resolve(fn()); } catch (e) { p = Promise.reject(e); }
  return p.catch(showErr).then(function () { btn.disabled = false; });
}
function modal(title, bodyHtml, footHtml) {
  var ov = document.createElement('div');
  ov.className = 'ov';
  ov.innerHTML = '<div class="md"><div class="mh"><b>' + esc(title) + '</b><button type="button" class="x" data-act="close">×</button></div>'
    + '<div class="mb">' + bodyHtml + '</div>'
    + (footHtml ? '<div class="ma">' + footHtml + '</div>' : '') + '</div>';
  document.body.appendChild(ov);
  ov.close = function () { if (ov.parentNode) ov.parentNode.removeChild(ov); };
  return ov;
}
function bindClick(root, handlers) {
  root.onclick = function (e) {
    var t = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!t || !root.contains(t)) return;
    var act = t.getAttribute('data-act');
    if (act === 'close' && root.close) { root.close(); return; }
    var fn = handlers[act];
    if (!fn) return;
    try {
      var r = fn(t, e);
      if (r && r.catch) r.catch(showErr);
    } catch (err) { showErr(err); }
  };
}
function resetHandlers(root) {
  root.onclick = null; root.oninput = null; root.onchange = null;
  root.ondragstart = null; root.ondragover = null; root.ondrop = null;
}
function compressImage(file, maxSize, quality) {
  return new Promise(function (resolve, reject) {
    var img = new Image();
    var url = URL.createObjectURL(file);
    img.onload = function () {
      var r = Math.min(1, maxSize / Math.max(img.width, img.height));
      var c = document.createElement('canvas');
      c.width = Math.round(img.width * r);
      c.height = Math.round(img.height * r);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('อ่านรูปไม่ได้')); };
    img.src = url;
  });
}
function loadPhoto(id, imgEl) {
  if (!imgEl) return;
  if (!PHOTO_CACHE[id]) PHOTO_CACHE[id] = api('photo.get', { id: id });
  PHOTO_CACHE[id].then(function (data) { imgEl.src = data; }).catch(function () { imgEl.alt = 'โหลดรูปไม่สำเร็จ'; });
}

// ---------- Login / Shell ----------
function loadSession() {
  ST.token = store.get('tk') || '';
  try { ST.user = JSON.parse(store.get('us') || 'null'); } catch (e) { ST.user = null; }
}
function doLogout() {
  ST.token = ''; ST.user = null; ST.jobs = null;
  store.del('tk'); store.del('us');
  showLogin();
}
function showLogin() {
  $('app').innerHTML = '<div class="login-box">'
    + '<h2>Factory Tracker</h2>'
    + '<input id="lg-user" placeholder="User ID" autocomplete="username">'
    + '<input id="lg-pw" type="password" placeholder="Password" autocomplete="current-password">'
    + '<button id="lg-btn" class="btn" type="button">เข้าสู่ระบบ</button>'
    + '<div id="lg-status" class="muted">กำลังตรวจสอบการเชื่อมต่อ Server...</div>'
    + '</div>';
  var btn = $('lg-btn'), u = $('lg-user'), pw = $('lg-pw');
  function submit() {
    busy(btn, function () {
      return api('login', { user_id: u.value.trim(), password: pw.value }).then(function (r) {
        ST.token = r.token; ST.user = r.user;
        store.set('tk', r.token); store.set('us', JSON.stringify(r.user));
        go(homePage());
      });
    });
  }
  btn.onclick = submit;
  pw.onkeydown = function (e) { if (e.key === 'Enter') submit(); };
  api('ping').then(function () {
    var s = $('lg-status');
    if (s) { s.className = 'muted st-ok'; s.textContent = '● เชื่อมต่อ Server สำเร็จ'; }
  }).catch(function (e) {
    var s = $('lg-status');
    if (s) { s.className = 'muted st-bad'; s.textContent = '● ' + e.message; }
  });
}
function go(page) {
  if (!ST.token || !ST.user) { showLogin(); return; }
  if (NAV.indexOf(page) < 0 || !canPage(page)) page = 'calendar';
  ST.page = page;
  var nav = '';
  NAV.filter(canPage).forEach(function (k) {
    nav += '<button type="button" class="' + (k === page ? 'on' : '') + '" data-nav="' + k + '">' + esc(NAV_TITLES[k]) + '</button>';
  });
  $('app').innerHTML = '<header id="hdr">' + nav + '<span class="sp"></span>'
    + '<span class="who">' + esc(ST.user.name) + ' (' + esc(ST.user['class']) + ')</span>'
    + '<button type="button" data-act="pw">รหัสผ่าน</button>'
    + '<button type="button" data-act="logout">ออก</button></header><main id="main"></main>';
  $('hdr').onclick = function (e) {
    var t = e.target;
    var k = t.getAttribute('data-nav');
    if (k) { go(k); return; }
    var a = t.getAttribute('data-act');
    if (a === 'logout') doLogout();
    if (a === 'pw') changePw();
  };
  var main = $('main');
  var pg = PAGES[page];
  if (!pg) { main.innerHTML = '<p class="warn">ไม่พบหน้านี้ (ไฟล์ของหน้านี้อาจโหลดไม่สำเร็จ ดูข้อความสีแดงด้านบน)</p>'; return; }
  main.innerHTML = '<p class="muted">กำลังโหลด...</p>';
  try {
    var r = pg.render(main);
    if (r && r.catch) r.catch(function (e) { main.innerHTML = '<p class="warn">' + esc(e.message) + '</p>'; });
  } catch (e) {
    main.innerHTML = '<p class="warn">' + esc(e.message) + '</p>';
  }
}
function changePw() {
  var ov = modal('เปลี่ยนรหัสผ่าน',
    '<div class="fg"><input id="pw-old" type="password" placeholder="รหัสผ่านเดิม"></div>'
    + '<div class="fg"><input id="pw-new" type="password" placeholder="รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)"></div>',
    '<button type="button" class="btn" data-act="save">บันทึก</button>');
  bindClick(ov, {
    save: function (t) {
      return busy(t, function () {
        return api('auth.changePassword', { old: $('pw-old').value, 'new': $('pw-new').value }).then(function () {
          toast('เปลี่ยนรหัสผ่านแล้ว'); ov.close();
        });
      });
    }
  });
}
function startApp() {
  loadSession();
  if (ST.token && ST.user) go(homePage()); else showLogin();
}