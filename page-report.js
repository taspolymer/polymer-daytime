var REP = { F: { from: '', to: '', line: '', machine: '', job_name: '', status: '', abnormal: '' }, rows: [] };

PAGES.report = {
  title: 'Report',
  render: function (main) {
    if (!REP.F.from) { REP.F.from = addD(todayStr(), -30); REP.F.to = todayStr(); }
    return getJobs().then(function (jobs) {
      repDraw(main, jobs);
      return repLoad();
    });
  }
};

function repDraw(main, jobs) {
  resetHandlers(main);
  var F = REP.F;
  function opt(arr) { return [['', 'ทั้งหมด']].concat(arr.map(function (x) { return [x, x]; })); }
  function box(label, inner) { return '<div><div class="muted">' + label + '</div>' + inner + '</div>'; }
  var h = '<h3>Report</h3><div class="filters">'
    + box('จากวันที่', '<input type="date" data-f="from" value="' + esc(F.from) + '">')
    + box('ถึงวันที่', '<input type="date" data-f="to" value="' + esc(F.to) + '">')
    + box('Line', '<select data-f="line">' + optHtml(opt(uniq(jobs.map(function (j) { return j.line; }))), F.line) + '</select>')
    + box('Machine', '<select data-f="machine">' + optHtml(opt(uniq(jobs.map(function (j) { return j.machine; }))), F.machine) + '</select>')
    + box('Job name', '<select data-f="job_name">' + optHtml(opt(uniq(jobs.map(function (j) { return j.job_name; }))), F.job_name) + '</select>')
    + box('สถานะ', '<select data-f="status">' + optHtml([['', 'ทั้งหมด'], ['PENDING', 'รอตรวจ'], ['APPROVED', 'อนุมัติ'], ['REJECTED', 'ส่งกลับ']], F.status) + '</select>')
    + box('ความผิดปกติ', '<select data-f="abnormal">' + optHtml([['', 'ทั้งหมด'], ['1', 'เฉพาะผิดปกติ']], F.abnormal) + '</select>')
    + '</div><div class="bar"><button type="button" class="btn" data-act="search">ค้นหา</button>'
    + '<button type="button" class="btn sec" data-act="csv">Export CSV</button></div><div id="rep-out"></div>';
  main.innerHTML = h;
  bindClick(main, {
    search: function (t) { return busy(t, repLoad); },
    csv: function () { exportCsv(REP.rows); },
    detail: function (t) { return openDetail(t.getAttribute('data-id')); }
  });
  main.onchange = function (e) {
    var f = e.target.getAttribute ? e.target.getAttribute('data-f') : null;
    if (f) REP.F[f] = e.target.value;
  };
}

function repLoad() {
  var out = $('rep-out');
  if (!out) return Promise.resolve();
  out.innerHTML = '<p class="muted">กำลังโหลด...</p>';
  return api('report.list', REP.F).then(function (rows) {
    REP.rows = rows;
    var tr = '';
    rows.forEach(function (r) {
      var cls = r.review_status === 'APPROVED' ? 'ok' : (r.review_status === 'REJECTED' ? 'bad' : 'warn');
      tr += '<tr class="click" data-act="detail" data-id="' + esc(r.record_id) + '"><td>' + esc(thD(r.date)) + '</td><td>' + esc(r.line) + '</td><td>' + esc(r.machine)
        + '</td><td>' + esc(r.job_name) + '</td><td>' + esc(r.operator) + '</td><td><span class="tag ' + cls + '">' + esc(STATUS_TH[r.review_status] || r.review_status) + '</span></td><td>'
        + (r.abnormal ? '<span class="tag bad">ผิดปกติ</span>' : '') + (r.early ? '<span class="tag warn">ก่อนกำหนด</span>' : '') + ' ' + esc(r.comment || '') + '</td></tr>';
    });
    out.innerHTML = rows.length
      ? '<div class="tw"><table class="tb"><thead><tr><th>วันที่</th><th>Line</th><th>Machine</th><th>งาน</th><th>ผู้บันทึก</th><th>สถานะ</th><th>หมายเหตุ</th></tr></thead><tbody>' + tr + '</tbody></table></div>'
      : '<p class="muted">ไม่พบข้อมูล</p>';
  });
}

function exportCsv(rows) {
  var cols = [['date', 'วันที่'], ['line', 'Line'], ['machine', 'Machine'], ['job_name', 'งาน'], ['operator', 'ผู้บันทึก'], ['review_status', 'สถานะ'], ['abnormal', 'ผิดปกติ'], ['comment', 'Comment']];
  function q(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }
  var lines = [cols.map(function (c) { return q(c[1]); }).join(',')];
  rows.forEach(function (r) { lines.push(cols.map(function (c) { return q(r[c[0]]); }).join(',')); });
  var blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'report.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function openDetail(id) {
  return api('report.detail', { record_id: id }).then(function (d) {
    var r = d.record;
    var canRev = r.review_status === 'PENDING' && can(LEADER_UP);
    var h = '<p><b>' + esc(d.job.line + ' · ' + d.job.machine + ' · ' + d.job.job_name) + '</b></p>'
      + '<p class="muted">' + esc(thD(r.date) + ' · ' + r.operator) + '</p>';
    if (r.abnormal) h += '<p class="warn">⚠ พบความผิดปกติ</p>';
    if (r.early_reason) h += '<p class="warn">ทำก่อนกำหนด: ' + esc(r.early_reason) + '</p>';
    if (d.values.length) {
      h += '<table class="tb">';
      d.values.forEach(function (v) {
        var val = v.type === 'checkbox' ? (v.value === 'true' ? '✔' : '✘') : v.value + (v.unit ? ' ' + v.unit : '');
        h += '<tr><td>' + esc(v.label) + '</td><td>' + esc(val) + '</td></tr>';
      });
      h += '</table>';
    }
    h += '<p>Comment: ' + esc(r.comment || '-') + '</p><div class="imgs">';
    d.photos.forEach(function (p, i) { h += '<div><div class="muted">' + esc(p.label) + '</div><img id="rp-img-' + i + '" alt=""></div>'; });
    h += '</div>';
    if (r.review_status !== 'PENDING') {
      h += '<p class="muted">' + esc((STATUS_TH[r.review_status] || '') + ' โดย ' + r.reviewer + (r.review_comment ? ' : ' + r.review_comment : '')) + '</p>';
    }
    if (canRev) h += '<div class="fg"><textarea id="rv-comment" placeholder="Comment ผู้ตรวจ (จำเป็นเมื่อส่งกลับ)"></textarea></div>';
    var foot = canRev ? '<button type="button" class="btn bad" data-act="reject">ส่งกลับแก้ไข</button><button type="button" class="btn ok" data-act="approve">อนุมัติ</button>' : '';
    var ov = modal('รายละเอียด Report', h, foot);
    d.photos.forEach(function (p, i) { loadPhoto(p.id, $('rp-img-' + i)); });
    function decide(dec) {
      return function (t) {
        return busy(t, function () {
          return api('report.review', { record_id: id, decision: dec, comment: $('rv-comment').value }).then(function () {
            toast('บันทึกผลตรวจแล้ว');
            ov.close();
            return repLoad();
          });
        });
      };
    }
    bindClick(ov, { reject: decide('REJECTED'), approve: decide('APPROVED') });
  });
}