var DT = { photos: {} };

PAGES.daytime = {
  title: 'Daytime Record',
  render: function (main) { return renderDtList(main); }
};

function renderDtList(main) {
  resetHandlers(main);
  main.innerHTML = '<p class="muted">กำลังโหลด...</p>';
  var rec = canRecord('Daytime');
  return api('daytime.todo').then(function (r) {
    var map = {};
    function card(x, early) {
      map[x.plan_id] = x;
      return '<div class="card' + (rec ? ' click' : '') + '"' + (rec ? ' data-act="open" data-id="' + esc(x.plan_id) + '"' : '') + '>'
        + '<b>' + esc(jobLabel(x.job)) + '</b>'
        + '<span class="tag' + (x.overdue ? ' bad' : '') + '">' + esc(thD(x.planned_date)) + (x.overdue ? ' (ค้าง)' : '') + '</span>'
        + (early ? '<span class="tag warn">ทำก่อนกำหนด</span>' : '')
        + (x.reject_comment ? '<div class="warn">ถูกส่งกลับ: ' + esc(x.reject_comment) + '</div>' : '')
        + '</div>';
    }
    var items = r.items.map(function (x) { return card(x, false); }).join('');
    var up = r.upcoming.map(function (x) { return card(x, true); }).join('');
    main.innerHTML = '<div class="bar"><h3>งานวันนี้</h3><span class="sp"></span>'
      + (rec ? '<button type="button" class="btn" data-act="manual">+ เพิ่มงาน Manual</button>' : '') + '</div>'
      + (rec ? '' : viewNote('Daytime'))
      + (items || '<p class="muted">ไม่มีงานค้าง/งานของวันนี้</p>')
      + (up ? '<h4>งานที่จะถึง (7 วัน)</h4>' + up : '');
    bindClick(main, {
      open: function (t) {
        var x = map[t.getAttribute('data-id')];
        if (x) openDtForm(main, x.job, { plan_id: x.plan_id, ref: x.planned_date });
      },
      manual: function () { return renderManual(main); }
    });
  });
}

function photoHtml(label, key) {
  return '<div class="fg"><label>' + label + '</label>'
    + '<label class="btn sec filebtn">📷 ถ่าย/เลือกรูป<input type="file" accept="image/*" capture="environment" data-photo="' + esc(key) + '"></label>'
    + '<img id="pv-' + esc(key) + '" class="pv" alt=""></div>';
}

function fieldHtml(f) {
  var lab = esc(f.label) + (f.unit ? ' (' + esc(f.unit) + ')' : '') + (f.required ? ' *' : '');
  if (f.type === 'checkbox') return '<label class="chk"><input type="checkbox" data-fid="' + esc(f.field_id) + '"> ' + lab + '</label>';
  if (f.type === 'photo') return photoHtml(lab, 'f_' + f.field_id);
  if (f.type === 'dropdown') {
    var list = [['', '-- เลือก --']];
    String(f.options || '').split(',').forEach(function (o) { o = o.trim(); if (o) list.push([o, o]); });
    return '<div class="fg"><label>' + lab + '</label><select data-fid="' + esc(f.field_id) + '">' + optHtml(list, '') + '</select></div>';
  }
  return '<div class="fg"><label>' + lab + '</label><input data-fid="' + esc(f.field_id) + '" type="' + (f.type === 'number' ? 'number' : 'text') + '" step="any"></div>';
}

function openDtForm(main, job, ctx) {
  resetHandlers(main);
  DT.photos = {};
  var per = job.frequency_type === 'NONE';
  var h = '<div class="bar"><button type="button" class="btn sec" data-act="back">◀ กลับ</button><b>' + esc(jobLabel(job)) + '</b></div><div class="card">';
  h += '<p class="muted">' + esc(job.job_detail || '') + '</p>';
  if (ctx.manual) h += '<span class="tag">งาน Manual</span>';
  if (per) h += '<span class="tag">งานรายครั้ง</span>';
  h += '<div class="fg"><label>วันที่ทำงาน</label><input type="date" id="dt-date" value="' + todayStr() + '" max="' + todayStr() + '"></div>';
  h += '<div id="dt-early" class="fg hide"><div class="warn">⚠ ยังไม่ถึงกำหนด' + (ctx.ref ? ' (ครบ ' + esc(thD(ctx.ref)) + ')' : '') + ' ต้องระบุเหตุผล</div>'
    + '<label>เหตุผลที่ทำก่อนกำหนด *</label><textarea id="dt-early-text"></textarea></div>';
  if (job.photo_mode === 'BEFORE_AFTER') h += photoHtml('รูปก่อนเปลี่ยน *', 'before') + photoHtml('รูปหลังเปลี่ยน *', 'after');
  if (job.photo_mode === 'SINGLE') h += photoHtml('รูปงานที่ทำ *', 'single');
  job.fields.forEach(function (f) { h += fieldHtml(f); });
  h += '<label class="chk"><input type="checkbox" id="dt-abn"> พบความผิดปกติ</label>';
  h += '<div class="fg"><label>' + (per ? 'รายละเอียดงานครั้งนี้ *' : 'Comment') + '</label><textarea id="dt-comment"></textarea></div>';
  h += '<button type="button" class="btn ok" data-act="submit">ส่ง Report</button></div>';
  main.innerHTML = h;

  function updEarly() {
    var d = $('dt-date').value;
    var early = !!ctx.ref && !!d && d < ctx.ref;
    $('dt-early').className = 'fg' + (early ? '' : ' hide');
  }
  updEarly();

  bindClick(main, {
    back: function () { return renderDtList(main); },
    submit: function (t) {
      var vals = {};
      job.fields.forEach(function (f) {
        if (f.type === 'photo') return;
        var el = document.querySelector('[data-fid="' + f.field_id + '"]');
        if (!el) return;
        vals[f.field_id] = f.type === 'checkbox' ? (el.checked ? 'true' : 'false') : el.value;
      });
      var data = {
        plan_id: ctx.plan_id || '', job_id: job.job_id, date: $('dt-date').value,
        comment: $('dt-comment').value, abnormal: $('dt-abn').checked,
        early_reason: $('dt-early-text').value, values: vals, photos: DT.photos
      };
      return busy(t, function () {
        return api('daytime.submit', data).then(function () {
          toast('ส่ง Report แล้ว');
          return renderDtList(main);
        });
      });
    }
  });
  main.onchange = function (e) {
    var t = e.target;
    if (t.id === 'dt-date') { updEarly(); return; }
    var key = t.getAttribute ? t.getAttribute('data-photo') : null;
    if (key && t.files && t.files[0]) {
      compressImage(t.files[0], 1280, 0.7).then(function (data) {
        DT.photos[key] = data;
        var img = $('pv-' + key);
        if (img) { img.src = data; img.style.display = 'block'; }
      }).catch(showErr);
    }
  };
}

var MN = { line: '', machine: '', id: '' };

function renderManual(main) {
  resetHandlers(main);
  MN = { line: '', machine: '', id: '' };
  return api('daytime.manualJobs').then(function (list) {
    var map = {};
    list.forEach(function (x) { map[x.job.job_id] = x; });
    var lines = uniq(list.map(function (x) { return x.job.line; }));

    function machinesOf(line) {
      return uniq(list.filter(function (x) { return x.job.line === line; }).map(function (x) { return x.job.machine; }));
    }
    function subseq(text, q) {
      var j = 0;
      for (var i = 0; i < text.length && j < q.length; i++) {
        if (text.charAt(i) === q.charAt(j)) j++;
      }
      return j === q.length;
    }
    function score(x, q) {
      if (!q) return 1;
      var name = String(x.job.job_name || '').toLowerCase();
      var detail = String(x.job.job_detail || '').toLowerCase();
      var mc = String(x.job.machine || '').toLowerCase();
      if (name === q) return 100;
      if (name.indexOf(q) === 0) return 90;
      if (name.indexOf(q) >= 0) return 80;
      var all = name + ' ' + detail + ' ' + mc;
      var toks = q.split(/\s+/).filter(function (t) { return t; });
      var hit = 0;
      toks.forEach(function (t) { if (all.indexOf(t) >= 0) hit++; });
      if (toks.length && hit === toks.length) return 60;
      if (detail.indexOf(q) >= 0) return 50;
      if (hit > 0) return 30 + hit;
      if (q.length >= 2 && subseq(name, q)) return 20;
      return 0;
    }
    function ready() { return !!MN.line && !!MN.machine; }

    main.innerHTML = '<div class="bar"><button type="button" class="btn sec" data-act="back">◀ กลับ</button><b>เพิ่มงาน Manual</b></div>'
      + '<div class="row2">'
      + '<div class="fg"><label>1. เลือก Line</label><select id="mn-line">' + optHtml([['', '-- เลือก Line --']].concat(lines.map(function (l) { return [l, l]; })), '') + '</select></div>'
      + '<div class="fg"><label>2. เลือกเครื่องจักร</label><select id="mn-machine" disabled></select></div>'
      + '</div>'
      + '<div class="fg"><label>3. พิมพ์ค้นหางาน</label><input id="mn-q" type="text" autocomplete="off" disabled></div>'
      + '<div id="mn-sug"></div><div id="mn-info"></div>';

    function drawMachine() {
      var sel = $('mn-machine');
      if (!MN.line) {
        sel.innerHTML = optHtml([['', '-- เลือก Line ก่อน --']], '');
        sel.disabled = true;
        return;
      }
      var opts = [['', '-- เลือกเครื่องจักร --'], ['*', 'ทุกเครื่องจักร']];
      machinesOf(MN.line).forEach(function (m) { opts.push([m, m]); });
      sel.innerHTML = optHtml(opts, MN.machine);
      sel.disabled = false;
    }
    function drawInfo() {
      var box = $('mn-info');
      var cur = map[MN.id];
      if (!cur) { box.innerHTML = ''; return; }
      var per = cur.job.frequency_type === 'NONE';
      var today = todayStr();
      var h = '<div class="card"><p><b>' + esc(jobLabel(cur.job)) + '</b></p>';
      if (cur.job.job_detail) h += '<p class="muted">' + esc(cur.job.job_detail) + '</p>';
      h += '<div>ทำล่าสุด: ' + (cur.last_done ? esc(thD(cur.last_done)) + ' (ผ่านมา ' + dayDiff(today, cur.last_done) + ' วัน)' : 'ยังไม่เคยบันทึก') + '</div>';
      if (per) {
        h += '<div class="note">งานรายครั้ง: ไม่มีรอบและ Lifetime ต้องระบุรายละเอียดงานครั้งนี้ในช่อง Comment</div>';
      } else {
        h += '<div>ครบกำหนดถัดไป: ' + esc(thD(cur.due)) + ' · Lifetime ' + (cur.job.lifetime_days ? cur.job.lifetime_days + ' วัน' : '-') + '</div>';
        if (today < cur.due) h += '<div class="warn">⚠ ยังไม่ถึงกำหนด จะต้องระบุเหตุผลที่ทำก่อน</div>';
      }
      h += '<div class="ma"><button type="button" class="btn" data-act="next">ถัดไป ▶</button></div></div>';
      box.innerHTML = h;
    }
    function drawSug() {
      var box = $('mn-sug');
      if (!ready() || MN.id) { box.innerHTML = ''; return; }
      var q = $('mn-q').value.trim().toLowerCase();
      var items = list.filter(function (x) {
        return x.job.line === MN.line && (MN.machine === '*' || x.job.machine === MN.machine);
      }).map(function (x) { return { x: x, s: score(x, q) }; })
        .filter(function (r) { return r.s > 0; })
        .sort(function (a, b) { return b.s - a.s || String(a.x.job.job_name).localeCompare(String(b.x.job.job_name)); });
      if (!items.length) {
        box.innerHTML = '<p class="muted">ไม่พบงานที่ตรงกัน ลองพิมพ์คำอื่นหรือเลือกเครื่องจักรอื่น</p>';
        return;
      }
      var total = items.length;
      var h = '<p class="muted">' + (q ? 'งานที่ใกล้เคียง ' : 'งานทั้งหมด ') + total + ' รายการ (กดเพื่อเลือก)</p>';
      items.slice(0, 30).forEach(function (r) {
        var j = r.x.job;
        h += '<div class="card click" data-act="pick" data-id="' + esc(j.job_id) + '">'
          + '<b>' + esc(j.job_name) + '</b>'
          + (j.frequency_type === 'NONE' ? '<span class="tag">รายครั้ง</span>' : '')
          + '<div class="muted">' + esc(j.machine) + (r.x.last_done ? ' · ทำล่าสุด ' + esc(thD(r.x.last_done)) : ' · ยังไม่เคยบันทึก') + '</div></div>';
      });
      if (total > 30) h += '<p class="muted">แสดง 30 รายการแรก พิมพ์เพิ่มเพื่อกรองให้แคบลง</p>';
      box.innerHTML = h;
    }
    function resetSearch() {
      var q = $('mn-q');
      q.value = '';
      q.disabled = !ready();
      q.placeholder = ready() ? 'พิมพ์ชื่องาน เช่น เปลี่ยนกรอง' : 'เลือก Line และเครื่องจักรก่อน';
      MN.id = '';
      drawSug();
      drawInfo();
    }

    drawMachine();
    resetSearch();

    bindClick(main, {
      back: function () { return renderDtList(main); },
      pick: function (t) {
        var cur = map[t.getAttribute('data-id')];
        if (!cur) return;
        MN.id = cur.job.job_id;
        $('mn-q').value = cur.job.job_name;
        drawSug();
        drawInfo();
      },
      next: function () {
        var cur = map[MN.id];
        if (cur) openDtForm(main, cur.job, { manual: true, ref: cur.due });
      }
    });
    main.onchange = function (e) {
      if (e.target.id === 'mn-line') {
        MN.line = e.target.value;
        MN.machine = '';
        drawMachine();
        resetSearch();
      } else if (e.target.id === 'mn-machine') {
        MN.machine = e.target.value;
        resetSearch();
      }
    };
    main.oninput = function (e) {
      if (e.target.id !== 'mn-q') return;
      MN.id = '';
      drawInfo();
      drawSug();
    };
  });
}
