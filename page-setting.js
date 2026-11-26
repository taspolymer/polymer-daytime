var SET = { tab: '' };
var JE = null;

PAGES.setting = {
  title: 'Setting',
  render: function (main) {
    var tabs = [];
    if (can(['Admin'])) { tabs.push(['users', 'ผู้ใช้']); tabs.push(['defaults', 'ค่าเริ่มต้น']); }
    if (can(['Admin', 'Engineer'])) tabs.push(['jobs', 'Job master']);
    if (!tabs.length) { main.innerHTML = '<p class="warn">ไม่มีสิทธิ์ใช้งานหน้านี้</p>'; return; }
    if (!tabs.some(function (t) { return t[0] === SET.tab; })) SET.tab = tabs[0][0];
    resetHandlers(main);
    var bar = '<div class="bar">';
    tabs.forEach(function (t) { bar += '<button type="button" class="btn' + (t[0] === SET.tab ? '' : ' sec') + '" data-act="tab" data-t="' + t[0] + '">' + t[1] + '</button>'; });
    bar += '</div>';
    main.innerHTML = '<h3>Setting</h3>' + bar + '<div id="set-body"><p class="muted">กำลังโหลด...</p></div>';
    bindClick(main, { tab: function (t) { SET.tab = t.getAttribute('data-t'); return PAGES.setting.render(main); } });
    var body = $('set-body');
    var fn = SET.tab === 'users' ? setUsers : (SET.tab === 'defaults' ? setDefaults : setJobs);
    return fn(body);
  }
};

// ---------- ผู้ใช้ ----------
function setUsers(body) {
  return api('users.list').then(function (list) {
    var map = {}, tr = '';
    list.forEach(function (u) {
      map[u.user_id] = u;
      tr += '<tr class="click" data-act="edit" data-id="' + esc(u.user_id) + '"><td>' + esc(u.user_id) + '</td><td>' + esc(u.name) + '</td><td>' + esc(u['class'])
        + '</td><td>' + esc(u.department) + '</td><td>' + (u.active ? 'ใช้งาน' : 'ปิด') + '</td></tr>';
    });
    body.innerHTML = '<div class="bar"><button type="button" class="btn" data-act="new">+ เพิ่มผู้ใช้</button></div>'
      + '<div class="tw"><table class="tb"><thead><tr><th>ID</th><th>ชื่อ</th><th>Class</th><th>แผนก</th><th>สถานะ</th></tr></thead><tbody>' + tr + '</tbody></table></div>';
    function refresh() { setUsers(body).catch(showErr); }
    bindClick(body, {
      'new': function () { openUserForm(null, refresh); },
      edit: function (t) { openUserForm(map[t.getAttribute('data-id')], refresh); }
    });
  });
}

function openUserForm(u, after) {
  var f = u || { user_id: '', name: '', 'class': 'Operator', department: 'Daytime', active: true };
  var h = '<div class="fg"><label>User ID</label><input id="u-id" value="' + esc(f.user_id) + '"' + (u ? ' disabled' : '') + '></div>'
    + '<div class="fg"><label>ชื่อ</label><input id="u-name" value="' + esc(f.name) + '"></div>'
    + '<div class="fg"><label>Class</label><select id="u-class">' + optHtml(CLASSES, f['class']) + '</select></div>'
    + '<div class="fg"><label>แผนก</label><select id="u-dept">' + optHtml(DEPTS, f.department) + '</select></div>'
    + '<div class="fg"><label>รหัสผ่าน</label><input id="u-pw" type="password" placeholder="' + (u ? 'เว้นว่าง = ไม่เปลี่ยน' : 'อย่างน้อย 6 ตัว') + '"></div>'
    + '<label class="chk"><input type="checkbox" id="u-active"' + (f.active ? ' checked' : '') + '> เปิดใช้งาน</label>';
  var ov = modal(u ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้', h, '<button type="button" class="btn" data-act="save">บันทึก</button>');
  bindClick(ov, {
    save: function (t) {
      var data = { user_id: $('u-id').value.trim(), name: $('u-name').value, 'class': $('u-class').value, department: $('u-dept').value,
        password: $('u-pw').value, active: $('u-active').checked };
      return busy(t, function () {
        return api('users.save', data).then(function () { ov.close(); toast('บันทึกแล้ว'); after(); });
      });
    }
  });
}

// ---------- ค่าเริ่มต้น ----------
function setDefaults(body) {
  return api('settings.get').then(function (s) {
    body.innerHTML = '<div class="card"><div class="fg"><label>MDI: จำนวนถังต่อ 1 batch</label><input type="number" min="1" step="1" id="df-tank" value="' + esc(s.tanks_per_batch) + '"></div>'
      + '<div class="fg"><label>RCY: น้ำหนัก (kg) ต่อ 1 batch</label><input type="number" min="1" step="any" id="df-kg" value="' + esc(s.rcy_kg_per_batch) + '"></div>'
      + '<button type="button" class="btn ok" data-act="save">บันทึก</button></div>';
    bindClick(body, {
      save: function (t) {
        return busy(t, function () {
          return api('settings.save', { tanks_per_batch: $('df-tank').value, rcy_kg_per_batch: $('df-kg').value }).then(function () { toast('บันทึกแล้ว'); });
        });
      }
    });
  });
}

// ---------- Job master ----------
function freqText(j) {
  if (j.frequency_type === 'NONE') return 'รายครั้ง';
  if (j.frequency_type === 'EVERY_N_DAYS') return 'ทุก ' + j.frequency_value + ' วัน';
  return 'วัน ' + j.frequency_value;
}

function setJobs(body) {
  return getJobs(true).then(function (jobs) {
    var map = {}, tr = '';
    jobs.forEach(function (j) {
      map[j.job_id] = j;
      tr += '<tr class="click" data-act="edit" data-id="' + esc(j.job_id) + '"><td>' + esc(j.line) + '</td><td>' + esc(j.machine) + '</td><td>' + esc(j.job_name)
        + '</td><td>' + esc(freqText(j)) + '</td><td>' + (j.lifetime_days ? j.lifetime_days + ' วัน' : '-') + '</td><td>' + esc(j.photo_mode) + '</td><td>' + (j.active ? 'ใช้งาน' : 'ปิด') + '</td></tr>';
    });
    body.innerHTML = '<div class="bar"><button type="button" class="btn" data-act="new">+ สร้างงาน</button></div>'
      + '<div class="tw"><table class="tb"><thead><tr><th>Line</th><th>Machine</th><th>งาน</th><th>ความถี่</th><th>Lifetime</th><th>รูป</th><th>สถานะ</th></tr></thead><tbody>' + tr + '</tbody></table></div>';
    function refresh() { setJobs(body).catch(showErr); }
    bindClick(body, {
      'new': function () { openJobForm(null, jobs, refresh); },
      edit: function (t) { openJobForm(map[t.getAttribute('data-id')], jobs, refresh); }
    });
  });
}

function jeDrawFreq() {
  var life = $('je-life'), box = $('je-freq');
  if (!life || !box) return;
  life.style.display = JE.frequency_type === 'NONE' ? 'none' : '';
  if (JE.frequency_type === 'NONE') {
    box.innerHTML = '<p class="muted">งานรายครั้ง: ไม่มีรอบและ Lifetime ระบบไม่เสนอในแผนอัตโนมัติ เพิ่มได้จากปุ่ม Manual หรือ "+ เพิ่มงานเอง" ในโหมดวางแผน</p>';
  } else if (JE.frequency_type === 'EVERY_N_DAYS') {
    box.innerHTML = '<div class="fg"><label>ทุกกี่วัน</label><input type="number" min="1" data-k="frequency_value" value="' + esc(JE.frequency_value) + '"></div>';
  } else {
    var cur = String(JE.frequency_value).split(',');
    var names = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
    var h = '<div class="fg"><label>วันในสัปดาห์</label><div class="bar">';
    for (var i = 0; i < 7; i++) {
      h += '<label class="chk nomb"><input type="checkbox" data-wd="' + (i + 1) + '"' + (cur.indexOf(String(i + 1)) >= 0 ? ' checked' : '') + '> ' + names[i] + '</label>';
    }
    box.innerHTML = h + '</div></div>';
  }
}

function jeDrawFields() {
  var box = $('je-fields');
  if (!box) return;
  var h = '';
  var types = [['text', 'ข้อความ'], ['number', 'ตัวเลข'], ['checkbox', 'ติ๊ก'], ['dropdown', 'ตัวเลือก'], ['photo', 'รูป']];
  JE.fields.forEach(function (f, i) {
    h += '<div class="frow">'
      + '<input data-fk="label" data-i="' + i + '" placeholder="หัวข้อ ' + (i + 1) + '" value="' + esc(f.label) + '">'
      + '<select data-fk="type" data-i="' + i + '">' + optHtml(types, f.type) + '</select>'
      + (f.type === 'dropdown'
        ? '<input data-fk="options" data-i="' + i + '" placeholder="ตัวเลือก คั่นด้วย ," value="' + esc(f.options || '') + '">'
        : '<input data-fk="unit" data-i="' + i + '" placeholder="หน่วย (kg, ลิตร)" value="' + esc(f.unit || '') + '">')
      + '<label class="chk nomb"><input type="checkbox" data-fk="required" data-i="' + i + '"' + (f.required ? ' checked' : '') + '> บังคับ</label>'
      + '<span class="nowrap"><button type="button" class="btn sec" data-act="fup" data-i="' + i + '">↑</button> '
      + '<button type="button" class="btn sec" data-act="fdown" data-i="' + i + '">↓</button> '
      + '<button type="button" class="btn bad" data-act="fdel" data-i="' + i + '">×</button></span></div>';
  });
  box.innerHTML = h;
}

function jeUpdate(t, isChange) {
  var isSel = t.tagName === 'SELECT' || t.type === 'checkbox';
  if (isSel && !isChange) return;
  var fk = t.getAttribute('data-fk');
  if (fk) {
    var f = JE.fields[Number(t.getAttribute('data-i'))];
    if (!f) return;
    if (fk === 'required') f.required = t.checked; else f[fk] = t.value;
    if (fk === 'type') jeDrawFields();
    return;
  }
  if (t.getAttribute('data-wd')) {
    var boxes = document.querySelectorAll('#je-freq [data-wd]'), vals = [];
    for (var j = 0; j < boxes.length; j++) { if (boxes[j].checked) vals.push(boxes[j].getAttribute('data-wd')); }
    JE.frequency_value = vals.join(',');
    return;
  }
  var k = t.getAttribute('data-k');
  if (!k) return;
  if (k === 'active') JE.active = t.checked; else JE[k] = t.value;
  if (k === 'frequency_type') {
    JE.frequency_value = t.value === 'WEEKDAY' ? '1' : (t.value === 'NONE' ? '' : '15');
    jeDrawFreq();
  }
}

function openJobForm(job, jobs, after) {
  JE = job ? JSON.parse(JSON.stringify(job)) : { line: 'Line#1', machine: '', job_name: '', job_detail: '', frequency_type: 'EVERY_N_DAYS', frequency_value: '15', lifetime_days: 30, photo_mode: 'BEFORE_AFTER', active: true, fields: [] };
  if (!(Number(JE.lifetime_days) > 0)) JE.lifetime_days = 30;
  var lineList = LINES.indexOf(JE.line) >= 0 ? LINES : LINES.concat([JE.line]);
  var machines = uniq(jobs.map(function (x) { return x.machine; }));
  var dl = machines.map(function (m) { return '<option value="' + esc(m) + '">'; }).join('');
  var h = '<div class="row2"><div class="fg"><label>Line</label><select data-k="line">' + optHtml(lineList, JE.line) + '</select></div>'
    + '<div class="fg"><label>Machine</label><input data-k="machine" list="machine-list" autocomplete="off" value="' + esc(JE.machine) + '"><datalist id="machine-list">' + dl + '</datalist></div></div>'
    + '<div class="fg"><label>Job name</label><input data-k="job_name" value="' + esc(JE.job_name) + '"></div>'
    + '<div class="fg"><label>Job detail</label><textarea data-k="job_detail">' + esc(JE.job_detail) + '</textarea></div>'
    + '<div class="fg"><label>Frequency</label><select data-k="frequency_type">'
    + optHtml([['EVERY_N_DAYS', 'ทุก N วัน'], ['WEEKDAY', 'ทุกวันของสัปดาห์'], ['NONE', 'ไม่มี (ทำตามเหตุการณ์ / ระบุรายครั้ง)']], JE.frequency_type) + '</select></div>'
    + '<div id="je-freq"></div>'
    + '<div class="fg" id="je-life"><label>Lifetime (วัน)</label><input type="number" min="1" data-k="lifetime_days" value="' + esc(JE.lifetime_days) + '"></div>'
    + '<div class="fg"><label>รูปภาพ</label><select data-k="photo_mode">' + optHtml([['BEFORE_AFTER', 'ก่อน-หลัง'], ['SINGLE', 'รูปเดียว'], ['NONE', 'ไม่ต้องมีรูป']], JE.photo_mode) + '</select></div>'
    + '<h4>หัวข้อที่ต้องบันทึก</h4><div id="je-fields"></div>'
    + '<button type="button" class="btn sec" data-act="addfield">+ เพิ่มหัวข้อ</button>'
    + '<label class="chk" style="margin-top:10px"><input type="checkbox" data-k="active"' + (JE.active ? ' checked' : '') + '> เปิดใช้งาน</label>';
  var ov = modal(job ? 'แก้ไขงาน' : 'สร้างงาน', h, '<button type="button" class="btn" data-act="save">บันทึก</button>');
  jeDrawFreq();
  jeDrawFields();
  bindClick(ov, {
    addfield: function () { JE.fields.push({ label: '', type: 'text', unit: '', options: '', required: false }); jeDrawFields(); },
    fup: function (t) {
      var i = Number(t.getAttribute('data-i'));
      if (i > 0) { var x = JE.fields[i - 1]; JE.fields[i - 1] = JE.fields[i]; JE.fields[i] = x; jeDrawFields(); }
    },
    fdown: function (t) {
      var i = Number(t.getAttribute('data-i'));
      if (i < JE.fields.length - 1) { var x = JE.fields[i + 1]; JE.fields[i + 1] = JE.fields[i]; JE.fields[i] = x; jeDrawFields(); }
    },
    fdel: function (t) { JE.fields.splice(Number(t.getAttribute('data-i')), 1); jeDrawFields(); },
    save: function (t) {
      return busy(t, function () {
        return api('jobs.save', JE).then(function () { ov.close(); toast('บันทึกแล้ว'); after(); });
      });
    }
  });
  ov.oninput = function (e) { jeUpdate(e.target, false); };
  ov.onchange = function (e) { jeUpdate(e.target, true); };
}