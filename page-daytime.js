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

function renderManual(main) {
  resetHandlers(main);
  return api('daytime.manualJobs').then(function (list) {
    var map = {};
    var opts = [['', '-- เลือกงาน --']];
    list.forEach(function (x) {
      map[x.job.job_id] = x;
      opts.push([x.job.job_id, jobLabel(x.job) + (x.job.frequency_type === 'NONE' ? ' (รายครั้ง)' : '')]);
    });
    main.innerHTML = '<div class="bar"><button type="button" class="btn sec" data-act="back">◀ กลับ</button><b>เพิ่มงาน Manual</b></div>'
      + '<div class="fg"><label>เลือกงาน</label><select id="mn-job">' + optHtml(opts, '') + '</select></div><div id="mn-info"></div>';
    bindClick(main, {
      back: function () { return renderDtList(main); },
      next: function () {
        var cur = map[$('mn-job').value];
        if (cur) openDtForm(main, cur.job, { manual: true, ref: cur.due });
      }
    });
    main.onchange = function (e) {
      if (e.target.id !== 'mn-job') return;
      var cur = map[e.target.value];
      var box = $('mn-info');
      if (!cur) { box.innerHTML = ''; return; }
      var per = cur.job.frequency_type === 'NONE';
      var today = todayStr();
      var h = '<div class="card"><div>ทำล่าสุด: ' + (cur.last_done ? esc(thD(cur.last_done)) + ' (ผ่านมา ' + dayDiff(today, cur.last_done) + ' วัน)' : 'ยังไม่เคยบันทึก') + '</div>';
      if (per) h += '<div class="note">งานรายครั้ง: ไม่มีรอบและ Lifetime ต้องระบุรายละเอียดงานครั้งนี้ในช่อง Comment</div>';
      else {
        h += '<div>ครบกำหนดถัดไป: ' + esc(thD(cur.due)) + ' · Lifetime ' + (cur.job.lifetime_days ? cur.job.lifetime_days + ' วัน' : '-') + '</div>';
        if (today < cur.due) h += '<div class="warn">⚠ ยังไม่ถึงกำหนด จะต้องระบุเหตุผลที่ทำก่อน</div>';
      }
      h += '<div class="ma"><button type="button" class="btn" data-act="next">ถัดไป ▶</button></div></div>';
      box.innerHTML = h;
    };
  });
}