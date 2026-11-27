var SHIFTS = ['เช้า', 'บ่าย', 'OT1', 'OT2'];
var RAW_LINES = { MDI: ['Line#1', 'Line#2', 'Line#3'], CE: ['Line#1', 'Line#3'], GA: ['Line#1', 'Line#3'] };
var RCY_LINES = ['Line#1', 'Line#3'];

// ================= Raw Material =================
var RM = { date: '', shift: 'เช้า', rows: [], tpb: 3, data: {}, comment: '', exists: false };

PAGES.rawmat = {
  title: 'Raw Mat Record',
  render: function (main) {
    if (!RM.date) RM.date = todayStr();
    return rmLoad(main);
  }
};

function rmLoad(main) {
  resetHandlers(main);
  main.innerHTML = '<p class="muted">กำลังโหลด...</p>';
  return api('rawmat.day', { date: RM.date }).then(function (r) {
    RM.rows = r.rows;
    RM.tpb = r.tanks_per_batch;
    rmFill();
    rmDraw(main);
  });
}

function rmFill() {
  RM.data = { MDI: {}, CE: {}, GA: {} };
  Object.keys(RAW_LINES).forEach(function (c) {
    RAW_LINES[c].forEach(function (l) { RM.data[c][l] = c === 'MDI' ? [] : ''; });
  });
  RM.comment = '';
  var mine = RM.rows.filter(function (r) { return r.shift === RM.shift; }).sort(function (a, b) { return a.batch_no - b.batch_no; });
  RM.exists = mine.length > 0;
  mine.forEach(function (r) {
    if (r.comment) RM.comment = r.comment;
    var grp = RM.data[r.chemical];
    if (!grp || grp[r.line] === undefined) return;
    if (r.chemical === 'MDI') grp[r.line].push(String(r.tanks));
    else grp[r.line] = String(r.tanks);
  });
}

function rmTotText(arr) {
  var s = 0;
  arr.forEach(function (t) { s += Number(t) || 0; });
  return '· ' + arr.length + ' batch · ' + s + ' ถัง';
}

function rmMdiCard() {
  var h = '<div class="card"><b>MDI</b> <span class="muted">· 1 batch = ' + RM.tpb + ' ถัง (แก้จำนวนได้ถ้าเติมไม่ครบ)</span>';
  RAW_LINES.MDI.forEach(function (line, li) {
    var arr = RM.data.MDI[line];
    h += '<div class="fg"><label>' + esc(line) + ' <span class="muted" id="rm-tot-' + li + '">' + rmTotText(arr) + '</span></label>';
    arr.forEach(function (t, i) {
      h += '<div class="bt"><span>Batch ' + (i + 1) + '</span>'
        + '<input type="number" min="1" step="1" data-k="mdi" data-l="' + esc(line) + '" data-i="' + i + '" value="' + esc(t) + '"> ถัง '
        + '<button type="button" class="btn bad" data-act="delb" data-l="' + esc(line) + '" data-i="' + i + '">×</button></div>';
    });
    h += '<button type="button" class="btn sec" data-act="addb" data-l="' + esc(line) + '">+ เพิ่ม batch</button></div>';
  });
  return h + '</div>';
}

function rmSimpleCard(ch) {
  var h = '<div class="card"><b>' + ch + '</b> <span class="muted">· กรอกจำนวนถังเฉพาะ Line ที่มีการเติม (เว้นว่าง = ไม่เติม)</span>';
  RAW_LINES[ch].forEach(function (line) {
    h += '<div class="bt"><span>' + esc(line) + '</span>'
      + '<input type="number" min="1" step="1" placeholder="ถัง" data-k="simple" data-c="' + ch + '" data-l="' + esc(line) + '" value="' + esc(RM.data[ch][line]) + '"> ถัง</div>';
  });
  return h + '</div>';
}

function rmSumHtml() {
  function pick(ch, line, s) {
    return RM.rows.filter(function (r) { return r.chemical === ch && r.line === line && (!s || r.shift === s); });
  }
  function txt(ch, rs) {
    if (!rs.length) return '-';
    var n = 0;
    rs.forEach(function (r) { n += Number(r.tanks) || 0; });
    return (ch === 'MDI' ? rs.length + ' batch / ' : '') + n + ' ถัง';
  }
  var tr = '';
  Object.keys(RAW_LINES).forEach(function (ch) {
    RAW_LINES[ch].forEach(function (line) {
      tr += '<tr><td>' + esc(ch + ' ' + line) + '</td>';
      SHIFTS.forEach(function (s) { tr += '<td>' + esc(txt(ch, pick(ch, line, s))) + '</td>'; });
      tr += '<td><b>' + esc(txt(ch, pick(ch, line, ''))) + '</b></td></tr>';
    });
  });
  var head = '<th>สาร / Line</th>';
  SHIFTS.forEach(function (s) { head += '<th>' + esc(s) + '</th>'; });
  head += '<th>รวมวัน</th>';
  return '<h4>สรุปของวันที่ ' + esc(thD(RM.date)) + '</h4><div class="tw"><table class="tb sumtb"><thead><tr>' + head + '</tr></thead><tbody>' + tr + '</tbody></table></div>';
}

function rmDraw(main) {
  var rec = canRecord('Raw Material');
  var h = '<h3>Raw Mat Record</h3>';
  h += '<div class="bar"><b>วันที่</b><input type="date" class="w160" data-k="date" value="' + esc(RM.date) + '" max="' + todayStr() + '"></div>';
  h += '<div class="bar">';
  SHIFTS.forEach(function (s) {
    h += '<button type="button" class="btn' + (s === RM.shift ? '' : ' sec') + '" data-act="shift" data-s="' + esc(s) + '">' + esc(s) + '</button>';
  });
  h += '</div>';
  if (!rec) h += viewNote('Raw Material');
  else if (RM.exists) h += '<p class="note">มีข้อมูลของกะนี้แล้ว การบันทึกจะแทนที่ข้อมูลเดิม</p>';
  h += '<fieldset' + (rec ? '' : ' disabled') + '>';
  h += rmMdiCard() + rmSimpleCard('CE') + rmSimpleCard('GA');
  h += '<div class="fg"><label>Comment</label><textarea data-k="comment">' + esc(RM.comment) + '</textarea></div>';
  if (rec) h += '<button type="button" class="btn ok" data-act="save">บันทึกกะ ' + esc(RM.shift) + '</button>';
  h += '</fieldset>' + rmSumHtml();
  main.innerHTML = h;

  bindClick(main, {
    shift: function (t) { RM.shift = t.getAttribute('data-s'); rmFill(); rmDraw(main); },
    addb: function (t) { RM.data.MDI[t.getAttribute('data-l')].push(String(RM.tpb)); rmDraw(main); },
    delb: function (t) { RM.data.MDI[t.getAttribute('data-l')].splice(Number(t.getAttribute('data-i')), 1); rmDraw(main); },
    save: function (t) {
      return busy(t, function () {
        return api('rawmat.save', { date: RM.date, shift: RM.shift, data: RM.data, comment: RM.comment }).then(function () {
          toast('บันทึกกะ ' + RM.shift + ' แล้ว');
          return rmLoad(main);
        });
      });
    }
  });
  main.oninput = function (e) {
    var t = e.target;
    var k = t.getAttribute ? t.getAttribute('data-k') : null;
    if (!k) return;
    if (k === 'mdi') {
      var l = t.getAttribute('data-l');
      RM.data.MDI[l][Number(t.getAttribute('data-i'))] = t.value;
      var el = $('rm-tot-' + RAW_LINES.MDI.indexOf(l));
      if (el) el.textContent = rmTotText(RM.data.MDI[l]);
    } else if (k === 'simple') {
      RM.data[t.getAttribute('data-c')][t.getAttribute('data-l')] = t.value;
    } else if (k === 'comment') {
      RM.comment = t.value;
    }
  };
  main.onchange = function (e) {
    var t = e.target;
    if (t.getAttribute && t.getAttribute('data-k') === 'date' && t.value) {
      RM.date = t.value;
      rmLoad(main).catch(showErr);
    }
  };
}

// ================= RCY =================
var RC = { date: '', line: 'Line#1', kg: 450, steps: [], comment: '', exists: false, recent: [] };

PAGES.rcy = {
  title: 'RCY Record',
  render: function (main) {
    if (!RC.date) RC.date = todayStr();
    return rcLoad(main);
  }
};

function rcLoad(main) {
  resetHandlers(main);
  main.innerHTML = '<p class="muted">กำลังโหลด...</p>';
  return Promise.all([api('rcy.get', { date: RC.date, line: RC.line }), api('rcy.recent')]).then(function (res) {
    var r = res[0];
    RC.kg = r.kg_per_batch;
    RC.exists = !!r.record;
    RC.comment = r.record ? r.record.comment : '';
    RC.steps = r.steps.map(function (s) {
      return { step: s.step, batch_no: s.batch_no ? String(s.batch_no) : '', qty_kg: s.qty_kg === '' ? '' : String(s.qty_kg) };
    });
    RC.recent = res[1];
    rcDraw(main);
  });
}

function rcNextNo() {
  var m = 0;
  RC.steps.forEach(function (s) { m = Math.max(m, Number(s.batch_no) || 0); });
  return m + 1;
}
// เลข batch ของ Cut ล่าสุดที่ยังไม่มี Mix ตามหลังในวันนี้ (ถ้าไม่มี = เว้นว่าง)
function rcOpenBatch() {
  for (var i = RC.steps.length - 1; i >= 0; i--) {
    var s = RC.steps[i];
    if (s.step === 'Cut' && s.batch_no) {
      var closed = false;
      for (var j = i + 1; j < RC.steps.length; j++) {
        if (RC.steps[j].step === 'Mix' && String(RC.steps[j].batch_no) === String(s.batch_no)) closed = true;
      }
      if (!closed) return String(s.batch_no);
    }
  }
  return '';
}
function rcInfoUpdate() {
  var names = [], cutN = 0, cutKg = 0, mixN = 0, mixKg = 0;
  RC.steps.forEach(function (s) {
    names.push(s.step);
    var q = Number(s.qty_kg) || 0;
    if (s.step === 'Cut') { cutN++; cutKg += q; }
    else if (s.step === 'Mix') { mixN++; mixKg += q; }
  });
  var c = $('rc-chain'), i = $('rc-info');
  if (c) c.textContent = RC.line + ': ' + (names.join(' ⇒ ') || '-');
  if (i) i.textContent = ' · Cut ' + cutN + ' batch / ' + cutKg + ' kg · Mix ' + mixN + ' batch / ' + mixKg + ' kg';
}
function rcCell(n, kg) { return n ? n + ' batch / ' + kg + ' kg' : '-'; }

function rcDraw(main) {
  var rec = canRecord('RCY');
  var h = '<h3>RCY Record</h3>';
  h += '<div class="bar"><b>วันที่</b><input type="date" class="w160" data-k="date" value="' + esc(RC.date) + '" max="' + todayStr() + '">'
    + '<b>Line</b><select class="w160" data-k="line">' + optHtml(RCY_LINES, RC.line) + '</select></div>';
  if (!rec) h += viewNote('RCY');
  else if (RC.exists) h += '<p class="note">มีข้อมูลของวันนี้และ Line นี้แล้ว การบันทึกจะแทนที่ข้อมูลเดิม</p>';
  h += '<fieldset' + (rec ? '' : ' disabled') + '><div class="card"><div><b id="rc-chain"></b><span class="muted" id="rc-info"></span></div>';
  h += '<p class="muted">ลง Cut อย่างเดียว Mix อย่างเดียว หรือทั้งสองอย่างก็ได้ · ค่าเริ่มต้น ' + RC.kg
    + ' kg ต่อ batch · Mix ของที่ Cut ไว้วันก่อน ให้เว้นเลข batch ได้</p>';
  RC.steps.forEach(function (s, i) {
    h += '<div class="rs"><b>' + (i + 1) + '.</b>'
      + '<select data-k="step" data-i="' + i + '">' + optHtml(['Cut', 'Mix'], s.step) + '</select>'
      + '<input type="number" min="1" step="1" placeholder="batch # (เว้นได้)" data-k="batch" data-i="' + i + '" value="' + esc(s.batch_no) + '">'
      + '<input type="number" min="0" step="any" placeholder="kg" data-k="qty" data-i="' + i + '" value="' + esc(s.qty_kg) + '"> kg '
      + '<button type="button" class="btn sec" data-act="up" data-i="' + i + '">↑</button>'
      + '<button type="button" class="btn sec" data-act="down" data-i="' + i + '">↓</button>'
      + '<button type="button" class="btn bad" data-act="del" data-i="' + i + '">×</button></div>';
  });
  h += '<div class="bar"><button type="button" class="btn" data-act="addcut">+ Cut</button>'
    + '<button type="button" class="btn" data-act="addmix">+ Mix</button>'
    + '<button type="button" class="btn sec" data-act="addbatch">+ Cut และ Mix คู่กัน</button></div>';
  h += '<div class="fg"><label>Comment</label><textarea data-k="comment">' + esc(RC.comment) + '</textarea></div>';
  if (rec) h += '<button type="button" class="btn ok" data-act="save">บันทึก</button>';
  h += '</div></fieldset>';

  h += '<h4>บันทึกล่าสุด (กดเพื่อเปิด' + (rec ? '/แก้ไข' : '') + ')</h4>';
  var tr = '';
  RC.recent.forEach(function (r) {
    tr += '<tr class="click" data-act="loadrec" data-d="' + esc(r.date) + '" data-l="' + esc(r.line) + '"><td>' + esc(thD(r.date)) + '</td><td>' + esc(r.line)
      + '</td><td>' + esc(r.chain) + '</td><td>' + esc(rcCell(r.cut_n, r.cut_kg)) + '</td><td>' + esc(rcCell(r.mix_n, r.mix_kg))
      + '</td><td>' + esc(r.operator) + '</td></tr>';
  });
  h += RC.recent.length
    ? '<div class="tw"><table class="tb"><thead><tr><th>วันที่</th><th>Line</th><th>ลำดับงาน</th><th>Cut</th><th>Mix</th><th>ผู้บันทึก</th></tr></thead><tbody>' + tr + '</tbody></table></div>'
    : '<p class="muted">ยังไม่มีข้อมูล</p>';
  main.innerHTML = h;
  rcInfoUpdate();

  function swap(i, j) { var t = RC.steps[i]; RC.steps[i] = RC.steps[j]; RC.steps[j] = t; rcDraw(main); }
  bindClick(main, {
    up: function (t) { var i = Number(t.getAttribute('data-i')); if (i > 0) swap(i, i - 1); },
    down: function (t) { var i = Number(t.getAttribute('data-i')); if (i < RC.steps.length - 1) swap(i, i + 1); },
    del: function (t) { RC.steps.splice(Number(t.getAttribute('data-i')), 1); rcDraw(main); },
    addcut: function () {
      RC.steps.push({ step: 'Cut', batch_no: String(rcNextNo()), qty_kg: String(RC.kg) });
      rcDraw(main);
    },
    addmix: function () {
      RC.steps.push({ step: 'Mix', batch_no: rcOpenBatch(), qty_kg: String(RC.kg) });
      rcDraw(main);
    },
    addbatch: function () {
      var n = String(rcNextNo());
      RC.steps.push({ step: 'Cut', batch_no: n, qty_kg: String(RC.kg) }, { step: 'Mix', batch_no: n, qty_kg: String(RC.kg) });
      rcDraw(main);
    },
    loadrec: function (t) { RC.date = t.getAttribute('data-d'); RC.line = t.getAttribute('data-l'); return rcLoad(main); },
    save: function (t) {
      return busy(t, function () {
        return api('rcy.save', { date: RC.date, line: RC.line, comment: RC.comment, steps: RC.steps }).then(function () {
          toast('บันทึกแล้ว');
          return rcLoad(main);
        });
      });
    }
  });
  main.oninput = function (e) {
    var t = e.target;
    var k = t.getAttribute ? t.getAttribute('data-k') : null;
    if (!k) return;
    var s = RC.steps[Number(t.getAttribute('data-i'))];
    if (k === 'batch' && s) { s.batch_no = t.value; rcInfoUpdate(); }
    else if (k === 'qty' && s) { s.qty_kg = t.value; rcInfoUpdate(); }
    else if (k === 'comment') RC.comment = t.value;
  };
  main.onchange = function (e) {
    var t = e.target;
    var k = t.getAttribute ? t.getAttribute('data-k') : null;
    if (k === 'step') {
      var s = RC.steps[Number(t.getAttribute('data-i'))];
      if (s) { s.step = t.value; rcInfoUpdate(); }
    } else if (k === 'date' && t.value) {
      RC.date = t.value; rcLoad(main).catch(showErr);
    } else if (k === 'line') {
      RC.line = t.value; rcLoad(main).catch(showErr);
    }
  };
}
