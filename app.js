// ================= CONFIG =================
// แทนที่ข้อความด้านล่างด้วย Web App URL (/exec) ของ Google Apps Script
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx__hO7boKsYHxLXZ39MnPYdmT1lg-djsXSRWH_gKcQLOpF-3TIBVaAb4CiZ__dm_wFQQ/exec';

function api(action, payload) {
  return fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({ token: S.token, action: action, payload: payload || {} })
  })
  .then(res => res.text())
  .then(txt => {
    let res;
    try { res = JSON.parse(txt); }
    catch (e) { throw new Error('เชื่อมต่อ Server ไม่สำเร็จ (ตรวจ URL ของ Apps Script และสิทธิ์ Who has access = Anyone)'); }
    if (!res.success) {
      const m = String(res.message || 'Error').replace(/^Error:\s*/, '');
      if (m.indexOf('SESSION') >= 0) {
        logout();
        throw new Error('หมดเวลาใช้งาน กรุณา Login ใหม่');
      }
      throw new Error(m);
    }
    return res.data;
  });
}

// ================= แสดง error บนหน้าจอ (กันหน้าว่างเปล่า) =================
window.onerror=function(m,s,l){var d=document.getElementById('app')||document.body,p=document.createElement('pre');
  p.style.cssText='color:#b00;padding:12px;white-space:pre-wrap';p.textContent='Error: '+m+' (บรรทัด '+l+')';d.appendChild(p);};

// ================= ที่เก็บ session =================
const store=(function(){try{sessionStorage.setItem('_t','1');sessionStorage.removeItem('_t');return sessionStorage;}
  catch(e){const m={};return{getItem:k=>(k in m?m[k]:null),setItem:(k,v)=>{m[k]=String(v);},removeItem:k=>{delete m[k];},clear:()=>{for(const k in m)delete m[k];}};}})();

// ================= พื้นฐาน =================
const TH_M=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const CLASSES=['Operator','Leader','Engineer','Manager','Admin'],DEPTS=['Daytime','Raw Material','RCY'];
const LINES=['Line#1','Line#2','Line#3','UT','Solvent','Other'];
const PLANNERS=['Leader','Engineer','Manager','Admin'],REVIEWERS=PLANNERS,LEADER_UP=PLANNERS;
const STATUS_TH={PENDING:'รอตรวจ',APPROVED:'อนุมัติ',REJECTED:'ส่งกลับ'};
const S={token:store.getItem('tk')||'',user:JSON.parse(store.getItem('us')||'null'),jobs:null};
const can=(...c)=>S.user&&c.includes(S.user.class);
const canRecord=dept=>!!S.user&&(LEADER_UP.includes(S.user.class)||S.user.department===dept);
const viewNote=dept=>h('p',{class:'note'},'โหมดดูอย่างเดียว: ลงข้อมูลได้เฉพาะแผน '+dept+' หรือระดับ Leader ขึ้นไป');
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate());
const pd=s=>{const a=s.split('-').map(Number);return new Date(Date.UTC(a[0],a[1]-1,a[2]));};
const addD=(s,n)=>{const d=pd(s);d.setUTCDate(d.getUTCDate()+n);return ymd(d);};
const todayStr=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Bangkok'});
const thD=s=>{const d=pd(s);return d.getUTCDate()+' '+TH_M[d.getUTCMonth()];};
const dayDiff=(a,b)=>Math.round((pd(a)-pd(b))/864e5);
const isWE=s=>[0,6].includes(pd(s).getUTCDay());

function h(t,a,...c){const e=document.createElement(t);for(const k in(a||{})){const v=a[k];
  if(k.startsWith('on')){if(v)e.addEventListener(k.slice(2),v);}else if(k==='class')e.className=v;
  else if(k==='value')e.value=v;else if(v===true)e.setAttribute(k,'');
  else if(v!==false&&v!=null)e.setAttribute(k,v);}
  c.flat(9).forEach(x=>{if(x==null||x===false)return;e.append(x.nodeType?x:document.createTextNode(x));});return e;}
const $=s=>document.querySelector(s);
const _rc=Element.prototype.replaceChildren;
Element.prototype.replaceChildren=function(...c){_rc.call(this,...c.flat(9).filter(x=>x!=null&&x!==false));};
const mount=el=>$('#app').replaceChildren(el);

function toast(m,err){const t=h('div',{class:'toast'+(err?' err':'')},m);document.body.append(t);setTimeout(()=>t.remove(),3500);}
async function busy(btn,fn){btn.disabled=true;try{await fn();}catch(e){toast(e.message,1);}finally{btn.disabled=false;}}
function modal(title,body,actions){
  const close=()=>o.remove();
  const o=h('div',{class:'ov'},h('div',{class:'md'},
    h('div',{class:'mh'},h('b',{},title),h('button',{class:'x',onclick:close},'×')),
    body,
    actions?h('div',{class:'ma'},actions(close)):null));
  document.body.append(o);return close;
}
function sel(opts,val,on){return h('select',{onchange:e=>on(e.target.value)},opts.map(o=>{const[v,l]=Array.isArray(o)?o:[o,o];return h('option',{value:v,selected:String(v)===String(val)},l);}));}
const jobLabel=x=>(x.line?x.line+' · ':'')+(x.machine?x.machine+' · ':'')+x.job_name;
function compress(file,max=1280){return new Promise((res,rej)=>{const img=new Image(),url=URL.createObjectURL(file);
  img.onload=()=>{const r=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=img.width*r;c.height=img.height*r;
  c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);res(c.toDataURL('image/jpeg',.75));};img.onerror=rej;img.src=url;});}
const photoCache={};
async function loadPhoto(id,img){if(!photoCache[id])photoCache[id]=api('photo.get',{id});try{img.src=await photoCache[id];}catch(e){img.alt='โหลดรูปไม่สำเร็จ';}}
async function getJobs(force){if(!S.jobs||force)S.jobs=await api('jobs.list');return S.jobs;}

// ================= Login / Shell =================
function logout(){S.token='';S.user=null;S.jobs=null;store.clear();loginView();}
function loginView(){
  const id=h('input',{placeholder:'User ID',autocomplete:'username'}),pw=h('input',{type:'password',placeholder:'Password',autocomplete:'current-password'});
  const b=h('button',{class:'btn',onclick:()=>busy(b,async()=>{
    const r=await api('login',{user_id:id.value,password:pw.value});
    S.token=r.token;S.user=r.user;store.setItem('tk',r.token);store.setItem('us',JSON.stringify(r.user));go(homePage());
  })},'เข้าสู่ระบบ');
  pw.addEventListener('keydown',e=>{if(e.key==='Enter')b.click();});
  mount(h('div',{class:'login'},h('h2',{},'Factory Tracker'),id,pw,b));
}
const PAGES={calendar:['ปฏิทิน',calendarPage],daytime:['Daytime Record',daytimePage],rawmat:['Raw Mat Record',rawMatPage],rcy:['RCY Record',rcyPage],report:['Report',reportPage],setting:['Setting',settingPage]};
const canPage=k=>k==='setting'?can('Admin','Engineer'):true;
const homePage=()=>S.user.class==='Operator'?({'Daytime':'daytime','Raw Material':'rawmat','RCY':'rcy'}[S.user.department]||'calendar'):'calendar';
function go(p){
  if(!S.token)return loginView();
  if(!PAGES[p]||!canPage(p))p='calendar';
  const main=h('main',{id:'main'});
  const nav=Object.keys(PAGES).filter(canPage).map(k=>h('button',{class:k===p?'on':'',onclick:()=>go(k)},PAGES[k][0]));
  mount(h('div',{},h('header',{},nav,h('span',{class:'sp'}),h('span',{},S.user.name+' ('+S.user.class+')'),
    h('button',{onclick:changePw},'รหัสผ่าน'),h('button',{onclick:logout},'ออก')),main));
  PAGES[p][1](main).catch(e=>main.replaceChildren(h('p',{class:'warn'},e.message)));
}
function changePw(){
  const o=h('input',{type:'password',placeholder:'รหัสผ่านเดิม'}),n=h('input',{type:'password',placeholder:'รหัสผ่านใหม่ (≥6 ตัว)'});
  modal('เปลี่ยนรหัสผ่าน',h('div',{class:'fg'},o,h('br'),n),c=>{
    const b=h('button',{class:'btn',onclick:()=>busy(b,async()=>{await api('auth.changePassword',{old:o.value,new:n.value});toast('เปลี่ยนแล้ว');c();})},'บันทึก');
    return[b];
  });
}

// ================= Calendar =================
const Cal={month:todayStr().slice(0,7),mode:'view',step:1,work:[],others:[],loaded:false};
const shiftMonth=(ym,n)=>{const a=ym.split('-').map(Number),d=new Date(Date.UTC(a[0],a[1]-1+n,1));return d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1);};
const monthRange=ym=>{const a=ym.split('-').map(Number);return{from:ym+'-01',to:ymd(new Date(Date.UTC(a[0],a[1],0)))};};
const monthTitle=ym=>TH_M[+ym.slice(5)-1]+' '+(+ym.slice(0,4)+543);
const short=x=>(x.line?x.line+' ':'')+x.job_name;
function planState(p,t){if(p.status==='DRAFT')return'draft';if(p.status==='CONFIRMED')return p.planned_date<t?'overdue':'planned';return p.review==='APPROVED'?'approved':'pending';}

function grid(ym,byDate,opt){
  const a=ym.split('-').map(Number),off=(new Date(Date.UTC(a[0],a[1]-1,1)).getUTCDay()+6)%7,days=new Date(Date.UTC(a[0],a[1],0)).getUTCDate();
  const g=h('div',{class:'cal'});
  ['จ','อ','พ','พฤ','ศ','ส','อา'].forEach((d,i)=>g.append(h('div',{class:'dh'+(i>4?' we':'')},d)));
  for(let i=0;i<off;i++)g.append(h('div',{class:'dc empty'}));
  for(let d=1;d<=days;d++){
    const ds=ym+'-'+pad(d),wd=(off+d-1)%7;
    const cell=h('div',{class:'dc'+(wd>4?' we':'')+(ds===todayStr()?' today':'')},h('div',{class:'dn'},d));
    (byDate[ds]||[]).forEach(x=>cell.append(opt.chip(x)));
    if(opt.drop){
      cell.addEventListener('dragover',e=>{e.preventDefault();cell.classList.add('over');});
      cell.addEventListener('dragleave',()=>cell.classList.remove('over'));
      cell.addEventListener('drop',e=>{e.preventDefault();cell.classList.remove('over');opt.drop(ds,e.dataTransfer.getData('text/plain'));});
    }
    g.append(cell);
  }
  return g;
}

async function calendarPage(m){
  if(Cal.mode==='plan')return planPage(m);
  m.replaceChildren(h('p',{},'กำลังโหลด...'));
  const r=await api('plan.month',{month:Cal.month}),by={};
  r.plans.forEach(p=>(by[p.planned_date]=by[p.planned_date]||[]).push(p));
  const mv=n=>{Cal.month=shiftMonth(Cal.month,n);go('calendar');};
  const bar=h('div',{class:'bar'},h('button',{class:'btn sec',onclick:()=>mv(-1)},'◀'),h('b',{},monthTitle(Cal.month)),h('button',{class:'btn sec',onclick:()=>mv(1)},'▶'),h('span',{class:'sp'}),
    can(...PLANNERS)?h('button',{class:'btn',onclick:()=>{Cal.mode='plan';Cal.step=1;Cal.loaded=false;go('calendar');}},'โหมดวางแผน'):null);
  const legend=h('div',{class:'legend muted'},h('span',{},'🟦 ตามแผน'),h('span',{},'🟨 รอตรวจ'),h('span',{},'🟩 อนุมัติ'),h('span',{},'🟥 เลยกำหนด'),h('span',{},'⬜ ร่าง'));
  const g=grid(Cal.month,by,{chip:p=>h('div',{class:'chip '+planState(p,r.today),onclick:()=>planInfo(p)},(p.is_manual?'✋ ':'')+short(p))});
  m.replaceChildren(bar,legend,g);
}
function planInfo(p){
  const body=h('div',{},h('p',{},h('b',{},jobLabel(p))),h('p',{class:'muted'},p.job_detail||''),h('p',{},'วันที่: '+thD(p.planned_date)),
    p.shifted_reason?h('p',{class:'note'},p.shifted_reason):null,
    p.last_done?h('p',{class:'muted'},'ทำล่าสุด '+thD(p.last_done)):null,
    p.is_manual?h('p',{class:'tag'},'งาน Manual'):null,
    p.early_reason?h('p',{class:'warn'},'ทำก่อนกำหนด: '+p.early_reason):null);
  modal('รายละเอียดงาน',body,c=>{
    if(!can(...PLANNERS)||p.status==='DONE')return[];
    return[h('button',{class:'btn bad',onclick:async e=>{
      if(!confirm('ยกเลิกงานนี้ออกจากแผน?'))return;
      await busy(e.target,async()=>{await api('plan.cancel',{plan_id:p.plan_id});c();go('calendar');});
    }},'ลบออกจากแผน')];
  });
}

// ---- Plan Mode ----
function warns(x){
  const w=[];
  if(x.shifted_reason)w.push(h('div',{class:'note'},'ℹ '+x.shifted_reason));
  if(isWE(x.planned_date))w.push(h('div',{class:'warn'},'⚠ ตรงวันเสาร์/อาทิตย์'));
  if(x.lifetime_deadline&&x.planned_date>x.lifetime_deadline)w.push(h('div',{class:'warn'},'⚠ เกิน Lifetime (ครบ '+thD(x.lifetime_deadline)+')'));
  if(x.planned_date<todayStr())w.push(h('div',{class:'warn'},'⚠ เลยกำหนดแล้ว'));
  return w;
}
const hasWarn=x=>warns(x).some(e=>e.className==='warn');
const rerender=()=>planPage($('#main'));
const chosen=()=>Cal.work.filter(x=>x.include);

async function planPage(m){
  const{from,to}=monthRange(Cal.month);
  if(!Cal.loaded){
    m.replaceChildren(h('p',{},'กำลังคำนวณรายการงาน...'));
    const r=await api('plan.suggest',{from,to});
    Cal.work=[...r.drafts.map(x=>({...x,include:true})),...r.items.map(x=>({...x,include:true}))];
    Cal.others=r.others;Cal.loaded=true;
  }
  const head=h('div',{class:'bar'},h('b',{},'โหมดวางแผน · '+monthTitle(Cal.month)),h('span',{class:'sp'}),
    h('button',{class:'btn sec',onclick:()=>{if(confirm('ออกจากโหมดวางแผน? (ข้อมูลที่ยังไม่บันทึกจะหาย)')){Cal.mode='view';go('calendar');}}},'ออก'));
  const steps=h('div',{class:'steps'},['1 รายการงาน','2 จัดลงปฏิทิน','3 ยืนยัน'].map((t,i)=>h('div',{class:'step'+(Cal.step===i+1?' on':'')},t)));
  m.replaceChildren(head,steps,[step1,step2,step3][Cal.step-1]());
}
function addAdhoc(){
  getJobs().then(jobs=>{
    const act=jobs.filter(j=>j.active);
    if(!act.length)return toast('ยังไม่มีงานใน Job master',1);
    let jid=act[0].job_id,date=Cal.month===todayStr().slice(0,7)?todayStr():Cal.month+'-01';
    modal('เพิ่มงานลงแผน (รายครั้ง)',h('div',{},
      h('div',{class:'fg'},h('label',{},'งาน'),sel(act.map(j=>[j.job_id,jobLabel(j)+(j.frequency_type==='NONE'?' (รายครั้ง)':'')]),jid,v=>jid=v)),
      h('div',{class:'fg'},h('label',{},'วันที่'),h('input',{type:'date',value:date,onchange:e=>date=e.target.value}))),
      c=>[h('button',{class:'btn',onclick:()=>{
        if(!date)return toast('เลือกวันที่',1);
        const j=act.find(x=>x.job_id===jid);
        Cal.work.push({job_id:j.job_id,line:j.line,machine:j.machine,job_name:j.job_name,job_detail:j.job_detail,planned_date:date,original_date:date,
          shifted_reason:'',last_done:'',lifetime_days:j.lifetime_days,lifetime_deadline:'',include:true,adhoc:true});
        c();rerender();
      }},'เพิ่ม')]);
  });
}
function step1(){
  const tb=h('div',{class:'tw'},h('table',{class:'tb'},
    h('thead',{},h('tr',{},['เลือก','งาน','ทำล่าสุด','วันที่วางแผน','หมายเหตุ'].map(t=>h('th',{},t)))),
    h('tbody',{},Cal.work.map(x=>h('tr',{},
      h('td',{},h('input',{type:'checkbox',checked:x.include,onchange:e=>x.include=e.target.checked})),
      h('td',{},jobLabel(x),x.plan_id?h('span',{class:'tag'},'ร่างเดิม'):null,x.adhoc?h('span',{class:'tag'},'เพิ่มเอง'):null),
      h('td',{},x.last_done?thD(x.last_done):'-'),
      h('td',{},h('input',{type:'date',value:x.planned_date,onchange:e=>{if(e.target.value){x.planned_date=e.target.value;rerender();}}})),
      h('td',{},warns(x)))))));
  return h('div',{},
    h('div',{class:'bar'},h('button',{class:'btn sec',onclick:addAdhoc},'+ เพิ่มงานเอง (งานรายครั้ง)')),
    Cal.work.length?tb:h('p',{class:'muted'},'ไม่มีงานที่ต้องวางแผนในเดือนนี้'),
    h('div',{class:'ma'},h('button',{class:'btn',onclick:()=>{if(!chosen().length)return toast('ยังไม่ได้เลือกงาน',1);Cal.step=2;rerender();}},'ถัดไป: จัดลงปฏิทิน ▶')));
}
function editDate(w){
  const inp=h('input',{type:'date',value:w.planned_date});
  modal(jobLabel(w),h('div',{},h('div',{class:'fg'},h('label',{},'วันที่วางแผน'),inp),warns(w)),
    c=>[h('button',{class:'btn',onclick:()=>{if(inp.value){w.planned_date=inp.value;c();rerender();}}},'ตกลง')]);
}
function step2(){
  const by={};
  Cal.others.forEach(p=>(by[p.planned_date]=by[p.planned_date]||[]).push({o:p}));
  Cal.work.forEach((x,i)=>{if(x.include)(by[x.planned_date]=by[x.planned_date]||[]).push({w:x,i});});
  const g=grid(Cal.month,by,{
    chip:e=>e.o
      ?h('div',{class:'chip planned dim',title:'ยืนยันแล้ว'},short(e.o))
      :h('div',{class:'chip draft',draggable:'true',ondragstart:ev=>ev.dataTransfer.setData('text/plain',String(e.i)),onclick:()=>editDate(e.w)},(hasWarn(e.w)?'⚠ ':'')+short(e.w)),
    drop:(ds,i)=>{const w=Cal.work[+i];if(w){w.planned_date=ds;rerender();}}
  });
  const{from,to}=monthRange(Cal.month),out=chosen().filter(x=>x.planned_date<from||x.planned_date>to);
  return h('div',{},
    h('p',{class:'muted'},'ลากงานไปวางวันอื่น หรือแตะที่งานเพื่อเลือกวันที่ (⚠ = มีคำเตือน)'),g,
    out.length?h('div',{class:'card'},h('b',{},'งานนอกเดือนนี้'),out.map(x=>h('div',{},thD(x.planned_date)+' · '+jobLabel(x)))):null,
    h('div',{class:'ma'},h('button',{class:'btn sec',onclick:()=>{Cal.step=1;rerender();}},'◀ กลับ'),h('button',{class:'btn',onclick:()=>{Cal.step=3;rerender();}},'ถัดไป: ยืนยัน ▶')));
}
function step3(){
  const items=chosen().sort((a,b)=>a.planned_date.localeCompare(b.planned_date)),{from,to}=monthRange(Cal.month);
  const payload=()=>({from,to,items:items.map(x=>({job_id:x.job_id,planned_date:x.planned_date,original_date:x.original_date,shifted_reason:x.shifted_reason}))});
  const tb=h('table',{class:'tb'},h('thead',{},h('tr',{},['วันที่','งาน','หมายเหตุ'].map(t=>h('th',{},t)))),
    h('tbody',{},items.map(x=>h('tr',{},h('td',{},thD(x.planned_date)),h('td',{},jobLabel(x)),h('td',{},warns(x))))));
  const b1=h('button',{class:'btn sec',onclick:()=>busy(b1,async()=>{await api('plan.saveDraft',payload());toast('บันทึกร่างแล้ว');})},'บันทึกร่าง');
  const b2=h('button',{class:'btn ok',onclick:()=>busy(b2,async()=>{
    const n=items.filter(hasWarn).length;
    if(!confirm('ยืนยันแผน '+items.length+' งาน'+(n?' (มี '+n+' งานที่มีคำเตือน)':'')+' ?'))return;
    await api('plan.saveDraft',payload());await api('plan.confirm',{from,to});
    toast('ยืนยันแผนแล้ว');Cal.mode='view';go('calendar');
  })},'ยืนยันแผน');
  return h('div',{},h('p',{},'ทั้งหมด '+items.length+' งาน'),h('div',{class:'tw'},tb),
    h('div',{class:'ma'},h('button',{class:'btn sec',onclick:()=>{Cal.step=2;rerender();}},'◀ กลับ'),b1,b2));
}

// ================= Daytime Record =================
function photoBox(label,key,st){
  const img=h('img',{class:'pv'});
  const inp=h('input',{type:'file',accept:'image/*',capture:'environment',hidden:true,onchange:async e=>{
    const f=e.target.files[0];if(!f)return;
    try{st.photos[key]=await compress(f);img.src=st.photos[key];img.style.display='block';}
    catch(x){toast('อ่านรูปไม่ได้',1);}
  }});
  return h('div',{class:'fg'},h('label',{},label),h('button',{type:'button',class:'btn sec',onclick:()=>inp.click()},'📷 ถ่าย/เลือกรูป'),inp,img);
}
function fieldInput(f,st){
  const lab=f.label+(f.unit?' ('+f.unit+')':'')+(f.required?' *':'');
  if(f.type==='checkbox'){
    st.vals[f.field_id]='false';
    return h('label',{class:'chk'},h('input',{type:'checkbox',onchange:e=>st.vals[f.field_id]=e.target.checked?'true':'false'}),lab);
  }
  if(f.type==='photo')return photoBox(lab,'f_'+f.field_id,st);
  const inp=f.type==='dropdown'
    ?h('select',{onchange:e=>st.vals[f.field_id]=e.target.value},h('option',{value:''},'-- เลือก --'),
        String(f.options||'').split(',').map(s=>s.trim()).filter(Boolean).map(o=>h('option',{value:o},o)))
    :h('input',{type:f.type==='number'?'number':'text',step:'any',inputmode:f.type==='number'?'decimal':'text',oninput:e=>st.vals[f.field_id]=e.target.value});
  return h('div',{class:'fg'},h('label',{},lab),inp);
}
function recordForm(m,job,ctx,back){
  const st={photos:{},vals:{}},date=todayStr(),per=job.frequency_type==='NONE',early=!!ctx.ref&&date<ctx.ref;
  const ab=h('input',{type:'checkbox'});
  const cm=h('textarea',{placeholder:per?'ระบุรายละเอียดงานครั้งนี้ (จำเป็น)':'Comment / ความผิดปกติ / อื่นๆ'});
  const er=early?h('textarea',{placeholder:'เหตุผลที่ทำก่อนกำหนด'}):null;
  const b=h('button',{class:'btn ok',onclick:()=>busy(b,async()=>{
    if(per&&!cm.value.trim())throw new Error('งานรายครั้ง กรุณาระบุรายละเอียดงานครั้งนี้');
    await api('daytime.submit',{plan_id:ctx.plan_id||'',job_id:job.job_id,date:date,comment:cm.value,abnormal:ab.checked,early_reason:er?er.value:'',values:st.vals,photos:st.photos});
    toast('ส่ง Report แล้ว');back();
  })},'ส่ง Report');
  m.replaceChildren(
    h('div',{class:'bar'},h('button',{class:'btn sec',onclick:back},'◀ กลับ'),h('b',{},jobLabel(job))),
    h('div',{class:'card'},
      h('p',{class:'muted'},job.job_detail||''),
      ctx.manual?h('span',{class:'tag'},'งาน Manual'):null,
      per?h('span',{class:'tag'},'งานรายครั้ง'):null,
      early?h('div',{class:'warn'},'⚠ ยังไม่ถึงกำหนด (ครบ '+thD(ctx.ref)+') ต้องระบุเหตุผล'):null,
      job.photo_mode==='BEFORE_AFTER'?[photoBox('รูปก่อนเปลี่ยน *','before',st),photoBox('รูปหลังเปลี่ยน *','after',st)]:null,
      job.photo_mode==='SINGLE'?photoBox('รูปงานที่ทำ *','single',st):null,
      job.fields.map(f=>fieldInput(f,st)),
      er?h('div',{class:'fg'},h('label',{},'เหตุผลที่ทำก่อนกำหนด *'),er):null,
      h('label',{class:'chk'},ab,'พบความผิดปกติ'),
      h('div',{class:'fg'},h('label',{},per?'รายละเอียดงานครั้งนี้ *':'Comment'),cm),
      b));
}
async function daytimePage(m){
  m.replaceChildren(h('p',{},'กำลังโหลด...'));
  const r=await api('daytime.todo'),back=()=>go('daytime'),rec=canRecord('Daytime');
  const card=(x,early)=>h('div',{class:'card'+(rec?' click':''),onclick:rec?()=>recordForm(m,x.job,{plan_id:x.plan_id,ref:x.planned_date},back):null},
    h('b',{},jobLabel(x.job)),
    h('span',{class:'tag'+(x.overdue?' bad':'')},thD(x.planned_date)+(x.overdue?' (ค้าง)':'')),
    early?h('span',{class:'tag warn'},'ทำก่อนกำหนด'):null,
    x.reject_comment?h('div',{class:'warn'},'ถูกส่งกลับ: '+x.reject_comment):null);
  m.replaceChildren(
    h('div',{class:'bar'},h('h3',{style:'margin:0'},'งานวันนี้'),h('span',{class:'sp'}),
      rec?h('button',{class:'btn',onclick:()=>manualPage(m)},'+ เพิ่มงาน Manual'):null),
    rec?null:viewNote('Daytime'),
    r.items.length?r.items.map(x=>card(x,false)):h('p',{class:'muted'},'ไม่มีงานค้าง/งานของวันนี้'),
    r.upcoming.length?[h('h4',{},'งานที่จะถึง (7 วัน)'),r.upcoming.map(x=>card(x,true))]:null);
}
async function manualPage(m){
  const list=await api('daytime.manualJobs'),back=()=>go('daytime'),box=h('div'),today=todayStr();
  const pick=id=>{
    const cur=list.find(x=>x.job.job_id===id);
    box.replaceChildren();
    if(!cur)return;
    const per=cur.job.frequency_type==='NONE',early=!per&&today<cur.due;
    box.append(h('div',{class:'card'},
      h('div',{},'ทำล่าสุด: '+(cur.last_done?thD(cur.last_done)+' (ผ่านมา '+dayDiff(today,cur.last_done)+' วัน)':'ยังไม่เคยบันทึก')),
      per?h('div',{class:'note'},'งานรายครั้ง: ไม่มีรอบและ Lifetime ต้องระบุรายละเอียดงานครั้งนี้ในช่อง Comment')
         :h('div',{},'ครบกำหนดถัดไป: '+thD(cur.due)+' · Lifetime '+(cur.job.lifetime_days?cur.job.lifetime_days+' วัน':'-')),
      early?h('div',{class:'warn'},'⚠ ยังไม่ถึงกำหนด จะต้องระบุเหตุผลที่ทำก่อน'):null,
      h('div',{class:'ma'},h('button',{class:'btn',onclick:()=>recordForm(m,cur.job,{manual:true,ref:cur.due},back)},'ถัดไป ▶'))));
  };
  m.replaceChildren(
    h('div',{class:'bar'},h('button',{class:'btn sec',onclick:back},'◀ กลับ'),h('b',{},'เพิ่มงาน Manual')),
    h('div',{class:'fg'},h('label',{},'เลือกงาน'),
      sel([['','-- เลือก --'],...list.map(x=>[x.job.job_id,jobLabel(x.job)+(x.job.frequency_type==='NONE'?' (รายครั้ง)':'')])],'',pick)),
    box);
}

// ================= Report (ตาราง) =================
async function reportPage(m){
  const jobs=await getJobs();
  const uniq=a=>[...new Set(a.filter(Boolean))].sort();
  const opt=arr=>[['','ทั้งหมด']].concat(arr.map(x=>[x,x]));
  const F={from:addD(todayStr(),-30),to:todayStr(),line:'',machine:'',job_name:'',status:'',abnormal:''};
  const out=h('div');
  let rows=[];
  const mk=(lab,el)=>h('div',{},h('div',{class:'muted'},lab),el);

  const lineOpts=opt(uniq(jobs.map(j=>j.line)));
  const machineOpts=opt(uniq(jobs.map(j=>j.machine)));
  const nameOpts=opt(uniq(jobs.map(j=>j.job_name)));
  const statusOpts=[['','ทั้งหมด'],['PENDING','รอตรวจ'],['APPROVED','อนุมัติ'],['REJECTED','ส่งกลับ']];
  const abnOpts=[['','ทั้งหมด'],['1','เฉพาะผิดปกติ']];

  const bar=h('div',{class:'filters'});
  bar.append(mk('จากวันที่',h('input',{type:'date',value:F.from,onchange:e=>{F.from=e.target.value;}})));
  bar.append(mk('ถึงวันที่',h('input',{type:'date',value:F.to,onchange:e=>{F.to=e.target.value;}})));
  bar.append(mk('Line',sel(lineOpts,'',v=>{F.line=v;})));
  bar.append(mk('Machine',sel(machineOpts,'',v=>{F.machine=v;})));
  bar.append(mk('Job name',sel(nameOpts,'',v=>{F.job_name=v;})));
  bar.append(mk('สถานะ',sel(statusOpts,'',v=>{F.status=v;})));
  bar.append(mk('ความผิดปกติ',sel(abnOpts,'',v=>{F.abnormal=v;})));

  function draw(){
    const tbody=h('tbody',{});
    rows.forEach(r=>{
      const cls=r.review_status==='APPROVED'?'ok':(r.review_status==='REJECTED'?'bad':'warn');
      const notes=h('td',{});
      if(r.abnormal)notes.append(h('span',{class:'tag bad'},'ผิดปกติ'));
      if(r.early)notes.append(h('span',{class:'tag warn'},'ก่อนกำหนด'));
      notes.append(' '+(r.comment||''));
      const tr=h('tr',{class:'click',onclick:()=>recordDetail(r.record_id,load)});
      tr.append(
        h('td',{},thD(r.date)),
        h('td',{},r.line),
        h('td',{},r.machine),
        h('td',{},r.job_name),
        h('td',{},r.operator),
        h('td',{},h('span',{class:'tag '+cls},STATUS_TH[r.review_status]||r.review_status)),
        notes
      );
      tbody.append(tr);
    });
    const headRow=h('tr',{});
    ['วันที่','Line','Machine','งาน','ผู้บันทึก','สถานะ','หมายเหตุ'].forEach(t=>headRow.append(h('th',{},t)));
    const table=h('table',{class:'tb'});
    table.append(h('thead',{},headRow),tbody);
    out.replaceChildren(h('div',{class:'tw'},table),rows.length?null:h('p',{class:'muted'},'ไม่พบข้อมูล'));
  }
  async function load(){
    out.replaceChildren(h('p',{},'กำลังโหลด...'));
    rows=await api('report.list',F);
    draw();
  }
  const go1=h('button',{class:'btn',onclick:()=>busy(go1,load)},'ค้นหา');
  const csvB=h('button',{class:'btn sec',onclick:()=>csv(rows)},'Export CSV');
  const btns=h('div',{class:'ma',style:'justify-content:flex-start;margin-bottom:10px'});
  btns.append(go1,csvB);
  m.replaceChildren(h('h3',{},'Report'),bar,btns,out);
  await load();
}

function csv(rows){
  const cols=[['date','วันที่'],['line','Line'],['machine','Machine'],['job_name','งาน'],['operator','ผู้บันทึก'],['review_status','สถานะ'],['abnormal','ผิดปกติ'],['comment','Comment']];
  const esc=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
  const lines=[cols.map(c=>c[1])];
  rows.forEach(r=>lines.push(cols.map(c=>r[c[0]])));
  const t='\ufeff'+lines.map(r=>r.map(esc).join(',')).join('\n');
  h('a',{href:URL.createObjectURL(new Blob([t],{type:'text/csv'})),download:'report.csv'}).click();
}

async function recordDetail(id,reload){
  const d=await api('report.detail',{record_id:id});
  const r=d.record;
  const canReview=r.review_status==='PENDING'&&can(...REVIEWERS);
  const rc=h('textarea',{placeholder:'Comment ผู้ตรวจ (จำเป็นเมื่อส่งกลับ)'});
  const body=h('div',{});

  body.append(h('p',{},h('b',{},d.job.line+' · '+d.job.machine+' · '+d.job.job_name)));
  body.append(h('p',{class:'muted'},thD(r.date)+' · '+r.operator));
  if(r.abnormal)body.append(h('p',{class:'warn'},'⚠ พบความผิดปกติ'));
  if(r.early_reason)body.append(h('p',{class:'warn'},'ทำก่อนกำหนด: '+r.early_reason));

  if(d.values.length){
    const tb=h('table',{class:'tb'});
    d.values.forEach(v=>{
      const val=v.type==='checkbox'?(v.value==='true'?'✔':'✘'):(v.value+(v.unit?' '+v.unit:''));
      tb.append(h('tr',{},h('td',{},v.label),h('td',{},val)));
    });
    body.append(tb);
  }
  body.append(h('p',{},'Comment: '+(r.comment||'-')));

  const imgs=h('div',{class:'imgs'});
  d.photos.forEach(p=>{
    const img=h('img',{alt:p.label});
    loadPhoto(p.id,img);
    const cell=h('div',{});
    cell.append(h('div',{class:'muted'},p.label),img);
    imgs.append(cell);
  });
  body.append(imgs);

  if(r.review_status!=='PENDING'){
    const who=(STATUS_TH[r.review_status]||'')+' โดย '+r.reviewer+(r.review_comment?' : '+r.review_comment:'');
    body.append(h('p',{class:'muted'},who));
  }
  if(canReview)body.append(h('div',{class:'fg'},rc));

  modal('รายละเอียด Report',body,c=>{
    if(!canReview)return[];
    const decide=dec=>e=>busy(e.target,async()=>{
      await api('report.review',{record_id:id,decision:dec,comment:rc.value});
      toast('บันทึกผลตรวจแล้ว');
      c();
      reload();
    });
    return[
      h('button',{class:'btn bad',onclick:decide('REJECTED')},'ส่งกลับแก้ไข'),
      h('button',{class:'btn ok',onclick:decide('APPROVED')},'อนุมัติ')
    ];
  });
}

// ================= Setting =================
async function settingPage(m){
  const tabs=[];
  if(can('Admin'))tabs.push(['users','ผู้ใช้']);
  if(can('Admin','Engineer'))tabs.push(['jobs','Job master']);
  let cur=tabs[0][0];
  const body=h('div');
  const draw=()=>{
    body.replaceChildren(h('p',{},'กำลังโหลด...'));
    (cur==='users'?usersTab:jobsTab)(body).catch(e=>body.replaceChildren(h('p',{class:'warn'},e.message)));
  };
  const bar=h('div',{class:'bar'},tabs.map(t=>h('button',{class:'btn sec',onclick:()=>{cur=t[0];draw();}},t[1])));
  m.replaceChildren(h('h3',{},'Setting'),bar,body);
  draw();
}
async function usersTab(box){
  const list=await api('users.list');
  const edit=u=>{
    const f=u?{...u}:{user_id:'',name:'',class:'Operator',department:'Daytime',active:true};
    const pw=h('input',{type:'password',placeholder:u?'เว้นว่าง = ไม่เปลี่ยน':'รหัสผ่าน (≥6 ตัว)'});
    const fg=(l,e)=>h('div',{class:'fg'},h('label',{},l),e);
    modal(u?'แก้ไขผู้ใช้':'เพิ่มผู้ใช้',h('div',{},
      fg('User ID',h('input',{value:f.user_id,disabled:!!u,oninput:e=>f.user_id=e.target.value})),
      fg('ชื่อ',h('input',{value:f.name,oninput:e=>f.name=e.target.value})),
      fg('Class',sel(CLASSES,f.class,v=>f.class=v)),
      fg('แผนก',sel(DEPTS,f.department,v=>f.department=v)),
      fg('รหัสผ่าน',pw),
      h('label',{class:'chk'},h('input',{type:'checkbox',checked:f.active,onchange:e=>f.active=e.target.checked}),'เปิดใช้งาน')),
      c=>{
        const b=h('button',{class:'btn',onclick:()=>busy(b,async()=>{
          await api('users.save',{...f,password:pw.value});c();toast('บันทึกแล้ว');usersTab(box).then(()=>{});
        })},'บันทึก');
        return[b];
      });
  };
  box.replaceChildren(
    h('div',{class:'bar'},h('button',{class:'btn',onclick:()=>edit(null)},'+ เพิ่มผู้ใช้')),
    h('div',{class:'tw'},h('table',{class:'tb'},
      h('thead',{},h('tr',{},['ID','ชื่อ','Class','แผนก','สถานะ'].map(t=>h('th',{},t)))),
      h('tbody',{},list.map(u=>h('tr',{class:'click',onclick:()=>edit(u)},
        h('td',{},u.user_id),h('td',{},u.name),h('td',{},u.class),h('td',{},u.department),h('td',{},u.active?'ใช้งาน':'ปิด')))))));
}
async function jobsTab(box){
  const jobs=await getJobs(true);
  const edit=j=>{
    const f=j?JSON.parse(JSON.stringify(j)):{line:'Line#1',machine:'',job_name:'',job_detail:'',frequency_type:'EVERY_N_DAYS',frequency_value:'15',lifetime_days:30,photo_mode:'BEFORE_AFTER',active:true,fields:[]};
    if(/^\d$/.test(String(f.line)))f.line='Line#'+f.line;
    if(!f.line)f.line='Line#1';
    if(!(+f.lifetime_days>0))f.lifetime_days=30;
    const lineOpts=LINES.includes(f.line)?LINES:[...LINES,f.line];
    const machineList=[...new Set(jobs.map(x=>x.machine).filter(Boolean))].sort();
    const dl=h('datalist',{id:'machine-list'},machineList.map(x=>h('option',{value:x})));
    const fg=(l,e)=>h('div',{class:'fg'},h('label',{},l),e),freq=h('div'),fl=h('div');
    const lifeInp=h('input',{type:'number',min:1,value:f.lifetime_days,oninput:e=>f.lifetime_days=e.target.value});
    const life=fg('Lifetime (วัน)',lifeInp);
    const drawFreq=()=>{
      life.style.display=f.frequency_type==='NONE'?'none':'';
      if(f.frequency_type==='NONE'){
        freq.replaceChildren(h('p',{class:'muted'},'งานรายครั้ง: ไม่มีรอบและ Lifetime ระบบไม่เสนอในแผนอัตโนมัติ เพิ่มได้จากปุ่ม Manual หรือ "+ เพิ่มงานเอง" ในโหมดวางแผน'));
      }else if(f.frequency_type==='EVERY_N_DAYS'){
        freq.replaceChildren(h('input',{type:'number',min:1,value:f.frequency_value,oninput:e=>f.frequency_value=e.target.value}));
      }else{
        const cur=String(f.frequency_value).split(',');
        freq.replaceChildren(h('div',{style:'display:flex;gap:8px;flex-wrap:wrap'},['จ','อ','พ','พฤ','ศ','ส','อา'].map((d,i)=>
          h('label',{class:'chk',style:'margin:0'},
            h('input',{type:'checkbox',checked:cur.includes(String(i+1)),onchange:e=>{
              const s=new Set(String(f.frequency_value).split(',').filter(Boolean));
              if(e.target.checked)s.add(String(i+1));else s.delete(String(i+1));
              f.frequency_value=[...s].sort().join(',');
            }}),d))));
      }
    };
    const drawF=()=>fl.replaceChildren(f.fields.map((x,i)=>h('div',{class:'frow'},
      h('input',{placeholder:'หัวข้อ record '+(i+1),value:x.label,oninput:e=>x.label=e.target.value}),
      sel([['text','ข้อความ'],['number','ตัวเลข'],['checkbox','ติ๊ก'],['dropdown','ตัวเลือก'],['photo','รูป']],x.type,v=>{x.type=v;drawF();}),
      x.type==='dropdown'
        ?h('input',{placeholder:'ตัวเลือก คั่นด้วย ,',value:x.options||'',oninput:e=>x.options=e.target.value})
        :h('input',{placeholder:'หน่วย (kg, ลิตร)',value:x.unit||'',oninput:e=>x.unit=e.target.value}),
      h('label',{class:'chk',style:'margin:0'},h('input',{type:'checkbox',checked:x.required,onchange:e=>x.required=e.target.checked}),'บังคับ'),
      h('span',{},
        h('button',{class:'btn sec',onclick:()=>{if(i>0){[f.fields[i-1],f.fields[i]]=[f.fields[i],f.fields[i-1]];drawF();}}},'↑'),
        h('button',{class:'btn sec',onclick:()=>{if(i<f.fields.length-1){[f.fields[i+1],f.fields[i]]=[f.fields[i],f.fields[i+1]];drawF();}}},'↓'),
        h('button',{class:'btn bad',onclick:()=>{f.fields.splice(i,1);drawF();}},'×')))));
    drawFreq();drawF();
    modal(j?'แก้ไขงาน':'สร้างงาน',h('div',{},
      h('div',{class:'row2'},
        fg('Line',sel(lineOpts,f.line,v=>f.line=v)),
        fg('Machine',h('input',{value:f.machine,list:'machine-list',autocomplete:'off',oninput:e=>f.machine=e.target.value}))),
      dl,
      fg('Job name',h('input',{value:f.job_name,oninput:e=>f.job_name=e.target.value})),
      fg('Job detail',h('textarea',{oninput:e=>f.job_detail=e.target.value},f.job_detail)),
      fg('Frequency',sel([['EVERY_N_DAYS','ทุก N วัน'],['WEEKDAY','ทุกวันของสัปดาห์'],['NONE','ไม่มี (ทำตามเหตุการณ์ / ระบุรายครั้ง)']],f.frequency_type,v=>{
        f.frequency_type=v;
        f.frequency_value=v==='WEEKDAY'?'1':v==='NONE'?'':'15';
        if(v!=='NONE'&&!(+f.lifetime_days>0)){f.lifetime_days=30;lifeInp.value=30;}
        drawFreq();
      })),
      freq,life,
      fg('รูปภาพ',sel([['BEFORE_AFTER','ก่อน-หลัง'],['SINGLE','รูปเดียว'],['NONE','ไม่ต้องมีรูป']],f.photo_mode,v=>f.photo_mode=v)),
      h('h4',{},'หัวข้อที่ต้องบันทึก'),
      fl,
      h('button',{class:'btn sec',onclick:()=>{f.fields.push({label:'',type:'text',unit:'',options:'',required:false});drawF();}},'+ เพิ่มหัวข้อ'),
      h('label',{class:'chk',style:'margin-top:10px'},h('input',{type:'checkbox',checked:f.active,onchange:e=>f.active=e.target.checked}),'เปิดใช้งาน')),
      c=>{
        const b=h('button',{class:'btn',onclick:()=>busy(b,async()=>{
          await api('jobs.save',f);c();toast('บันทึกแล้ว');jobsTab(box).then(()=>{});
        })},'บันทึก');
        return[b];
      });
  };
  const fz=j=>j.frequency_type==='NONE'?'รายครั้ง':j.frequency_type==='EVERY_N_DAYS'?'ทุก '+j.frequency_value+' วัน':'วัน '+j.frequency_value;
  box.replaceChildren(
    h('div',{class:'bar'},h('button',{class:'btn',onclick:()=>edit(null)},'+ สร้างงาน')),
    h('div',{class:'tw'},h('table',{class:'tb'},
      h('thead',{},h('tr',{},['Line','Machine','งาน','ความถี่','Lifetime','รูป','สถานะ'].map(t=>h('th',{},t)))),
      h('tbody',{},jobs.map(j=>h('tr',{class:'click',onclick:()=>edit(j)},
        h('td',{},j.line),h('td',{},j.machine),h('td',{},j.job_name),h('td',{},fz(j)),
        h('td',{},j.lifetime_days?j.lifetime_days+' วัน':'-'),h('td',{},j.photo_mode),h('td',{},j.active?'ใช้งาน':'ปิด')))))));
}

// ================= Raw Material Record =================
const RM_SHIFTS=['เช้า','บ่าย','OT1','OT2'];
const RM_LINES={MDI:['Line#1','Line#2','Line#3'],CE:['Line#1','Line#3'],GA:['Line#1','Line#3']};
async function rawMatPage(m){
  const st={date:todayStr(),shift:'เช้า',rows:[],tpb:3,data:null,comment:'',exists:false};
  const rec=canRecord('Raw Material');
  const body=h('div'),sumBox=h('div');
  function fill(){
    st.data={};
    Object.keys(RM_LINES).forEach(c=>{st.data[c]={};RM_LINES[c].forEach(l=>{st.data[c][l]=c==='MDI'?[]:'';});});
    st.comment='';
    const mine=st.rows.filter(r=>r.shift===st.shift).sort((a,b)=>a.batch_no-b.batch_no);
    st.exists=mine.length>0;
    mine.forEach(r=>{
      if(r.comment)st.comment=r.comment;
      if(!st.data[r.chemical]||st.data[r.chemical][r.line]===undefined)return;
      if(r.chemical==='MDI')st.data.MDI[r.line].push(r.tanks);else st.data[r.chemical][r.line]=r.tanks;
    });
  }
  function mdiCard(){
    const card=h('div',{class:'card'},h('b',{},'MDI'),h('span',{class:'muted'},' · 1 batch = '+st.tpb+' ถัง (แก้จำนวนได้ถ้าเติมไม่ครบ)'));
    RM_LINES.MDI.forEach(line=>{
      const arr=st.data.MDI[line],bx=h('div',{class:'fg'}),tot=h('span',{class:'muted'});
      const upd=()=>{tot.textContent=' · '+arr.length+' batch · '+arr.reduce((a,t)=>a+(+t||0),0)+' ถัง';};
      const drawL=()=>{
        upd();
        bx.replaceChildren(h('label',{},line,tot),
          arr.map((t,i)=>h('div',{class:'bt'},h('span',{},'Batch '+(i+1)),
            h('input',{type:'number',min:1,step:1,value:t,oninput:e=>{arr[i]=e.target.value;upd();}}),'ถัง',
            h('button',{class:'btn bad',onclick:()=>{arr.splice(i,1);drawL();}},'×'))),
          h('button',{class:'btn sec',onclick:()=>{arr.push(st.tpb);drawL();}},'+ เพิ่ม batch'));
      };
      drawL();card.append(bx);
    });
    return card;
  }
  function simpleCard(ch){
    return h('div',{class:'card'},h('b',{},ch),h('span',{class:'muted'},' · กรอกจำนวนถังเฉพาะ Line ที่มีการเติม (เว้นว่าง = ไม่เติม)'),
      RM_LINES[ch].map(line=>h('div',{class:'bt'},h('span',{},line),
        h('input',{type:'number',min:1,step:1,placeholder:'ถัง',value:st.data[ch][line],oninput:e=>{st.data[ch][line]=e.target.value;}}),'ถัง')));
  }
  function drawSum(){
    const pick=(ch,line,s)=>st.rows.filter(r=>r.chemical===ch&&r.line===line&&(!s||r.shift===s));
    const txt=(ch,rs)=>!rs.length?'-':(ch==='MDI'?rs.length+' batch / ':'')+rs.reduce((a,r)=>a+r.tanks,0)+' ถัง';
    const trs=[];
    Object.keys(RM_LINES).forEach(ch=>RM_LINES[ch].forEach(line=>trs.push(h('tr',{},
      h('td',{},ch+' '+line),
      RM_SHIFTS.map(s=>h('td',{},txt(ch,pick(ch,line,s)))),
      h('td',{},h('b',{},txt(ch,pick(ch,line))))))));
    sumBox.replaceChildren(h('h4',{},'สรุปของวันที่ '+thD(st.date)),
      h('div',{class:'tw'},h('table',{class:'tb sumtb'},
        h('thead',{},h('tr',{},['สาร / Line',...RM_SHIFTS,'รวมวัน'].map(t=>h('th',{},t)))),
        h('tbody',{},trs))));
  }
  function draw(){
    const dIn=h('input',{type:'date',value:st.date,max:todayStr(),onchange:e=>{if(e.target.value){st.date=e.target.value;load();}}});
    const tabs=h('div',{class:'bar'},RM_SHIFTS.map(s=>h('button',{class:'btn'+(s===st.shift?'':' sec'),onclick:()=>{st.shift=s;fill();draw();}},s)));
    const save=rec?h('button',{class:'btn ok',onclick:()=>busy(save,async()=>{
      await api('rawmat.save',{date:st.date,shift:st.shift,data:st.data,comment:st.comment});
      toast('บันทึกกะ '+st.shift+' แล้ว');await load();
    })},'บันทึกกะ '+st.shift):null;
    body.replaceChildren(
      h('div',{class:'bar'},h('b',{},'วันที่'),dIn),
      tabs,
      rec?null:viewNote('Raw Material'),
      st.exists&&rec?h('p',{class:'note'},'มีข้อมูลของกะนี้แล้ว การบันทึกจะแทนที่ข้อมูลเดิม'):null,
      h('fieldset',{disabled:!rec,style:'border:0;padding:0;margin:0;min-width:0'},
        mdiCard(),simpleCard('CE'),simpleCard('GA'),
        h('div',{class:'fg'},h('label',{},'Comment'),h('textarea',{value:st.comment,oninput:e=>{st.comment=e.target.value;}})),
        save));
    drawSum();
  }
  async function load(){
    body.replaceChildren(h('p',{},'กำลังโหลด...'));
    const r=await api('rawmat.day',{date:st.date});
    st.rows=r.rows;st.tpb=r.tanks_per_batch;fill();draw();
  }
  m.replaceChildren(h('h3',{},'Raw Mat Record'),body,sumBox);
  await load();
}

// ================= RCY Record =================
const RCY_LINES=['Line#1','Line#3'];
async function rcyPage(m){
  const st={date:todayStr(),line:'Line#1',kg:450,steps:[],comment:'',exists:false};
  const rec=canRecord('RCY');
  const form=h('div'),recent=h('div');
  const dIn=h('input',{type:'date',value:st.date,max:todayStr(),onchange:e=>{if(e.target.value){st.date=e.target.value;load();}}});
  const lSel=sel(RCY_LINES,st.line,v=>{st.line=v;load();});
  const nextNo=()=>1+Math.max(0,...st.steps.map(s=>+s.batch_no||0));
  const openBatch=()=>{
    for(let i=st.steps.length-1;i>=0;i--){
      const s=st.steps[i];
      if(s.step==='Cut'&&s.batch_no&&!st.steps.some((t,j)=>j>i&&t.step==='Mix'&&String(t.batch_no)===String(s.batch_no)))return String(s.batch_no);
    }
    return '';
  };

  function draw(){
    const chain=h('b',{}),info=h('span',{class:'muted'}),list=h('div');
    const upd=()=>{
      chain.textContent=st.line+': '+(st.steps.map(s=>s.step).join(' ⇒ ')||'-');
      const nums=new Set(st.steps.filter(s=>s.batch_no).map(s=>String(s.batch_no)));
      const kg=st.steps.filter(s=>s.step==='Cut'&&s.batch_no).reduce((a,s)=>a+(+s.qty_kg||0),0);
      info.textContent=' · '+nums.size+' batch · '+kg+' kg';
    };
    const drawList=()=>list.replaceChildren(st.steps.map((s,i)=>h('div',{class:'rs'},
      h('b',{},(i+1)+'.'),
      sel(['Cut','Mix'],s.step,v=>{s.step=v;upd();}),
      h('input',{type:'number',min:1,step:1,placeholder:'batch #',value:s.batch_no,oninput:e=>{s.batch_no=e.target.value;upd();}}),
      h('input',{type:'number',min:0,step:'any',placeholder:'kg',value:s.qty_kg,oninput:e=>{s.qty_kg=e.target.value;upd();}}),'kg',
      h('button',{class:'btn sec',onclick:()=>{if(i>0){[st.steps[i-1],st.steps[i]]=[st.steps[i],st.steps[i-1]];drawList();upd();}}},'↑'),
      h('button',{class:'btn sec',onclick:()=>{if(i<st.steps.length-1){[st.steps[i+1],st.steps[i]]=[st.steps[i],st.steps[i+1]];drawList();upd();}}},'↓'),
      h('button',{class:'btn bad',onclick:()=>{st.steps.splice(i,1);drawList();upd();}},'×'))));
    const add=step=>{
      const b=step==='Cut'?String(nextNo()):openBatch();
      st.steps.push({step:step,batch_no:b,qty_kg:b?st.kg:''});
      drawList();upd();
    };
    const addBatch=()=>{
      const n=String(nextNo());
      st.steps.push({step:'Cut',batch_no:n,qty_kg:st.kg},{step:'Mix',batch_no:n,qty_kg:st.kg});
      drawList();upd();
    };
    const save=rec?h('button',{class:'btn ok',onclick:()=>busy(save,async()=>{
      await api('rcy.save',{date:st.date,line:st.line,comment:st.comment,steps:st.steps});
      toast('บันทึกแล้ว');await load();await loadRecent();
    })},'บันทึก'):null;
    drawList();upd();
    form.replaceChildren(
      rec?null:viewNote('RCY'),
      st.exists&&rec?h('p',{class:'note'},'มีข้อมูลของวันนี้และ Line นี้แล้ว การบันทึกจะแทนที่ข้อมูลเดิม'):null,
      h('fieldset',{disabled:!rec,style:'border:0;padding:0;margin:0;min-width:0'},
        h('div',{class:'card'},
          h('div',{},chain,info),
          h('p',{class:'muted'},'1 batch ต้องมี Cut แล้วตามด้วย Mix · ค่าเริ่มต้น '+st.kg+' kg ต่อ batch · Mix ที่ต่อจากของวันก่อนเว้นเลข batch ได้'),
          list,
          h('div',{class:'bar'},
            h('button',{class:'btn',onclick:addBatch},'+ Batch (Cut ⇒ Mix)'),
            h('button',{class:'btn sec',onclick:()=>add('Cut')},'+ Cut'),
            h('button',{class:'btn sec',onclick:()=>add('Mix')},'+ Mix')),
          h('div',{class:'fg'},h('label',{},'Comment'),h('textarea',{value:st.comment,oninput:e=>{st.comment=e.target.value;}})),
          save)));
  }
  async function load(){
    form.replaceChildren(h('p',{},'กำลังโหลด...'));
    const r=await api('rcy.get',{date:st.date,line:st.line});
    st.kg=r.kg_per_batch;st.exists=!!r.record;st.comment=r.record?r.record.comment:'';
    st.steps=r.steps.map(s=>({step:s.step,batch_no:s.batch_no?String(s.batch_no):'',qty_kg:s.qty_kg}));
    draw();
  }
  async function loadRecent(){
    const rows=await api('rcy.recent');
    recent.replaceChildren(
      h('div',{class:'tw'},h('table',{class:'tb'},
        h('thead',{},h('tr',{},['วันที่','Line','ลำดับงาน','Batch','kg','ผู้บันทึก'].map(t=>h('th',{},t)))),
        h('tbody',{},rows.map(r=>h('tr',{class:'click',onclick:()=>{st.date=r.date;st.line=r.line;dIn.value=r.date;lSel.value=r.line;load();}},
          h('td',{},thD(r.date)),h('td',{},r.line),h('td',{},r.chain),h('td',{},r.batches),h('td',{},r.kg),h('td',{},r.operator)))))),
      rows.length?null:h('p',{class:'muted'},'ยังไม่มีข้อมูล'));
  }
  m.replaceChildren(h('h3',{},'RCY Record'),
    h('div',{class:'bar'},h('b',{},'วันที่'),dIn,h('b',{},'Line'),lSel),
    form,
    h('h4',{},'บันทึกล่าสุด (กดเพื่อดู'+(rec?'/แก้ไข':'')+')'),
    recent);
  await load();await loadRecent();
}

// ================= เริ่มต้น =================
S.token&&S.user?go(homePage()):loginView();
