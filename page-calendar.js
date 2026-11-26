var CAL = { month: todayStr().slice(0, 7), mode: 'view', step: 1, work: [], others: [], loaded: false };

PAGES.calendar = {
  title: 'ปฏิทิน',
  render: function (main) {
    if (CAL.mode === 'plan') return renderPlan(main);
    return renderCalView(main);
  }
};

function planState(p, today) {
  if (p.status === 'DRAFT') return 'draft';
  if (p.status === 'CONFIRMED') return p.planned_date < today ? 'overdue' : 'planned';
  return p.review === 'APPROVED' ? 'approved' : 'pending';
}
function shortName(x) { return (x.line ? x.line + ' ' : '') + x.job_name; }

function calGrid(ym, byDate, chipFn) {
  var a = ym.split('-').map(Number);
  var off = (new Date(Date.UTC(a[0], a[1] - 1, 1)).getUTCDay() + 6) % 7;
  var days = new Date(Date.UTC(a[0], a[1], 0)).getUTCDate();
  var names = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
  var h = '<div class="cal">';
  var i;
  for (i = 0; i < 7; i++) h += '<div class="dh' + (i > 4 ? ' we' : '') + '">' + names[i] + '</div>';
  for (i = 0; i < off; i++) h += '<div class="dc empty"></div>';
  for (var d = 1; d <= days; d++) {
    var ds = ym + '-' + pad(d), wd = (off + d - 1) % 7;
    var cls = 'dc' + (wd > 4 ? ' we' : '') + (ds === todayStr() ? ' today' : '');
    h += '<div class="' + cls + '" data-date="' + ds + '"><div class="dn">' + d + '</div>';
    var list = byDate[ds] || [];
    for (var k = 0; k < list.length; k++) h += chipFn(list[k]);
    h += '</div>';
  }
  return h + '</div>';
}

// ---------- มุมมองปฏิทิน ----------
function renderCalView(main) {
  resetHandlers(main);
  main.innerHTML = '<p class="muted">กำลังโหลด...</p>';
  return api('plan.month', { month: CAL.month }).then(function (r) {
    var by = {}, map = {};
    r.plans.forEach(function (p) {
      map[p.plan_id] = p;
      if (!by[p.planned_date]) by[p.planned_date] = [];
      by[p.planned_date].push(p);
    });
    var grid = calGrid(CAL.month, by, function (p) {
      return '<div class="chip st-' + planState(p, r.today) + '" data-act="plan" data-id="' + esc(p.plan_id) + '">'
        + (String(p.is_manual) === '1' ? '✋ ' : '') + esc(shortName(p)) + '</div>';
    });
    var planBtn = can(LEADER_UP) ? '<button type="button" class="btn" data-act="planmode">โหมดวางแผน</button>' : '';
    main.innerHTML = '<div class="bar"><button type="button" class="btn sec" data-act="prev">◀</button>'
      + '<b>' + esc(monthTitle(CAL.month)) + '</b>'
      + '<button type="button" class="btn sec" data-act="next">▶</button><span class="sp"></span>' + planBtn + '</div>'
      + '<div class="legend muted"><span>🟦 ตามแผน</span><span>🟨 รอตรวจ</span><span>🟩 อนุมัติ</span><span>🟥 เลยกำหนด</span><span>⬜ ร่าง</span></div>'
      + grid;
    bindClick(main, {
      prev: function () { CAL.month = shiftMonth(CAL.month, -1); return renderCalView(main); },
      next: function () { CAL.month = shiftMonth(CAL.month, 1); return renderCalView(main); },
      planmode: function () { CAL.mode = 'plan'; CAL.step = 1; CAL.loaded = false; return renderPlan(main); },
      plan: function (t) { showPlanInfo(map[t.getAttribute('data-id')], function () { renderCalView(main).catch(showErr); }); }
    });
  });
}

function showPlanInfo(p, after) {
  if (!p) return;
  var body = '<p><b>' + esc(jobLabel(p)) + '</b></p><p class="muted">' + esc(p.job_detail || '') + '</p><p>วันที่: ' + esc(thD(p.planned_date)) + '</p>';
  if (p.shifted_reason) body += '<p class="note">' + esc(p.shifted_reason) + '</p>';
  if (p.last_done) body += '<p class="muted">ทำล่าสุด ' + esc(thD(p.last_done)) + '</p>';
  if (String(p.is_manual) === '1') body += '<p><span class="tag">งาน Manual</span></p>';
  if (p.early_reason) body += '<p class="warn">ทำก่อนกำหนด: ' + esc(p.early_reason) + '</p>';
  var foot = (can(LEADER_UP) && p.status !== 'DONE') ? '<button type="button" class="btn bad" data-act="del">ลบออกจากแผน</button>' : '';
  var ov = modal('รายละเอียดงาน', body, foot);
  bindClick(ov, {
    del: function (t) {
      if (!confirm('ยกเลิกงานนี้ออกจากแผน?')) return;
      return busy(t, function () {
        return api('plan.cancel', { plan_id: p.plan_id }).then(function () { ov.close(); after(); });
      });
    }
  });
}

// ---------- โหมดวางแผน ----------
function planWarns(x) {
  var w = [];
  if (x.shifted_reason) w.push({ cls: 'note', text: 'ℹ ' + x.shifted_reason });
  if (isWE(x.planned_date)) w.push({ cls: 'warn', text: '⚠ ตรงวันเสาร์/อาทิตย์' });
  if (x.lifetime_deadline && x.planned_date > x.lifetime_deadline) w.push({ cls: 'warn', text: '⚠ เกินกำหนด Lifetime (ครบ ' + thD(x.lifetime_deadline) + ')' });
  if (x.planned_date < todayStr()) w.push({ cls: 'warn', text: '⚠ เลยกำหนดแล้ว' });
  return w;
}
function warnHtml(x) {
  return planWarns(x).map(function (w) { return '<div class="' + w.cls + '">' + esc(w.text) + '</div>'; }).join('');
}
function hasWarn(x) { return planWarns(x).some(function (w) { return w.cls === 'warn'; }); }
function chosen() { return CAL.work.filter(function (x) { return x.include; }); }

function renderPlan(main) {
  var range = monthRange(CAL.month);
  var ready = Promise.resolve();
  if (!CAL.loaded) {
    resetHandlers(main);
    main.innerHTML = '<p class="muted">กำลังคำนวณรายการงาน...</p>';
    ready = api('plan.suggest', { from: range.from, to: range.to }).then(function (r) {
      CAL.work = r.drafts.concat(r.items).map(function (x) { x.include = true; return x; });
      CAL.others = r.others;
      CAL.loaded = true;
    });
  }
  return ready.then(function () { drawPlan(main); });
}

function drawPlan(main) {
  var titles = ['1 รายการงาน', '2 จัดลงปฏิทิน', '3 ยืนยัน'];
  var sh = '<div class="steps">';
  for (var i = 0; i < 3; i++) sh += '<div class="step' + (CAL.step === i + 1 ? ' on' : '') + '">' + titles[i] + '</div>';
  sh += '</div>';
  var body = CAL.step === 1 ? planStep1() : (CAL.step === 2 ? planStep2() : planStep3());
  main.innerHTML = '<div class="bar"><b>โหมดวางแผน · ' + esc(monthTitle(CAL.month)) + '</b><span class="sp"></span>'
    + '<button type="button" class="btn sec" data-act="exit">ออก</button></div>' + sh + body;
  bindPlan(main);
}

function planStep1() {
  var rows = '';
  CAL.work.forEach(function (x, i) {
    rows += '<tr><td><input type="checkbox" data-k="inc" data-i="' + i + '"' + (x.include ? ' checked' : '') + '></td>'
      + '<td>' + esc(jobLabel(x)) + (x.plan_id ? '<span class="tag">ร่างเดิม</span>' : '') + (x.adhoc ? '<span class="tag">เพิ่มเอง</span>' : '') + '</td>'
      + '<td>' + (x.last_done ? esc(thD(x.last_done)) : '-') + '</td>'
      + '<td><input type="date" data-k="date" data-i="' + i + '" value="' + esc(x.planned_date) + '"></td>'
      + '<td>' + warnHtml(x) + '</td></tr>';
  });
  var table = CAL.work.length
    ? '<div class="tw"><table class="tb"><thead><tr><th>เลือก</th><th>งาน</th><th>ทำล่าสุด</th><th>วันที่วางแผน</th><th>หมายเหตุ</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
    : '<p class="muted">ไม่มีงานที่ต้องวางแผนในเดือนนี้</p>';
  return '<div class="bar"><button type="button" class="btn sec" data-act="adhoc">+ เพิ่มงานเอง (งานรายครั้ง)</button></div>' + table
    + '<div class="ma"><button type="button" class="btn" data-act="to2">ถัดไป: จัดลงปฏิทิน ▶</button></div>';
}

function planStep2() {
  var by = {};
  CAL.others.forEach(function (p) {
    if (!by[p.planned_date]) by[p.planned_date] = [];
    by[p.planned_date].push({ o: p });
  });
  CAL.work.forEach(function (x, i) {
    if (!x.include) return;
    if (!by[x.planned_date]) by[x.planned_date] = [];
    by[x.planned_date].push({ w: x, i: i });
  });
  var grid = calGrid(CAL.month, by, function (e) {
    if (e.o) return '<div class="chip st-planned dim">' + esc(shortName(e.o)) + '</div>';
    return '<div class="chip st-draft" draggable="true" data-wi="' + e.i + '" data-act="editwork">' + (hasWarn(e.w) ? '⚠ ' : '') + esc(shortName(e.w)) + '</div>';
  });
  var range = monthRange(CAL.month);
  var out = chosen().filter(function (x) { return x.planned_date < range.from || x.planned_date > range.to; });
  var outHtml = '';
  if (out.length) {
    outHtml = '<div class="card"><b>งานนอกเดือนนี้</b>';
    out.forEach(function (x) { outHtml += '<div>' + esc(thD(x.planned_date) + ' · ' + jobLabel(x)) + '</div>'; });
    outHtml += '</div>';
  }
  return '<p class="muted">ลากงานไปวางวันอื่น หรือแตะที่งานเพื่อเลือกวันที่ (⚠ = มีคำเตือน)</p>' + grid + outHtml
    + '<div class="ma"><button type="button" class="btn sec" data-act="to1">◀ กลับ</button><button type="button" class="btn" data-act="to3">ถัดไป: ยืนยัน ▶</button></div>';
}

function planStep3() {
  var items = chosen().sort(function (a, b) { return a.planned_date.localeCompare(b.planned_date); });
  var rows = '';
  items.forEach(function (x) {
    rows += '<tr><td>' + esc(thD(x.planned_date)) + '</td><td>' + esc(jobLabel(x)) + '</td><td>' + warnHtml(x) + '</td></tr>';
  });
  return '<p>ทั้งหมด ' + items.length + ' งาน</p>'
    + '<div class="tw"><table class="tb"><thead><tr><th>วันที่</th><th>งาน</th><th>หมายเหตุ</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
    + '<div class="ma"><button type="button" class="btn sec" data-act="to2">◀ กลับ</button>'
    + '<button type="button" class="btn sec" data-act="savedraft">บันทึกร่าง</button>'
    + '<button type="button" class="btn ok" data-act="doconfirm">ยืนยันแผน</button></div>';
}

function planPayload() {
  var range = monthRange(CAL.month);
  var items = chosen().map(function (x) {
    return { job_id: x.job_id, planned_date: x.planned_date, original_date: x.original_date, shifted_reason: x.shifted_reason || '' };
  });
  return { from: range.from, to: range.to, items: items };
}

function bindPlan(main) {
  bindClick(main, {
    exit: function () {
      if (!confirm('ออกจากโหมดวางแผน? (ข้อมูลที่ยังไม่บันทึกจะหาย)')) return;
      CAL.mode = 'view';
      return renderCalView(main);
    },
    adhoc: function () { return openAdhoc(main); },
    to1: function () { CAL.step = 1; drawPlan(main); },
    to2: function () {
      if (!chosen().length) { toast('ยังไม่ได้เลือกงาน', true); return; }
      CAL.step = 2; drawPlan(main);
    },
    to3: function () { CAL.step = 3; drawPlan(main); },
    editwork: function (t) { openEditDate(main, Number(t.getAttribute('data-wi'))); },
    savedraft: function (t) {
      return busy(t, function () {
        return api('plan.saveDraft', planPayload()).then(function () { toast('บันทึกร่างแล้ว'); });
      });
    },
    doconfirm: function (t) {
      var items = chosen();
      var n = items.filter(hasWarn).length;
      if (!confirm('ยืนยันแผน ' + items.length + ' งาน' + (n ? ' (มี ' + n + ' งานที่มีคำเตือน)' : '') + ' ?')) return;
      return busy(t, function () {
        return api('plan.saveDraft', planPayload()).then(function (ids) {
          return api('plan.confirm', { ids: ids });
        }).then(function () {
          toast('ยืนยันแผนแล้ว');
          CAL.mode = 'view';
          return renderCalView(main);
        });
      });
    }
  });
  main.onchange = function (e) {
    var t = e.target;
    var k = t.getAttribute ? t.getAttribute('data-k') : null;
    if (!k) return;
    var x = CAL.work[Number(t.getAttribute('data-i'))];
    if (!x) return;
    if (k === 'inc') x.include = t.checked;
    if (k === 'date' && t.value) { x.planned_date = t.value; drawPlan(main); }
  };
  main.ondragstart = function (e) {
    var t = e.target.closest ? e.target.closest('[data-wi]') : null;
    if (t) e.dataTransfer.setData('text/plain', t.getAttribute('data-wi'));
  };
  main.ondragover = function (e) {
    if (e.target.closest && e.target.closest('.dc[data-date]')) e.preventDefault();
  };
  main.ondrop = function (e) {
    var cell = e.target.closest ? e.target.closest('.dc[data-date]') : null;
    if (!cell) return;
    e.preventDefault();
    var i = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (CAL.work[i]) { CAL.work[i].planned_date = cell.getAttribute('data-date'); drawPlan(main); }
  };
}

function openEditDate(main, i) {
  var w = CAL.work[i];
  if (!w) return;
  var ov = modal(jobLabel(w),
    '<div class="fg"><label>วันที่วางแผน</label><input type="date" id="ed-date" value="' + esc(w.planned_date) + '"></div>' + warnHtml(w),
    '<button type="button" class="btn" data-act="ok">ตกลง</button>');
  bindClick(ov, {
    ok: function () {
      var v = $('ed-date').value;
      if (v) { w.planned_date = v; ov.close(); drawPlan(main); }
    }
  });
}

function openAdhoc(main) {
  return getJobs().then(function (jobs) {
    var act = jobs.filter(function (j) { return j.active; });
    if (!act.length) { toast('ยังไม่มีงานใน Job master', true); return; }
    var def = CAL.month === todayStr().slice(0, 7) ? todayStr() : CAL.month + '-01';
    var list = act.map(function (j) { return [j.job_id, jobLabel(j) + (j.frequency_type === 'NONE' ? ' (รายครั้ง)' : '')]; });
    var ov = modal('เพิ่มงานลงแผน',
      '<div class="fg"><label>งาน</label><select id="ad-job">' + optHtml(list, '') + '</select></div>'
      + '<div class="fg"><label>วันที่</label><input type="date" id="ad-date" value="' + def + '"></div>',
      '<button type="button" class="btn" data-act="add">เพิ่ม</button>');
    bindClick(ov, {
      add: function () {
        var date = $('ad-date').value, id = $('ad-job').value;
        if (!date) { toast('เลือกวันที่', true); return; }
        var j = act.filter(function (x) { return x.job_id === id; })[0];
        CAL.work.push({ job_id: j.job_id, line: j.line, machine: j.machine, job_name: j.job_name, job_detail: j.job_detail,
          planned_date: date, original_date: date, shifted_reason: '', last_done: '', lifetime_days: j.lifetime_days,
          lifetime_deadline: '', include: true, adhoc: true });
        ov.close();
        drawPlan(main);
      }
    });
  });
}