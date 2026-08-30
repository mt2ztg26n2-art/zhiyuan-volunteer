/* ============================================================================
 *  宣汉职校 · 志愿服务智慧管理平台 —— 业务模块（单机版）
 *  服务加分 / 报表 / 审核 / 活动 / 任务 / 新闻 / 数据 / 部门独立 / 设置换届
 * ========================================================================== */

'use strict';

/* ============================== 服务与加分 ============================== */
let _svPage=1;
function renderService(root){
  root.innerHTML=`
    <div class="search-bar">
      <div class="field"><div class="l">姓名 / 身份证</div><input id="svKw" placeholder="搜索"></div>
      <div class="field"><div class="l">专业部</div><select id="svDept"><option value="">全部</option>${(DB.dictionaries.departments||[]).map(d=>`<option>${d}</option>`).join('')}</select></div>
      <div class="field"><div class="l">班级</div><select id="svCls"><option value="">全部</option></select></div>
      <div class="field"><div class="l">开始日期</div><input id="svStart" type="date"></div>
      <div class="field"><div class="l">结束日期</div><input id="svEnd" type="date"></div>
      <div class="btns"><button onclick="serviceSearch()">查 询</button><button class="ghost" onclick="serviceReset()">重 置</button></div>
    </div>
    <div class="page-block">${blockHead('志愿服务记录（共 <span id="svCount">0</span> 条）',(canEdit()?'<button onclick="openServiceForm()">录入服务</button><button class="ghost" onclick="openBatchServiceForm()">批量录入</button>':'')+'<button class="ghost" onclick="exportServiceList()">导出 Excel</button>')}
      <div class="block-body"><div class="tbl-shell scroll-x"><table class="tbl" id="serviceTable"></table></div><div class="pager" id="servicePager"></div></div>
    </div>
    <div class="tip-line">时长由开始/结束时间自动计算；签到成功的服务记录自动同步到档案。加分规则见「加分报表」。</div>`;
  serviceSearch();
  $('#svDept').onchange=()=>{const list=(DB.dictionaries.classes[$('#svDept').value]||[]);$('#svCls').innerHTML='<option value="">全部</option>'+list.map(c=>`<option>${c}</option>`).join('')};
}
function serviceReset(){$('#svKw').value='';$('#svDept').value='';$('#svCls').innerHTML='<option value="">全部</option>';$('#svStart').value='';$('#svEnd').value='';serviceSearch()}
function serviceSearch(){
  const kw=$('#svKw').value.trim().toLowerCase(),dept=$('#svDept').value,cls=$('#svCls').value,start=$('#svStart').value,end=$('#svEnd').value;
  let list=DB.services.slice();
  list=list.filter(passFilter);
  if(kw)list=list.filter(s=>(s.name||'').toLowerCase().includes(kw)||(s.idCard||'').toLowerCase().includes(kw)||(s.activity||'').toLowerCase().includes(kw));
  if(dept)list=list.filter(s=>s.dept===dept);if(cls)list=list.filter(s=>s.cls===cls);
  if(start)list=list.filter(s=>s.startDT.slice(0,10)>=start);if(end)list=list.filter(s=>s.startDT.slice(0,10)<=end);
  list.sort((a,b)=>String(b.startDT).localeCompare(String(a.startDT)));
  const pageSize=15,total=list.length,pages=Math.max(1,Math.ceil(total/pageSize));
  if(_svPage>pages)_svPage=pages;
  const pageList=list.slice((_svPage-1)*pageSize,_svPage*pageSize);
  $('#svCount').textContent=total;
  $('#serviceTable').innerHTML=`<thead><tr><th>序号</th><th>活动名称</th><th>专业部</th><th>班级</th><th>姓名</th><th>开始</th><th>结束</th><th>时长(h)</th><th>地点</th><th>负责人</th><th>来源</th><th>操作</th></tr></thead><tbody>${pageList.length?pageList.map((s,i)=>{const idx=(i+1)+(_svPage-1)*pageSize;return`<tr><td class="ctr">${idx}</td><td>${esc(s.activity)}</td><td>${esc(s.dept)}</td><td>${esc(s.cls)}</td><td>${esc(s.name)}</td><td class="nowrap">${esc(s.startDT)}</td><td class="nowrap">${esc(s.endDT)}</td><td class="ctr">${durationHours(s.startDT,s.endDT)}</td><td>${s.location?`<span style="display:inline-flex;align-items:center;gap:5px;">${esc(s.location)}<button style="height:20px;padding:0 7px;font-size:11px;background:#fff;color:var(--red);box-shadow:0 0 0 1px var(--red) inset;" onclick="openMap(this.dataset.a)" data-a="${esc(s.location)}">导航</button></span>`:'-'}</td><td>${esc(s.serviceBy||'-')}</td><td><span class="tag ${s.recordType==='signin'?'ok':'gray'}">${s.recordType==='signin'?'签到':'录入'}</span></td><td><div class="ops-col">${canEdit()?`<button onclick="openServiceForm('${s.id}')">编辑</button><button class="warn" onclick="delService('${s.id}')">删除</button>`:'-'}</div></td></tr>`}).join(''):'<tr><td colspan="12" class="empty">—— 暂无数据 ——</td></tr>'}</tbody>`;
  $('#servicePager').innerHTML=`<button onclick="svPage(${_svPage-1})" ${_svPage<=1?'disabled':''}>< 上一页</button><span class="info">第 ${_svPage} / ${pages} 页</span><button onclick="svPage(${_svPage+1})" ${_svPage>=pages?'disabled':''}>下一页 ></button>`;
}
function svPage(p){_svPage=p;serviceSearch()}

window.delService=(id)=>confirmDialog('确认删除该条服务记录？',()=>{DB.services=DB.services.filter(s=>s.id!==id);saveDB();serviceSearch();toast('已删除','ok')});
window.openServiceForm=function(existing){
  const s=existing?DB.services.find(x=>x.id===existing):null,isEdit=!!s;
  openModal(`<div class="modal wide"><div class="modal-title"><span class="bar"></span>${isEdit?'编辑服务':'录入服务'}<span class="bar"></span><button class="x" data-close-modal>×</button></div><div class="modal-body"><div class="form-grid cols-2">
    <label>活动名称<i>*</i><input id="sfAct" value="${esc(s?.activity||'')}" placeholder="如：五四诵唱比赛志愿服务"></label>
    <label>专业部<select id="sfDept"><option value="">-</option>${(DB.dictionaries.departments||[]).map(d=>`<option ${s?.dept===d?'selected':''}>${d}</option>`).join('')}</select></label>
    <label>班级（文本直接输入）<input id="sfCls" value="${esc(s?.cls||'')}" placeholder="如：2024级计算机5班（格式：XXXX级专业XX班）"></label>
    <label>姓名<i>*</i><input id="sfName" value="${esc(s?.name||'')}" placeholder="参与人姓名"></label>
    <label>身份证号<input id="sfIdCard" maxlength="18" value="${esc(s?.idCard||'')}" placeholder="选填，用于档案关联"></label>
    <label>天数（自定义）<input id="sfDays" type="number" value="${s?.days||1}" min="1"></label>
    <label>开始时间<i>*</i><input id="sfStart" type="datetime-local" value="${esc(s?.startDT||'')}"></label>
    <label>结束时间<i>*</i><input id="sfEnd" type="datetime-local" value="${esc(s?.endDT||'')}"></label>
    <label>服务地点<input id="sfLoc" value="${esc(s?.location||'')}" placeholder="如：校体育馆"></label>
    <label>负责人<input id="sfBy" value="${esc(s?.serviceBy||currentUser?.name||'')}"></label>
    <label>时长（自动计算）<input id="sfDur" value="${durationHours(s?.startDT,s?.endDT)}" disabled></label>
    <label class="full">备注<textarea id="sfNote">${esc(s?.note||'')}</textarea></label>
  </div></div><div class="modal-foot"><button class="ghost" data-close-modal>取消</button><button class="primary" id="sfSave">${isEdit?'保存':'录入'}</button></div></div>`);
  const upd=()=>{$('#sfDur').value=durationHours($('#sfStart').value,$('#sfEnd').value)};
  $('#sfStart').onchange=upd;$('#sfEnd').onchange=upd;
  $('#sfSave').onclick=()=>{
    const activity=$('#sfAct').value.trim(),name=$('#sfName').value.trim(),start=$('#sfStart').value,end=$('#sfEnd').value;
    if(!activity||!name||!start||!end)return toast('请填写完整','err');
    const o={activity,name,idCard:$('#sfIdCard').value,dept:$('#sfDept').value,cls:$('#sfCls').value,days:parseInt($('#sfDays').value)||1,startDT:start,endDT:end,location:$('#sfLoc').value,serviceBy:$('#sfBy').value,note:$('#sfNote').value,recordType:'manual'};
    if(isEdit)Object.assign(s,o);else DB.services.push(Object.assign({id:uid('s'),createdAt:now()},o));
    saveDB();closeModal();if(currentRoute()==='service')serviceSearch();toast('已保存','ok');
  };
};
window.openBatchServiceForm=function(){
  openModal(`<div class="modal wide"><div class="modal-title"><span class="bar"></span>批量录入服务<span class="bar"></span><button class="x" data-close-modal>×</button></div><div class="modal-body">
    <p class="warn">从已有档案勾选成员，统一填写活动/时间/天数，批量生成服务记录。</p>
    <div class="form-grid cols-3">
      <label>活动名称<i>*</i><input id="bfAct"></label>
      <label>专业部<select id="bfDept"><option value="">全部</option>${(DB.dictionaries.departments||[]).map(d=>`<option>${d}</option>`).join('')}</select></label>
      <label>班级<select id="bfCls"><option value="">全部</option></select></label>
      <label>开始时间<i>*</i><input id="bfStart" type="datetime-local"></label>
      <label>结束时间<i>*</i><input id="bfEnd" type="datetime-local"></label>
      <label>天数<input id="bfDays" type="number" value="1" min="1"></label>
      <label>服务地点<input id="bfLoc"></label>
      <label>负责人<input id="bfBy" value="${esc(currentUser?.name||'')}"></label>
    </div>
    <div class="tip-line mt-12" id="bfMemberCount">未选择成员</div>
    <div class="scroll-x" style="max-height:260px;overflow:auto;"><table class="tbl" id="bfTable"></table></div>
  </div><div class="modal-foot"><button class="ghost" data-close-modal>取消</button><button class="primary" id="bfSave">批量录入</button></div></div>`);
  const selected=new Set();
  const renderMembers=()=>{
    let list=DB.users.filter(u=>u.role!=='dev'&&u.activated!==false);
    const dept=$('#bfDept').value,cls=$('#bfCls').value;
    if(dept)list=list.filter(u=>u.dept===dept);if(cls)list=list.filter(u=>u.cls===cls);
    $('#bfMemberCount').textContent=`已选 ${selected.size} 人 / 共 ${list.length} 人`;
    $('#bfTable').innerHTML=`<thead><tr><th><input type="checkbox" id="bfAll"></th><th>姓名</th><th>专业部</th><th>班级</th><th>身份证</th></tr></thead><tbody>${list.map(u=>`<tr><td class="ctr"><input type="checkbox" class="bf-cb" value="${u.id}" ${selected.has(u.id)?'checked':''}></td><td>${esc(u.name)}</td><td>${esc(u.dept)}</td><td>${esc(u.cls)}</td><td>${esc(u.idCard)}</td></tr>`).join('')}</tbody>`;
    $$('.bf-cb').forEach(cb=>cb.onchange=()=>{if(cb.checked)selected.add(cb.value);else selected.delete(cb.value);$('#bfMemberCount').textContent=`已选 ${selected.size} 人`});
    $('#bfAll').onchange=(e)=>{$$('.bf-cb').forEach(cb=>{cb.checked=e.target.checked;if(cb.checked)selected.add(cb.value);else selected.delete(cb.value)});$('#bfMemberCount').textContent=`已选 ${selected.size} 人`};
  };
  renderMembers();
  $('#bfDept').onchange=()=>{const list=(DB.dictionaries.classes[$('#bfDept').value]||[]);$('#bfCls').innerHTML='<option value="">全部</option>'+list.map(c=>`<option>${c}</option>`).join('');renderMembers()};
  $('#bfCls').onchange=renderMembers;
  $('#bfSave').onclick=()=>{
    const activity=$('#bfAct').value.trim(),start=$('#bfStart').value,end=$('#bfEnd').value;
    if(!activity||!start||!end)return toast('请填写活动与起止时间','err');
    if(!selected.size)return toast('请勾选成员','err');
    let cnt=0;[...selected].forEach(id=>{const u=DB.users.find(x=>x.id===id);if(!u)return;DB.services.push({id:uid('s'),activity,name:u.name,idCard:u.idCard,dept:u.dept,cls:u.cls,days:parseInt($('#bfDays').value)||1,startDT:start,endDT:end,location:$('#bfLoc').value,serviceBy:$('#bfBy').value,recordType:'manual',createdAt:now()});cnt++});
    saveDB();closeModal();if(currentRoute()==='service')serviceSearch();toast(`批量录入 ${cnt} 条`,'ok');
  };
};
window.exportServiceList=function(){
  const rows=DB.services.map(s=>({'活动':s.activity,'专业部':s.dept,'班级':s.cls,'姓名':s.name,'身份证号':s.idCard,'开始':s.startDT,'结束':s.endDT,'时长(h)':durationHours(s.startDT,s.endDT),'地点':s.location,'负责人':s.serviceBy}));
  const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'服务记录');XLSX.writeFile(wb,`志愿服务记录_${today()}.xlsx`);toast('已导出','ok');
};

/* ============================== 加分报表 ============================== */
function renderReports(root){
  const rules=DB.rules;
  root.innerHTML=`
    <div class="page-block">${blockHead('报表参数','<button onclick="reportsQuery()">生成报表</button><button class="ghost" onclick="exportReportExcel()">导出 Excel</button><button class="ghost" onclick="exportReportPDF()">导出 PDF</button>')}
      <div class="block-body"><div class="form-grid cols-3">
        <label>开始日期<input id="rpStart" type="date" value="${today()}"></label>
        <label>结束日期<input id="rpEnd" type="date" value="${today()}"></label>
        <label>专业部（留空=全部）<select id="rpDept"><option value="">全部</option>${(DB.dictionaries.departments||[]).map(d=>`<option>${d}</option>`).join('')}</select></label>
        <label>每参与人次分值（班级分=人次×分值×天数）<input id="rpScore" type="number" step="0.1" value="${rules.scorePerPerson}"></label>
        <label>部级分值（专业部总分=Σ班级分×部级分值）<input id="rpDeptMul" type="number" step="0.1" value="${rules.deptMultiplier}"></label>
      </div></div>
    </div>
    <div class="tip-line">报表<b>不做合并</b>（避免同名活动乱码）：逐条展示服务记录，并按专业部 / 班级汇总加分（班级分=Σ(分值×天数)，部级分=Σ班级分×部级分值）。</div>
    <div id="rpResult"></div>`;
  reportsQuery();
}
let _lastReport=null;
function reportsQuery(){
  const start=$('#rpStart').value,end=$('#rpEnd').value,dept=$('#rpDept').value;
  const score=parseFloat($('#rpScore').value)||0.1,mul=parseFloat($('#rpDeptMul').value)||0.5;
  const rows=DB.services.filter(s=>(!start||s.startDT.slice(0,10)>=start)&&(!end||s.startDT.slice(0,10)<=end)&&(!dept||s.dept===dept)&&passFilter(s));
  rows.sort((a,b)=>String(b.startDT).localeCompare(String(a.startDT)));
  const byClass={};
  rows.forEach(s=>{const k=`${s.dept}||${s.cls}`;if(!byClass[k])byClass[k]={dept:s.dept,cls:s.cls,personTimes:0,classScore:0};const sc=(s.days||1)*score;byClass[k].personTimes++;byClass[k].classScore+=sc});
  const classList=Object.values(byClass).map(c=>({dept:c.dept,cls:c.cls,personTimes:c.personTimes,classScore:+c.classScore.toFixed(2)}));
  const byDept={};
  classList.forEach(c=>{if(!byDept[c.dept])byDept[c.dept]={dept:c.dept,classScore:0,classCount:0};byDept[c.dept].classScore+=c.classScore;byDept[c.dept].classCount++});
  const deptList=Object.values(byDept).map(d=>({dept:d.dept,classCount:d.classCount,classScore:+d.classScore.toFixed(2),deptScore:+(d.classScore*mul).toFixed(2)}));
  _lastReport={start,end,dept,score,mul,rows,classList,deptList};
  const box=$('#rpResult');
  if(!rows.length){box.innerHTML='<div class="empty-tip">所选日期范围内暂无服务记录</div>';return}
  box.innerHTML=`<div class="report-shell page-block">
    <div class="meta-line"><h1>志愿服务加分报表<small>${esc(DB.school)} · ${esc(DB.period)} · ${esc(start)} 至 ${esc(end)}${dept?(' · '+esc(dept)):''}</small></h1><div class="stamp">生成时间：${fmtDateTime(now())}<br>单次加分=分值×天数 · 班级分=Σ(分值×天数) · 部级分=Σ班级分×${mul}</div></div>
    <table><thead><tr><th>序号</th><th>专业部</th><th>班级</th><th>姓名</th><th>活动名称</th><th>天数</th><th>单次加分</th><th>负责人</th><th>日期</th></tr></thead><tbody>${rows.map((s,i)=>`<tr><td class="ctr">${i+1}</td><td>${esc(s.dept)}</td><td>${esc(s.cls)}</td><td>${esc(s.name)}</td><td>${esc(s.activity)}</td><td class="ctr">${s.days||1}</td><td class="r">${((s.days||1)*score).toFixed(2)}</td><td>${esc(s.serviceBy||'-')}</td><td class="nowrap">${esc(s.startDT)}</td></tr>`).join('')}</tbody></table>
    <table><thead><tr><th>专业部</th><th>班级</th><th>参与人次</th><th>班级总分</th></tr></thead><tbody>${classList.map(c=>`<tr><td>${esc(c.dept)}</td><td>${esc(c.cls)}</td><td class="ctr">${c.personTimes}</td><td class="r"><b>${c.classScore}</b></td></tr>`).join('')}</tbody></table>
    <table><thead><tr><th>专业部</th><th>班级数</th><th>Σ班级总分</th><th>专业部总分</th></tr></thead><tbody>${deptList.map(d=>`<tr><td>${esc(d.dept)}</td><td class="ctr">${d.classCount}</td><td class="r">${d.classScore}</td><td class="r"><b>${d.deptScore}</b></td></tr>`).join('')}</tbody></table>
    <div class="footer-line"><span>制表：${esc(currentUser.name)}</span><span>审核：________</span><span>${esc(DB.league)}</span></div>
  </div>`;
}
window.exportReportExcel=function(){
  if(!_lastReport)return toast('请先生成报表','err');
  const {classList,deptList,start,end}=_lastReport;
  const wb=XLSX.utils.book_new();
  const cs=XLSX.utils.aoa_to_sheet([['专业部','班级','参与人次','班级总分'],...classList.map(c=>[c.dept,c.cls,c.personTimes,c.classScore])]);
  XLSX.utils.book_append_sheet(wb,cs,'班级总分');
  const ds=XLSX.utils.aoa_to_sheet([['专业部','班级数','Σ班级总分','专业部总分'],...deptList.map(d=>[d.dept,d.classCount,d.classScore,d.deptScore])]);
  XLSX.utils.book_append_sheet(wb,ds,'专业部总分');
  XLSX.writeFile(wb,`加分报表_${start}_${end}.xlsx`);toast('已导出 Excel','ok');
};
window.exportReportPDF=function(){
  if(!_lastReport)return toast('请先生成报表','err');
  const {classList,deptList,start,end,score,mul}=_lastReport;
  const P=window.CanvasPDF;P.init();
  P.center('志愿服务加分报表',P.y,{size:20,bold:true,color:'#c8161d'});P.y+=8;
  P.center(DB.school+' · '+DB.period+' · '+start+' 至 '+end,P.y,{size:11,color:'#5a5a5a'});P.y+=6;
  P.line(56,P.y,P.W-56,P.y,'#c8161d',1);P.y+=16;
  P.text('一、班级总分明细',56,P.y,{size:13,bold:true,color:'#c8161d'});P.y+=8;
  P.table(['专业部','班级','参与人次','班级总分'],classList.map(c=>[c.dept,c.cls,c.personTimes,c.classScore]),[150,190,110,120],{size:10});
  P.y+=12;
  P.text('二、专业部总分',56,P.y,{size:13,bold:true,color:'#c8161d'});P.y+=8;
  P.table(['专业部','班级数','Σ班级总分','专业部总分'],deptList.map(d=>[d.dept,d.classCount,d.classScore,d.deptScore]),[150,110,160,150],{size:10});
  P.y+=16;
  P.text('班级分=人次×'+score+'×天数 · 部级分=Σ班级分×'+mul,56,P.y,{size:10,color:'#5a5a5a'});P.y+=18;
  P.text('制表：'+currentUser.name,56,P.y,{size:11});P.text('审核：________',P.W-200,P.y,{size:11});
  P.save('加分报表_'+start+'_'+end+'.pdf');toast('已导出 PDF','ok');
};

/* ============================== 审核中心（统一待办：注册审核 + 名额申请审核） ============================== */
function renderAudit(root){
  const pending=DB.users.filter(u=>u.pending);
  const qs=(DB.quotas||[]).filter(q=>q.status==='recommend'||q.status==='review');
  root.innerHTML=`
    <div class="notice-strip"><span class="label">审核中心</span><span class="ct">统一待办中心：注册审核 + 团员名额申请审核，手机端提交的注册会自动实时同步到这里，审核结果自动通知本人</span></div>
    <div class="stat-row">
      <div class="stat-card"><div class="stat-label">待审核注册</div><div class="stat-value">${pending.length}<span class="unit">人</span></div></div>
      <div class="stat-card"><div class="stat-label">待审名额申请</div><div class="stat-value">${qs.length}<span class="unit">件</span></div></div>
      <div class="stat-card"><div class="stat-label">注册总数</div><div class="stat-value">${DB.users.length}<span class="unit">人</span></div></div>
      <div class="stat-card"><div class="stat-label">累计申请</div><div class="stat-value">${(DB.quotas||[]).length}<span class="unit">件</span></div></div>
    </div>
    <div class="search-bar"><div class="field"><div class="l">身份证号</div><input id="adId" maxlength="18"></div><div class="field"><div class="l">姓名</div><input id="adName"></div><div class="btns"><button onclick="auditQuery()">查 询</button><button class="ghost" onclick="zySyncRegs(true)">同步云端注册</button></div></div>
    <div class="row-2">
      <div class="page-block">${blockHead('待审核注册（'+pending.length+'）','')}<div class="block-body" id="adPending"></div></div>
      <div class="page-block">${blockHead('待审团员名额申请（'+qs.length+'）','')}<div class="block-body" id="adQuota"></div></div>
    </div>
    <div class="page-block">${blockHead('审核查询结果','')}<div class="block-body" id="adResult"><div class="empty-tip">输入身份证号 + 姓名查询档案</div></div></div>`;
  renderAuditPending();
  renderAuditQuota();
  /* 自动拉取云端注册（手机端提交的）合并进审核中心 */
  zySyncRegs(false);
}
/* 拉取 Supabase 注册队列并合并进本地待审核（手机注册 → 电脑端审核，零配置自动同步） */
window.zySyncRegs=async function(silent){
  try{
    if(!window.ZYReg) return;
    const res=await ZYReg.listAll();
    if(!res.ok){ if(!silent) toast('云端注册拉取失败：'+(res.msg||''),'err'); return; }
    let added=0, first='';
    (res.list||[]).forEach(r=>{
      const d=r.data||{};
      if(!d.idCard||!d.name) return;
      if(DB.users.some(u=>u.idCard===d.idCard)) return; // 已存在（含已处理）跳过
      const next=(DB.nextIds.user=(DB.nextIds.user||0)+1);
      DB.users.push({id:'u-'+next,idCard:d.idCard,pwd:'',role:'member',org:d.org||'青年志愿者协会',name:d.name,gender:d.gender||'',birth:d.birth||'',nation:d.nation||'',politics:d.politics||'',religion:d.religion||'',school:d.school||'',dept:d.dept||'',cls:d.cls||'',grade:(window.deriveGrade?deriveGrade(d.cls):'')||'',phone:d.phone||'',email:d.email||'',qq:d.qq||'',wechat:d.wechat||'',native:d.native||'',addr:d.addr||'',title:d.title||'青年志愿者',avatar:d.avatar||'',exp:d.exp||'',position:'志愿者',activated:false,pending:true,createdAt:d.createdAt||now(),_cloudRegId:r.id});
      added++; if(!first) first=d.name;
    });
    if(added){
      saveDB();
      /* 通知红点 + 审核/档案界面实时联动 */
      if(window.pushNotify) pushNotify({to:'超级管理员',kind:'audit',title:'新注册待审核',content:(first||'有学员')+' 提交注册申请，请到审核中心处理'});
      if(window.updateNotifyBadge) updateNotifyBadge();
      const rt=window.currentRoute?currentRoute():'';
      if(rt==='audit'&&window.renderAudit&&$('#viewRoot')) renderAudit($('#viewRoot'));
      else if(rt==='files'&&window.filesSearch) filesSearch();
      if(!silent) toast('已同步 '+added+' 条云端注册','ok');
    }
    else if(!silent) toast('云端无新注册','ok');
  }catch(e){ if(!silent) toast('云端注册同步异常：'+e.message,'err'); }
};
function renderAuditPending(){
  const pending=DB.users.filter(u=>u.pending),t=$('#adPending');
  if(!pending.length){t.innerHTML='<div class="empty-tip">暂无待审核注册，新注册提交后会自动出现在这里</div>';return}
  t.innerHTML=pending.map(u=>`<div style="padding:12px 14px;background:#fff;margin-bottom:10px;border-radius:2px;"><div style="display:flex;justify-content:space-between;"><b>${esc(u.name)}</b><span class="tag warn">待审核</span></div><div class="f12 c-3 mt-8">身份证：${esc(u.idCard)} · ${esc(u.dept||'-')} · ${esc(u.cls||'-')} · ${esc(u.org||'-')}</div><div class="f12 c-3">电话：${esc(u.phone||'-')} · 提交：${esc(fmtDateTime(u.createdAt))}</div><div class="mt-8" style="display:flex;gap:6px;"><button class="primary" style="height:28px;padding:0 14px;" onclick="auditApprove('${u.id}')">审核通过</button><button class="warn" style="height:28px;padding:0 14px;" onclick="auditRejectUser('${u.id}')">驳回</button><button class="ghost" style="height:28px;padding:0 14px;" onclick="viewFile('${u.id}')">查看档案</button></div></div>`).join('');
}
function renderAuditQuota(){
  const qs=(DB.quotas||[]).filter(q=>q.status==='recommend'||q.status==='review'),t=$('#adQuota');
  if(!qs.length){t.innerHTML='<div class="empty-tip">暂无待审名额申请，提交申请后会自动出现在这里</div>';return}
  t.innerHTML=qs.map(q=>`<div style="padding:12px 14px;background:#fff;margin-bottom:10px;border-radius:2px;"><div style="display:flex;justify-content:space-between;"><b>${esc(q.name)}</b><span class="tag ${q.status==='review'?'':'warn'}">${q.status==='review'?'待审核':'待送审'}</span></div><div class="f12 c-3 mt-8">${esc(q.kind||'推荐')} · ${esc(q.dept||'-')} / ${esc(q.cls||'-')} · 提交 ${esc(fmtDateTime(q.createdAt))}</div><div class="f12 c-3">事由：${esc(q.reason||'-')}</div>${(q.trace||[]).length?`<div class="trace mt-8">${q.trace.map(t=>`<span class="trace-dot ${t.st}"></span>${esc(t.act)}·${esc((t.time||'').slice(5,16))}`).join(' ')}</div>`:''}<div class="mt-8" style="display:flex;gap:6px;">${q.status==='recommend'?`<button style="height:28px;padding:0 14px;" onclick="quotaSubmit('${q.id}')">送审</button>`:''}<button class="primary" style="height:28px;padding:0 14px;" onclick="quotaApprove('${q.id}')">通过</button><button class="warn" style="height:28px;padding:0 14px;" onclick="quotaReject('${q.id}')">驳回</button></div></div>`).join('');
}
window.auditApprove=(id)=>{const u=DB.users.find(x=>x.id===id);if(u){const before={pending:!!u.pending,activated:!!u.activated,status:u.status};u.activated=true;u.pending=false;u.status=u.status||'正常在岗';saveDB();pushNotify({to:u.name,kind:'sys',title:'注册审核通过',content:`${u.name}，您的志愿者注册已通过审核，现在可以使用账号登录。`});pushLog('审核','通过 '+u.name+' 的注册');pushTrace('审核通过','注册: '+u.name+' ('+u.idCard+')',before,{pending:false,activated:true,status:u.status});/* 云端：写入审核状态 + 删除已处理注册条目 */if(window.ZYStatus)ZYStatus.set(u.idCard,'approved');if(window.ZYReg&&u._cloudRegId)ZYReg.remove(u._cloudRegId);if(window.ZY)ZY.push();renderAuditPending();toast('已审核通过','ok')}};
window.auditRejectUser=(id)=>{const u=DB.users.find(x=>x.id===id);if(!u)return;confirmDialog(`确认驳回 <b>${esc(u.name)}</b> 的注册申请？`,()=>{const before={pending:!!u.pending,activated:!!u.activated};u.pending=false;u.activated=false;saveDB();pushNotify({to:u.name,kind:'sys',title:'注册审核驳回',content:`${u.name}，您的注册申请未通过审核，请联系团委管理员。`});pushLog('审核','驳回 '+u.name+' 的注册');pushTrace('审核驳回','注册: '+u.name+' ('+u.idCard+')',before,{pending:false,activated:false});if(window.ZYStatus)ZYStatus.set(u.idCard,'rejected');if(window.ZYReg&&u._cloudRegId)ZYReg.remove(u._cloudRegId);if(window.ZY)ZY.push();renderAuditPending();toast('已驳回','ok')},'驳回注册')};
window.auditQuery=()=>{
  const id=$('#adId').value.trim(),name=$('#adName').value.trim();
  if(!id||!name)return toast('请同时输入身份证号和姓名','err');
  const u=DB.users.find(x=>x.idCard===id&&x.name===name),t=$('#adResult');
  if(!u){t.innerHTML='<div class="empty-tip">未找到匹配档案</div>';return}
  const sv=DB.services.filter(s=>s.idCard===id),total=sv.reduce((s,x)=>s+durationHours(x.startDT,x.endDT),0).toFixed(1);
  t.innerHTML=`<div class="kv"><div><div class="l">姓名</div><div class="v">${esc(u.name)}</div></div><div><div class="l">身份证号</div><div class="v">${esc(u.idCard)}</div></div><div><div class="l">专业部 / 班级</div><div class="v">${esc(u.dept||'-')} / ${esc(u.cls||'-')}</div></div><div><div class="l">部门 / 职位</div><div class="v">${esc(u.org||'-')} / ${esc(roleLabel(u.role))}</div></div><div><div class="l">服务次数</div><div class="v">${sv.length} 次</div></div><div><div class="l">累计时长</div><div class="v">${total} 小时</div></div><div><div class="l">状态</div><div class="v">${u.activated?'已激活':'未激活'}</div></div><div><div class="l">注册时间</div><div class="v">${esc(fmtDateTime(u.createdAt))}</div></div></div><div class="mt-12" style="display:flex;gap:6px;"><button class="ghost" style="height:30px;padding:0 14px;" onclick="viewFile('${u.id}')">查看档案</button><button class="primary" style="height:30px;padding:0 14px;" onclick="exportCertPDF('${u.id}')">导出 PDF</button>${u.pending?`<button class="primary" style="height:30px;padding:0 14px;background:var(--success);" onclick="auditApprove('${u.id}')">审核通过</button>`:''}</div>`;
};

/* ============================== 活动中心（筛选 + 卡片 + 事件委托） ============================== */
let _actFilter={kw:'',st:''};
function renderActivities(root){
  const f=_actFilter;
  let list=DB.activities.slice().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  if(f.kw)list=list.filter(a=>(a.title||'').toLowerCase().includes(f.kw.toLowerCase()));
  if(f.st)list=list.filter(a=>(a.status==='open'?'招募中':'已结束')===f.st);
  root.innerHTML=`
    <div class="search-bar">
      <div class="field"><div class="l">活动名称</div><input id="acKw" placeholder="搜索" value="${esc(f.kw)}"></div>
      <div class="field"><div class="l">状态</div><select id="acSt"><option value="">全部</option><option ${f.st==='招募中'?'selected':''}>招募中</option><option ${f.st==='已结束'?'selected':''}>已结束</option></select></div>
      <div class="btns"><button onclick="actSearch()">查 询</button><button class="ghost" onclick="actReset()">重 置</button></div>
    </div>
    <div class="page-block">${blockHead('志愿活动（含报名 + 签到 · 共 '+list.length+' 场）',(canEdit()?'<button onclick="openActivityForm()">发布活动</button>':'')+'<button class="ghost" onclick="exportActivities()">导出 Excel</button>')}
      <div class="block-body"><div class="act-grid" id="actGrid"></div></div>
    </div>`;
  const grid=$('#actGrid');
  grid.innerHTML=list.map(a=>actCardHtml(a)).join('')||'<div class="empty-tip">暂无活动，点击「发布活动」创建</div>';
  grid.onclick=(e)=>{
    const b=e.target.closest('[data-ao]');if(!b)return;
    const id=b.dataset.a,op=b.dataset.ao;
    if(op==='signup')actSignup(id);else if(op==='checkin')actCheckin(id);else if(op==='qr')showActQR(id);else if(op==='map')openActMap(id);else if(op==='signinmgr')openActSignin(id);else if(op==='list')viewActSignups(id);else if(op==='edit')openActivityForm(id);else if(op==='del')delActivity(id);
  };
  $('#acKw').onkeydown=e=>{if(e.key==='Enter')actSearch()};
}
function actCardHtml(a){
  const nowD=now(),sg=a.signin||{};
  const inSignin=!!(sg.start&&sg.end&&nowD>=sg.start&&nowD<=sg.end);
  const sgWin=(sg.start&&sg.end)?sg.start.slice(5,16)+'~'+sg.end.slice(5,16):(sg.start||sg.end||'-');
  const isOpen=a.status==='open';
  const btn=(op,label,cls)=>`<button ${cls?'class="'+cls+'"':''} data-a="${a.id}" data-ao="${op}">${label}</button>`;
  const ops=`${isOpen?btn('signup','我要报名','fill'):''}${inSignin?btn('checkin','活动签到','ok'):''}${btn('qr','二维码')}${btn('map','地图导航')}${canEdit()?btn('signinmgr','签到管理','ok')+btn('list','报名名单')+btn('edit','编辑')+`<button class="warn" data-a="${a.id}" data-ao="del">删除</button>`:''}`;
  return `<div class="act-card"><div class="top"><div class="ti">${esc(a.title)}</div><span class="tag ${isOpen?'ok':'gray'}">${isOpen?'招募中':'已结束'}</span></div><div class="act-cover">${(a.covers&&a.covers[0]&&a.covers[0].dataUrl)?`<img src="${a.covers[0].dataUrl}">`:'<div class="cover-empty">暂无活动图</div>'}</div><div class="meta"><span>时间 ${esc(a.startDT)}</span><span>地点 ${esc(a.location)}</span><span>主办 ${esc(a.organizer)}</span></div><div class="desc">${esc(a.intro||'')}</div><div class="meta"><span>已报名 ${(a.signups||[]).length}/${a.need||0}</span><span>签到 ${esc(sgWin)}</span></div><div class="ops">${ops}</div></div>`;
}
window.actSearch=()=>{_actFilter.kw=$('#acKw').value.trim();_actFilter.st=$('#acSt').value;renderActivities($('#viewRoot'))};
window.actReset=()=>{_actFilter={kw:'',st:''};renderActivities($('#viewRoot'))};
window.openActivityForm=function(existing){
  const a=existing?DB.activities.find(x=>x.id===existing):null,isEdit=!!a;
  window._afCovers=(a&&a.covers&&a.covers.length)?a.covers.slice():[];
  openModal(`<div class="modal wide"><div class="modal-title"><span class="bar"></span>${isEdit?'编辑活动':'发布活动'}<span class="bar"></span><button class="x" data-close-modal>×</button></div><div class="modal-body"><div class="form-grid cols-2">
    <label class="full">活动名称<i>*</i><input id="afTitle" value="${esc(a?.title||'')}"></label>
    <label>开始时间<i>*</i><input id="afStart" type="datetime-local" value="${esc(a?.startDT||'')}"></label>
    <label>结束时间<i>*</i><input id="afEnd" type="datetime-local" value="${esc(a?.endDT||'')}"></label>
    <label>活动地点<i>*</i><input id="afLoc" value="${esc(a?.location||'')}"></label>
    <label>主办组织<input id="afOrg" value="${esc(a?.organizer||currentUser?.org||'')}"></label>
    <label>招募人数<input id="afNeed" type="number" value="${a?.need||0}" min="0"></label>
    <label>签到开始<input id="afSgStart" type="datetime-local" value="${esc(a?.signin?.start||'')}"></label>
    <label>签到结束<input id="afSgEnd" type="datetime-local" value="${esc(a?.signin?.end||'')}"></label>
    <label class="full">活动介绍<textarea id="afIntro">${esc(a?.intro||'')}</textarea></label>
    <label class="full">活动封面图（可多张）<input id="afCover" type="file" accept="image/*" multiple><div id="afCoverPreview" class="gallery mt-8"></div></label>
  </div></div><div class="modal-foot"><button class="ghost" data-close-modal>取消</button><button class="primary" id="afSave">${isEdit?'保存':'发布'}</button></div></div>`);
  if(a&&a.covers&&a.covers.length)$('#afCoverPreview').innerHTML=a.covers.map(c=>c.dataUrl?`<div class="g-item"><img src="${c.dataUrl}"></div>`:'').join('');
  $('#afCover').onchange=(ev)=>{const files=Array.from(ev.target.files);Promise.all(files.map(f=>new Promise(r=>{const rd=new FileReader();rd.onload=()=>r({name:f.name,dataUrl:rd.result});rd.readAsDataURL(f)}))).then(arr=>{window._afCovers=arr;$('#afCoverPreview').innerHTML=arr.map(c=>`<div class="g-item"><img src="${c.dataUrl}"></div>`).join('')})};
  $('#afSave').onclick=()=>{
    const title=$('#afTitle').value.trim(),start=$('#afStart').value,end=$('#afEnd').value,loc=$('#afLoc').value;
    if(!title||!start||!end||!loc)return toast('请填写完整','err');
    const o={title,startDT:start,endDT:end,location:loc,organizer:$('#afOrg').value,need:parseInt($('#afNeed').value)||0,intro:$('#afIntro').value,signin:{start:$('#afSgStart').value,end:$('#afSgEnd').value}};
    if(window._afCovers&&window._afCovers.length)o.covers=window._afCovers;
    if(isEdit)Object.assign(a,o);else DB.activities.unshift(Object.assign({id:uid('a'),status:'open',signups:[],createdBy:currentUser.name,createdAt:now()},o));
    pushNotify({to:'all',kind:'act',title:'新活动发布',content:`《${title}》已发布，请在「活动中心」报名`});saveDB();if(window.ZY)ZY.push();closeModal();if(currentRoute()==='activities')renderActivities($('#viewRoot'));toast('已发布','ok');
  };
};
window.delActivity=(id)=>confirmDialog('确认删除该活动？',()=>{DB.activities=DB.activities.filter(a=>a.id!==id);saveDB();renderActivities($('#viewRoot'));toast('已删除','ok')});

/* ============================== 活动签到：自动同步到服务记录 ============================== */
function syncServiceFromSignin(act,signup){
  /* 签到后 → 自动写入服务记录。
     规则：若参与人已在 DB.users 中（有档案），自动补齐 dept/cls/org；
          若系统没有该参与人档案，仅记 name+idCard（待管理员去「服务与加分」手动补 dept/cls） */
  const u=DB.users.find(x=>x.idCard===signup.idCard);
  const dur=durationHours(act.startDT,act.endDT);
  const has=u?!!(u.dept||u.cls):false;
  DB.services=DB.services||[];
  const dup=DB.services.find(s=>s.activity===act.title && s.idCard===signup.idCard);
  if(dup){toast('该参与人已有服务记录，未重复添加','err');return;}
  DB.services.unshift({
    id:uid('s'),
    name:signup.name, idCard:signup.idCard,
    dept:u?u.dept:'', cls:u?u.cls:'', org:act.organizer||(u?u.org:''),
    activity:act.title, startDT:act.startDT, endDT:act.endDT, duration:dur,
    location:act.location, serviceBy:currentUser.name, signinAt:now(), sourceAct:act.id,
    incomplete:!has
  });
}
function inSigninWindow(act){
  if(!act.signin)return false;
  const nowD=new Date().getTime();
  const sD=act.signin.start?new Date(act.signin.start).getTime():0;
  const eD=act.signin.end?new Date(act.signin.end).getTime():0;
  if(sD&&nowD<sD)return false;
  if(eD&&nowD>eD)return false;
  return true;
}
window.actCheckin=function(id){
  const a=DB.activities.find(x=>x.id===id);if(!a)return;
  if(!inSigninWindow(a))return toast('当前不在签到时间窗内','err');
  if(!currentUser.idCard)return toast('您的账号缺少身份证号，请到「我的档案」补录','err');
  if((a.signups||[]).some(s=>s.idCard===currentUser.idCard)){
    /* 已经报名过的活动可签到 */
  }else{
    /* 未报名也可临时签到（常见于没提前报名的志愿者） */
    a.signups=a.signups||[];a.signups.push({name:currentUser.name,idCard:currentUser.idCard,cls:currentUser.cls||'',dept:currentUser.dept||'',phone:currentUser.phone||'',time:now()});
  }
  DB.signinRecs=DB.signinRecs||[];
  if(DB.signinRecs.find(r=>r.actId===id&&r.idCard===currentUser.idCard))return toast('您已签到','err');
  const me=a.signups.find(s=>s.idCard===currentUser.idCard);
  DB.signinRecs.push({id:uid('sn'),actId:id,name:me.name,idCard:me.idCard,signinAt:now(),by:currentUser.name});
  syncServiceFromSignin(a,me);
  saveDB();pushLog('活动签到',`签到「${a.title}」`);
  toast('签到成功，已自动同步到服务记录','ok');
  renderActivities($('#viewRoot'));
};
window.openActSignin=function(id){
  const a=DB.activities.find(x=>x.id===id);if(!a)return;
  const signups=a.signups||[];const signed=(DB.signinRecs||[]).filter(r=>r.actId===id);
  const win=inSigninWindow(a);
  openModal(`<div class="modal wide"><div class="modal-title"><span class="bar"></span>签到管理 · ${esc(a.title)}<span class="bar"></span><button class="x" data-close-modal>×</button></div><div class="modal-body">
    <div class="tip-line">活动时间 ${esc(a.startDT)} ~ ${esc(a.endDT)}<br>签到时间窗：${esc(a.signin?.start||'-')} ~ ${esc(a.signin?.end||'-')}（${win?'<b style="color:#2a8a3a">当前在签到窗内</b>':'<b style="color:#a30e16">当前不在签到窗内</b>'}）<br>已签到 <b>${signed.length}</b> / ${signups.length} 人 · 签到后系统自动把该参与人信息同步到「服务与加分」服务记录</div>
    <table class="tbl mt-12"><thead><tr><th style="width:40px">#</th><th>姓名</th><th>身份证号</th><th>专业部/班级</th><th>报名时间</th><th>签到状态</th><th style="width:120px">操作</th></tr></thead><tbody>
    ${signups.length?signups.map((s,i)=>{
      const sg=signed.find(r=>r.idCard===s.idCard);
      const u=DB.users.find(x=>x.idCard===s.idCard);
      return `<tr><td class="ctr">${i+1}</td><td><b>${esc(s.name)}</b></td><td>${esc((s.idCard||'').slice(0,6))}****${esc((s.idCard||'').slice(-4))}</td><td>${esc(s.dept||u?.dept||'-')} / ${esc(s.cls||u?.cls||'-')}</td><td>${esc((s.time||'').slice(0,16))}</td><td>${sg?'<span class="tag ok">已签到 '+esc((sg.signinAt||'').slice(11,16))+'</span>':'<span class="tag warn">未签到</span>'}</td><td>${sg?'<span class="f12 c-3">已自动同步服务</span>':(!win?'<span class="f12 c-3">签到窗未到</span>':`<button class="primary" style="height:26px;padding:0 10px;" onclick="actCheckinFor('${a.id}',${i})">代签</button>`)}</td></tr>`;
    }).join(''):'<tr><td colspan="7" class="empty-tip">暂无报名人员</td></tr>'}
    </tbody></table>
    <div class="tip-line mt-12">若参与人在系统内有档案（DB.users），签到后自动带齐专业部/班级/部门写入服务记录；<br>若<b>未建档</b>，服务记录只记姓名+身份证号，专业部/班级为空待管理员在「服务与加分」手动补录。</div>
  </div><div class="modal-foot"><button class="ghost" data-close-modal>关闭</button></div></div>`);
};
window.actCheckinFor=function(actId,idx){
  const a=DB.activities.find(x=>x.id===actId);if(!a)return;
  if(!inSigninWindow(a))return toast('当前不在签到时间窗内','err');
  const s=(a.signups||[])[idx];if(!s)return;
  DB.signinRecs=DB.signinRecs||[];
  if(DB.signinRecs.find(r=>r.actId===actId&&r.idCard===s.idCard))return toast('该参与人已签到','err');
  DB.signinRecs.push({id:uid('sn'),actId,name:s.name,idCard:s.idCard,signinAt:now(),by:currentUser.name});
  syncServiceFromSignin(a,s);
  saveDB();pushLog('活动签到',`代签「${a.title}」/ ${s.name}`);pushTrace('代签','活动: '+a.title+' / '+s.name,{signed:false},{signed:true});
  openActSignin(actId);toast(`已代签 ${s.name}，服务记录已同步`,'ok');
};
window.actSignup=(id)=>{
  const a=DB.activities.find(x=>x.id===id);if(!a)return;
  openModal(`<div class="modal" style="width:440px;"><div class="modal-title"><span class="bar"></span>活动报名 · ${esc(a.title)}<span class="bar"></span><button class="x" data-close-modal>×</button></div><div class="modal-body"><div class="form-grid">
    <label>姓名<i>*</i><input id="sgName" value="${esc(currentUser.name)}"></label>
    <label>身份证号<i>*</i><input id="sgId" value="${esc(currentUser.idCard)}" maxlength="18"></label>
    <label>专业部<select id="sgDept"><option value="">-</option>${(DB.dictionaries.departments||[]).map(d=>`<option ${currentUser.dept===d?'selected':''}>${d}</option>`).join('')}</select></label>
    <label>班级<input id="sgCls" value="${esc(currentUser.cls||'')}" placeholder="如：2024级计算机5班（格式：XXXX级专业XX班）"></label>
    <label class="full">联系电话<input id="sgPhone" value="${esc(currentUser.phone||'')}"></label>
  </div></div><div class="modal-foot"><button class="ghost" data-close-modal>取消</button><button class="primary" id="sgSubmit">提交报名</button></div></div>`);
  $('#sgSubmit').onclick=()=>{
    const name=$('#sgName').value.trim(),idCard=$('#sgId').value.trim();
    if(!name||!isIDCard(idCard))return toast('请填写正确的姓名和身份证号','err');
    a.signups=a.signups||[];
    if(a.signups.some(s=>s.idCard===idCard))return toast('您已报名该活动','err');
    a.signups.push({name,idCard,cls:$('#sgCls').value,dept:$('#sgDept').value,phone:$('#sgPhone').value,time:now()});
    pushNotify({to:'会 长',kind:'act',title:'活动报名',content:`${name} 报名了《${a.title}》`});
    pushNotify({to:'副 会 长',kind:'act',title:'活动报名',content:`${name} 报名了《${a.title}》`});
    pushNotify({to:'超级管理员',kind:'act',title:'活动报名',content:`${name} 报名了《${a.title}》`});
    saveDB();if(window.ZY)ZY.push();closeModal();renderActivities($('#viewRoot'));toast('报名成功','ok');
  };
};
window.actCheckin=(id)=>{
  const a=DB.activities.find(x=>x.id===id);if(!a)return;
  openModal(`<div class="modal" style="width:440px;"><div class="modal-title"><span class="bar"></span>活动签到 · ${esc(a.title)}<span class="bar"></span><button class="x" data-close-modal>×</button></div><div class="modal-body"><div class="tip-line">仅在签到时段内可签到，签到成功后自动同步为服务记录。</div><div class="form-grid">
    <label>姓名<i>*</i><input id="ckName" value="${esc(currentUser.name)}"></label>
    <label>身份证号<i>*</i><input id="ckId" value="${esc(currentUser.idCard)}" maxlength="18"></label>
    <label>专业部<select id="ckDept"><option value="">-</option>${(DB.dictionaries.departments||[]).map(d=>`<option ${currentUser.dept===d?'selected':''}>${d}</option>`).join('')}</select></label>
    <label>班级<input id="ckCls" value="${esc(currentUser.cls||'')}" placeholder="如：2024级计算机5班（格式：XXXX级专业XX班）"></label>
    <label class="full">签到位置<input id="ckLoc" placeholder="如：校体育馆"></label>
  </div></div><div class="modal-foot"><button class="ghost" data-close-modal>取消</button><button class="primary" id="ckSubmit">确认签到</button></div></div>`);
  $('#ckSubmit').onclick=()=>{
    const name=$('#ckName').value.trim(),idCard=$('#ckId').value.trim();
    if(!name||!isIDCard(idCard))return toast('请填写正确的姓名和身份证号','err');
    const nowD=now(),sg=a.signin||{};
    if(sg.start&&nowD<sg.start)return toast('尚未到签到时段','err');
    if(sg.end&&nowD>sg.end)return toast('签到时段已结束','err');
    DB.services.push({id:uid('s'),dept:$('#ckDept').value,cls:$('#ckCls').value,name,idCard,activity:a.title,startDT:a.startDT,endDT:a.endDT,days:1,location:$('#ckLoc').value||a.location,serviceBy:a.organizer,recordType:'signin',createdAt:now()});
    pushLog('签到',`${name} 签到《${a.title}》，服务已同步`);
    saveDB();closeModal();renderActivities($('#viewRoot'));toast('签到成功，服务已同步','ok');
  };
};
window.viewActSignups=(id)=>{
  const a=DB.activities.find(x=>x.id===id);if(!a)return;const list=a.signups||[];
  openModal(`<div class="modal"><div class="modal-title"><span class="bar"></span>报名名单 · ${esc(a.title)}<span class="bar"></span><button class="x" data-close-modal>×</button></div><div class="modal-body"><table class="tbl"><thead><tr><th>序号</th><th>姓名</th><th>专业部</th><th>班级</th><th>时间</th></tr></thead><tbody>${list.length?list.map((s,i)=>`<tr><td>${i+1}</td><td>${esc(s.name)}</td><td>${esc(s.dept)}</td><td>${esc(s.cls)}</td><td>${esc(fmtDateTime(s.time))}</td></tr>`).join(''):'<tr><td colspan="5" class="empty">暂无报名</td></tr>'}</tbody></table></div><div class="modal-foot"><button class="ghost" data-close-modal>关闭</button><button class="primary" onclick="exportActSignups('${id}')">导出名单</button></div></div>`);
};
window.exportActSignups=(id)=>{const a=DB.activities.find(x=>x.id===id);const ws=XLSX.utils.json_to_sheet((a.signups||[]).map((s,i)=>({'序号':i+1,'姓名':s.name,'专业部':s.dept,'班级':s.cls,'时间':s.time})));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'报名名单');XLSX.writeFile(wb,`${a.title}_报名名单.xlsx`);toast('已导出','ok')};
window.exportActivities=function(){const rows=DB.activities.map(a=>({'活动':a.title,'开始':a.startDT,'结束':a.endDT,'地点':a.location,'主办':a.organizer,'招募':a.need,'已报名':(a.signups||[]).length,'状态':a.status}));const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'活动');XLSX.writeFile(wb,`活动列表_${today()}.xlsx`);toast('已导出','ok')};

window.showActQR=function(id){
  const a=DB.activities.find(x=>x.id===id);if(!a)return;
  $('#qrDrawer').hidden=false;
  const info=`活动报名|${a.title}|${a.startDT}|${a.location}`;
  $('#qrBody').innerHTML=`<div class="qr-box"><div class="qr-hint">扫描二维码，向管理员登记报名以下活动</div><div class="qr-target">${esc(a.title)}</div><div class="qr-canvas" id="qrCanvas"></div><div class="qr-meta">地点：${esc(a.location)} · 开始：${esc(a.startDT)}<br>（单机版：扫码内容为报名登记信息）</div></div>`;
  const q=qrcode(0,'M');q.addData(info);q.make();$('#qrCanvas').innerHTML=q.createImgTag(6,10);
};

/* ============================== 任务中心 ============================== */
function renderTasks(root){
  root.innerHTML=`
    <div class="page-block">${blockHead('任务中心（报名 + 已读 + 二维码）',(canEdit()?'<button onclick="openTaskForm()">发布任务</button>':'')+'<button class="ghost" onclick="exportTasks()">导出 Excel</button>')}
      <div class="block-body"><div class="act-grid">${DB.tasks.map(t=>{const meRead=(t.reads||[]).includes(currentUser.name);const meSigned=(t.signups||[]).some(s=>s.idCard===currentUser.idCard);const nd=now(),inSg=t.signin&&t.signin.start&&t.signin.end&&nd>=t.signin.start&&nd<=t.signin.end;return`<div class="act-card"><div class="top"><div class="ti">${esc(t.title)}</div><span class="tag ${t.status==='open'?'ok':'gray'}">${t.status==='open'?'进行中':'已结束'}</span></div><div class="meta"><span>${esc(t.type||'任务')}</span><span>发布：${esc(t.publisher)}</span></div><div class="meta"><span>时间：${esc(t.startDT)} ~ ${esc(t.endDT)}</span></div>${t.signin&&t.signin.start?`<div class="meta"><span>签到时段：${esc(t.signin.start.slice(5,16))} ~ ${esc(t.signin.end.slice(5,16))}</span></div>`:''}<div class="desc">${esc(t.intro||'')}</div><div class="meta"><span>已读 ${(t.reads||[]).length} 人</span><span>已报名 ${(t.signups||[]).length} 人</span></div><div class="ops"><button class="fill" onclick="taskSignup('${t.id}')">${meSigned?'已报名':'我要报名'}</button>${inSg?`<button class="ok" onclick="taskCheckin('${t.id}')">任务签到</button>`:''}<button class="ok" onclick="taskRead('${t.id}')">${meRead?'已读':'标记已读'}</button><button onclick="showTaskQR('${t.id}')">二维码</button>${canEdit()?`<button onclick="viewTaskSignups('${t.id}')">名单</button><button onclick="openTaskForm('${t.id}')">编辑</button><button class="warn" onclick="delTask('${t.id}')">删除</button>`:''}</div></div>`}).join('')||'<div class="empty-tip">暂无任务</div>'}</div></div>
    </div>`;
}
window.openTaskForm=function(existing){
  const t=existing?DB.tasks.find(x=>x.id===existing):null,isEdit=!!t;
  openModal(`<div class="modal wide"><div class="modal-title"><span class="bar"></span>${isEdit?'编辑任务':'发布任务'}<span class="bar"></span><button class="x" data-close-modal>×</button></div><div class="modal-body"><div class="form-grid cols-2">
    <label class="full">任务标题<i>*</i><input id="tfTitle" value="${esc(t?.title||'')}"></label>
    <label>类型<select id="tfType"><option ${t?.type==='任务'?'selected':''}>任务</option><option ${t?.type==='活动'?'selected':''}>活动</option></select></label>
    <label>发布人<input id="tfPub" value="${esc(t?.publisher||(currentUser.title?currentUser.title+' ':'')+currentUser.name)}"></label>
    <label>开始时间<i>*</i><input id="tfStart" type="datetime-local" value="${esc(t?.startDT||'')}"></label>
    <label>结束时间<i>*</i><input id="tfEnd" type="datetime-local" value="${esc(t?.endDT||'')}"></label>
    <label class="full">任务说明<textarea id="tfIntro">${esc(t?.intro||'')}</textarea></label>
    <label>签到开始（可留空）<input id="tfSgStart" type="datetime-local" value="${esc(t?.signin?.start||'')}"></label>
    <label>签到结束（可留空）<input id="tfSgEnd" type="datetime-local" value="${esc(t?.signin?.end||'')}"></label>
  </div></div><div class="modal-foot"><button class="ghost" data-close-modal>取消</button><button class="primary" id="tfSave">${isEdit?'保存':'发布'}</button></div></div>`);
  $('#tfSave').onclick=()=>{
    const title=$('#tfTitle').value.trim(),start=$('#tfStart').value,end=$('#tfEnd').value;
    if(!title||!start||!end)return toast('请填写完整','err');
    const o={title,type:$('#tfType').value,publisher:$('#tfPub').value,startDT:start,endDT:end,intro:$('#tfIntro').value,signin:{start:$('#tfSgStart').value,end:$('#tfSgEnd').value}};
    if(isEdit)Object.assign(t,o);else DB.tasks.unshift(Object.assign({id:uid('t'),status:'open',reads:[],signups:[],createdAt:now()},o));
    pushNotify({to:'all',kind:'task',title:'新任务发布',content:`《${title}》已发布，请在「任务中心」查看`});saveDB();if(window.ZY)ZY.push();closeModal();if(currentRoute()==='tasks')renderTasks($('#viewRoot'));toast('已发布','ok');
  };
};
window.delTask=(id)=>confirmDialog('确认删除该任务？',()=>{DB.tasks=DB.tasks.filter(t=>t.id!==id);saveDB();renderTasks($('#viewRoot'));toast('已删除','ok')});
window.taskRead=(id)=>{const t=DB.tasks.find(x=>x.id===id);if(t){t.reads=t.reads||[];if(!t.reads.includes(currentUser.name))t.reads.push(currentUser.name);saveDB();renderTasks($('#viewRoot'));toast('已标记已读','ok')}};
window.taskSignup=(id)=>{
  const t=DB.tasks.find(x=>x.id===id);if(!t)return;
  openModal(`<div class="modal" style="width:440px;"><div class="modal-title"><span class="bar"></span>任务报名 · ${esc(t.title)}<span class="bar"></span><button class="x" data-close-modal>×</button></div><div class="modal-body"><div class="form-grid">
    <label>姓名<i>*</i><input id="tkName" value="${esc(currentUser.name)}"></label>
    <label>专业部<select id="tkDept"><option value="">-</option>${(DB.dictionaries.departments||[]).map(d=>`<option ${currentUser.dept===d?'selected':''}>${d}</option>`).join('')}</select></label>
    <label>班级<input id="tkCls" value="${esc(currentUser.cls||'')}" placeholder="如：2024级计算机5班（格式：XXXX级专业XX班）"></label>
    <label>联系电话<input id="tkPhone" value="${esc(currentUser.phone||'')}"></label>
    <label class="full">报名说明<textarea id="tkNote"></textarea></label>
  </div></div><div class="modal-foot"><button class="ghost" data-close-modal>取消</button><button class="primary" id="tkSubmit">提交报名</button></div></div>`);
  $('#tkSubmit').onclick=()=>{
    const name=$('#tkName').value.trim();if(!name)return toast('请填写姓名','err');
    t.signups=t.signups||[];
    if(t.signups.some(s=>s.idCard===currentUser.idCard))return toast('您已报名该任务','err');
    t.signups.push({name,idCard:currentUser.idCard,cls:$('#tkCls').value,dept:$('#tkDept').value,phone:$('#tkPhone').value,note:$('#tkNote').value,time:now()});
    pushNotify({to:'会 长',kind:'task',title:'任务报名',content:`${name} 报名了《${t.title}》`});
    pushNotify({to:'副 会 长',kind:'task',title:'任务报名',content:`${name} 报名了《${t.title}》`});
    pushNotify({to:'超级管理员',kind:'task',title:'任务报名',content:`${name} 报名了《${t.title}》`});
    saveDB();if(window.ZY)ZY.push();closeModal();renderTasks($('#viewRoot'));toast('报名成功，已同步至会长/副会长/超管','ok');
  };
};
window.taskCheckin=(id)=>{
  const t=DB.tasks.find(x=>x.id===id);if(!t)return;
  const nd=now(),sg=t.signin||{};
  if(sg.start&&nd<sg.start)return toast('尚未到签到时段','err');
  if(sg.end&&nd>sg.end)return toast('签到时段已结束','err');
  if(DB.services.some(s=>s.idCard===currentUser.idCard&&s.activity===t.title&&s.recordType==='signin'))return toast('您已完成本任务签到','err');
  openModal(`<div class="modal" style="width:440px;"><div class="modal-title"><span class="bar"></span>任务签到 · ${esc(t.title)}<span class="bar"></span><button class="x" data-close-modal>×</button></div><div class="modal-body"><div class="tip-line">签到成功后自动同步为志愿服务记录并计入时长。</div><div class="form-grid">
    <label>姓名<i>*</i><input id="tkCkName" value="${esc(currentUser.name)}"></label>
    <label>身份证号<i>*</i><input id="tkCkId" value="${esc(currentUser.idCard)}" maxlength="18"></label>
    <label>专业部<select id="tkCkDept"><option value="">-</option>${(DB.dictionaries.departments||[]).map(d=>`<option ${currentUser.dept===d?'selected':''}>${d}</option>`).join('')}</select></label>
    <label>班级<input id="tkCkCls" value="${esc(currentUser.cls||'')}" placeholder="如：2024级计算机5班（格式：XXXX级专业XX班）"></label>
    <label class="full">签到位置<input id="tkCkLoc" placeholder="如：校团委办公室"></label>
  </div></div><div class="modal-foot"><button class="ghost" data-close-modal>取消</button><button class="primary" id="tkCkSubmit">确认签到</button></div></div>`);
  $('#tkCkSubmit').onclick=()=>{
    const name=$('#tkCkName').value.trim(),idCard=$('#tkCkId').value.trim();
    if(!name||!isIDCard(idCard))return toast('请填写正确的姓名和身份证号','err');
    DB.services.push({id:uid('s'),dept:$('#tkCkDept').value,cls:$('#tkCkCls').value,name,idCard,activity:t.title,startDT:t.startDT,endDT:t.endDT,days:1,location:$('#tkCkLoc').value||t.intro||'',serviceBy:t.publisher,recordType:'signin',createdAt:now()});
    pushLog('签到',`${name} 任务签到《${t.title}》，服务已同步`);
    saveDB();closeModal();renderTasks($('#viewRoot'));toast('签到成功，服务已同步','ok');
  };
};
window.viewTaskSignups=(id)=>{const t=DB.tasks.find(x=>x.id===id);if(!t)return;const list=t.signups||[];openModal(`<div class="modal"><div class="modal-title"><span class="bar"></span>报名名单 · ${esc(t.title)}<span class="bar"></span><button class="x" data-close-modal>×</button></div><div class="modal-body"><table class="tbl"><thead><tr><th>序号</th><th>姓名</th><th>专业部</th><th>班级</th><th>电话</th><th>说明</th></tr></thead><tbody>${list.length?list.map((s,i)=>`<tr><td>${i+1}</td><td>${esc(s.name)}</td><td>${esc(s.dept)}</td><td>${esc(s.cls)}</td><td>${esc(s.phone||'-')}</td><td>${esc(s.note||'-')}</td></tr>`).join(''):'<tr><td colspan="6" class="empty">暂无报名</td></tr>'}</tbody></table></div><div class="modal-foot"><button class="ghost" data-close-modal>关闭</button></div></div>`)};
window.exportTasks=function(){const rows=DB.tasks.map(t=>({'任务':t.title,'类型':t.type,'发布人':t.publisher,'开始':t.startDT,'结束':t.endDT,'已读':(t.reads||[]).length,'已报名':(t.signups||[]).length}));const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'任务');XLSX.writeFile(wb,`任务列表_${today()}.xlsx`);toast('已导出','ok')};
window.showTaskQR=function(id){
  const t=DB.tasks.find(x=>x.id===id);if(!t)return;
  $('#qrDrawer').hidden=false;
  const info=`任务登记|${t.title}|${t.publisher}`;
  $('#qrBody').innerHTML=`<div class="qr-box"><div class="qr-hint">扫描二维码，向管理员登记报名该任务</div><div class="qr-target">${esc(t.title)}</div><div class="qr-canvas" id="qrCanvas"></div><div class="qr-meta">发布：${esc(t.publisher)}</div></div>`;
  const q=qrcode(0,'M');q.addData(info);q.make();$('#qrCanvas').innerHTML=q.createImgTag(6,10);
};

/* ============================== 新闻 ============================== */
function renderNews(root){
  root.innerHTML=`
    <div class="page-block">${blockHead('新闻·通报',canEdit()?'<button onclick="openNewsForm()">发布新闻/通报</button>':'')}<div class="block-body">${DB.news.length?DB.news.map(n=>`<div class="news-item" style="padding:14px 0;"><div><span class="role-tag ${n.type==='通报'?'super':'member'}">${esc(n.type)}</span> <span class="ti" onclick="openNews('${n.id}')">${esc(n.title)}</span> ${n.priority==='置顶'?'<span class="tag warn">置顶</span>':''}</div><div class="f12 c-3 mt-8">${esc(n.publisher)} · ${esc(fmtDateTime(n.publishedAt))} · 阅读 ${n.reads||0}${(n.photos||[]).length?` · ${n.photos.length} 图`:''}</div><div class="desc">${esc((n.content||'').slice(0,100))}${(n.content||'').length>100?'…':''}</div>${canEdit()?`<div class="mt-8"><button class="ghost" style="height:26px;padding:0 10px;" onclick="openNewsForm('${n.id}')">编辑</button> <button class="ghost" style="height:26px;padding:0 10px;" onclick="delNews('${n.id}')">删除</button></div>`:''}</div>`).join(''):'<div class="empty-tip">暂无新闻</div>'}</div></div>`;
}
window.openNews=(id)=>{const n=DB.news.find(x=>x.id===id);if(!n)return;openModal(`<div class="modal wide"><div class="modal-title"><span class="bar"></span>${esc(n.title)}<span class="bar"></span><button class="x" data-close-modal>×</button></div><div class="modal-body"><div class="f12 c-3 mb-12">${esc(n.publisher)} · ${esc(fmtDateTime(n.publishedAt))} · 阅读 ${n.reads||0}</div><div style="font-size:14px;line-height:2;color:var(--ink-2);white-space:pre-wrap;">${esc(n.content||'')}</div>${(n.photos||[]).length?`<div class="gallery mt-16">${n.photos.map(p=>p.dataUrl?`<div class="g-item"><img src="${p.dataUrl}" onclick="viewImg('${p.dataUrl}')"></div>`:'').join('')}</div>`:''}</div><div class="modal-foot"><button class="ghost" data-close-modal>关闭</button></div></div>`)};
window.viewImg=(src)=>{$('#ivImg').src=src;$('#imgViewer').hidden=false};
window.openNewsForm=function(existing){
  const n=existing?DB.news.find(x=>x.id===existing):null,isEdit=!!n;
  openModal(`<div class="modal wide"><div class="modal-title"><span class="bar"></span>${isEdit?'编辑':'发布新闻/通报'}<span class="bar"></span><button class="x" data-close-modal>×</button></div><div class="modal-body"><div class="form-grid cols-2">
    <label class="full">标题<i>*</i><input id="nfTitle" value="${esc(n?.title||'')}"></label>
    <label>类型<select id="nfType"><option ${n?.type==='通报'?'selected':''}>通报</option><option ${n?.type==='新闻'||!n?'selected':''}>新闻</option></select></label>
    <label>优先级<select id="nfPri"><option>普通</option><option ${n?.priority==='推荐'?'selected':''}>推荐</option><option ${n?.priority==='置顶'?'selected':''}>置顶</option></select></label>
    <label class="full">内容<i>*</i><textarea id="nfContent" style="min-height:160px;">${esc(n?.content||'')}</textarea></label>
    <label class="full">配图（可多张）<input id="nfPhotos" type="file" accept="image/*" multiple><div id="nfPreview" class="gallery mt-8"></div></label>
  </div></div><div class="modal-foot"><button class="ghost" data-close-modal>取消</button><button class="primary" id="nfSave">${isEdit?'保存':'发布'}</button></div></div>`);
  if(n&&n.photos&&n.photos.length)$('#nfPreview').innerHTML=n.photos.map(p=>p.dataUrl?`<div class="g-item"><img src="${p.dataUrl}"></div>`:'').join('');
  $('#nfPhotos').onchange=(ev)=>{const files=Array.from(ev.target.files);Promise.all(files.map(f=>new Promise(r=>{const rd=new FileReader();rd.onload=()=>r({name:f.name,dataUrl:rd.result});rd.readAsDataURL(f)}))).then(arr=>{window._nfPhotos=arr;$('#nfPreview').innerHTML=arr.map(p=>`<div class="g-item"><img src="${p.dataUrl}"></div>`).join('')})};
  $('#nfSave').onclick=()=>{
    const title=$('#nfTitle').value.trim(),content=$('#nfContent').value.trim();
    if(!title||!content)return toast('请填写标题和内容','err');
    const o={title,content,type:$('#nfType').value,priority:$('#nfPri').value};
    if(window._nfPhotos&&window._nfPhotos.length)o.photos=window._nfPhotos;
    if(isEdit)Object.assign(n,o);else DB.news.unshift(Object.assign({id:uid('n'),reads:0,publisher:currentUser.name,publishedAt:now()},o));
    saveDB();closeModal();if(currentRoute()==='news')renderNews($('#viewRoot'));toast('已发布','ok');
  };
};
window.delNews=(id)=>confirmDialog('确认删除该新闻？',()=>{DB.news=DB.news.filter(n=>n.id!==id);saveDB();renderNews($('#viewRoot'));toast('已删除','ok')});

/* ============================== 通知中心 ============================== */
function renderNotify(root){
  root.innerHTML=`<div class="page-block">${blockHead('通知中心','<button onclick="markAllRead()">全部已读</button>')}<div class="block-body" id="notifyPageList"></div></div>`;
  renderNotifyPage();
}
function renderNotifyPage(){
  const box=$('#notifyPageList');const list=DB.notifies.filter(n=>n.to==='all'||n.to===currentUser.name||n.to===roleLabel(currentUser.role));
  if(!list.length){box.innerHTML='<div class="empty-tip">暂无通知</div>';return}
  const routeMap={audit:'audit',act:'activities',task:'tasks',news:'news',sys:'dashboard'};
  box.innerHTML=list.map(n=>{const r=routeMap[n.kind]||'dashboard';return`<div class="notify-item ${n.unread?'unread':''}" onclick="goNotify('${n.id}','${r}')"><div class="ti">${esc(n.title)}<time>${esc(fmtDateTime(n.time))}</time></div><div class="ct">${esc(n.content)}</div><div class="meta"><span>${esc(n.kind)}</span><span class="go">查看详情 ›</span></div></div>`}).join('');
}
window.markAllRead=()=>{DB.notifies.forEach(n=>n.unread=false);saveDB();renderNotifyPage();updateNotifyBadge();toast('已全部标记已读','ok')};

/* ============================== 数据中心 ============================== */
function renderData(root){
  const totalHours=DB.services.reduce((s,x)=>s+durationHours(x.startDT,x.endDT),0);
  root.innerHTML=`
    <div class="stat-row">
      <div class="stat-card"><div class="stat-label">档案总数</div><div class="stat-value">${DB.users.filter(u=>u.role!=='dev').length}<span class="unit">人</span></div></div>
      <div class="stat-card"><div class="stat-label">服务人次</div><div class="stat-value">${DB.services.length}<span class="unit">人次</span></div></div>
      <div class="stat-card"><div class="stat-label">累计时长</div><div class="stat-value">${totalHours.toFixed(1)}<span class="unit">小时</span></div></div>
      <div class="stat-card"><div class="stat-label">活动/任务</div><div class="stat-value">${DB.activities.length}/${DB.tasks.length}<span class="unit">场</span></div></div>
      <div class="stat-card"><div class="stat-label">新闻/通知</div><div class="stat-value">${DB.news.length}/${DB.notifies.length}<span class="unit">条</span></div></div>
    </div>
    <div class="row-2 mb-16">
      <div class="page-block">${blockHead('年度服务日历热力图','')}<div class="block-body" id="heatMain"></div></div>
      <div class="page-block">${blockHead('各专业部服务时长','')}<div class="chart-box"><canvas id="chDataDept"></canvas></div></div>
    </div>
    <div class="row-2 mb-16">
      <div class="page-block">${blockHead('月度服务趋势','')}<div class="chart-box"><canvas id="chDataMonth"></canvas></div></div>
      <div class="page-block">${blockHead('服务时长 TOP 10','')}<div class="block-body" id="dataTop"></div></div>
    </div>
    <div class="page-block">${blockHead('数据导出','<button onclick="exportAllData()">导出全部 Excel</button>')}<div class="block-body"><div class="tip-line">一键导出档案、服务、活动、任务、新闻等全部数据。</div></div></div>`;
  renderHeatmap();drawDataDept();drawDataMonth();drawDataTop();
}
var REDS=['#f5c2c6','#ef9aa0','#e06a72','#d13a44','#c8161d','#a30e16','#8f0a11','#5f0609'];
function drawDataDept(){const el=$('#chDataDept');if(!el)return;const map={};DB.services.forEach(s=>{const h=durationHours(s.startDT,s.endDT);map[s.dept]=(map[s.dept]||0)+h});const labels=Object.keys(map),data=labels.map(l=>+(map[l]||0).toFixed(1));new Chart(el,{type:'pie',data:{labels,datasets:[{data,backgroundColor:REDS,borderWidth:2,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{font:chartFont(),usePointStyle:true,pointStyle:'circle',boxWidth:7,color:'#5a5a5a'}}}}})}
function drawDataMonth(){const el=$('#chDataMonth');if(!el)return;const map={};DB.services.forEach(s=>{const m=s.startDT.slice(0,7);map[m]=(map[m]||0)+1});const labels=Object.keys(map).sort(),data=labels.map(l=>map[l]);new Chart(el,{type:'line',data:{labels,datasets:[{label:'服务人次',data,borderColor:'#c8161d',backgroundColor:'rgba(200,22,29,.08)',fill:true,tension:.35,pointRadius:3,pointBackgroundColor:'#c8161d',pointBorderColor:'#fff',pointBorderWidth:1.5,borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,grid:{color:'#f0f2f5'},ticks:{font:chartFont()}},x:{grid:{display:false},ticks:{font:chartFont()}}}}})}
function drawDataTop(){const t=$('#dataTop');if(!t)return;const map={};DB.services.forEach(s=>{map[s.name]=(map[s.name]||0)+durationHours(s.startDT,s.endDT)});const list=Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,10);if(!list.length){t.innerHTML='<div class="empty-tip">暂无数据</div>';return}const max=list[0][1]||1;t.innerHTML=list.map(([n,h],i)=>`<div style="display:flex;align-items:center;gap:10px;padding:5px 0;"><span style="width:20px;color:var(--red);font-weight:700;">${i+1}</span><span style="width:80px;">${esc(n)}</span><div style="flex:1;height:12px;background:#f0f2f5;border-radius:6px;"><div style="height:100%;background:linear-gradient(90deg,#ef9aa0,#c8161d);width:${(h/max*100).toFixed(0)}%;border-radius:6px;"></div></div><span class="f12 c-3" style="width:70px;text-align:right;">${h.toFixed(1)} h</span></div>`).join('')}
window.renderHeatmap=function(){
  const box=$('#heatMain')||$('#heatBody');if(!box)return;
  const days=365,td=new Date(),counts={};
  for(let i=days-1;i>=0;i--){const d=new Date(td);d.setDate(td.getDate()-i);counts[fmtDate(d)]=0}
  DB.services.forEach(s=>{const k=s.startDT.slice(0,10);if(counts[k]!=null)counts[k]++});
  const year=new Date().getFullYear(),max=Math.max(1,...Object.values(counts));
  const color=v=>v===0?'#f2f3f5':`rgba(200,22,29,${0.18+0.7*(v/max)})`;
  const months=[];
  for(let m=0;m<12;m++){const daysInMonth=new Date(year,m+1,0).getDate(),cells=[];for(let d=1;d<=daysInMonth;d++){const dt=new Date(year,m,d),iso=fmtDate(dt);cells.push({iso,v:counts[iso]||0})}months.push({label:(m+1)+'月',cells})}
  box.innerHTML=`<div class="heat-legend">服务人次分布：少 ${[0.18,0.32,0.46,0.62,0.88].map(p=>`<span class="heat-cell" style="background:rgba(200,22,29,${p});"></span>`).join('')} 多</div><div class="cal-heat">${months.map(mo=>`<div class="cal-month"><div class="cal-mlabel">${mo.label}</div><div class="cal-grid">${mo.cells.map(c=>`<span class="cal-day" style="background:${color(c.v)}" title="${c.iso} · ${c.v} 人次"></span>`).join('')}</div></div>`).join('')}</div>`;
};
window.exportAllData=function(){
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(DB.users.filter(u=>u.role!=='dev').map(u=>({姓名:u.name,身份证号:u.idCard,角色:roleLabel(u.role),专业部:u.dept,班级:u.cls,部门:u.org,电话:u.phone}))),'档案');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(DB.services.map(s=>({活动:s.activity,专业部:s.dept,班级:s.cls,姓名:s.name,开始:s.startDT,结束:s.endDT}))),'服务');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(DB.activities.map(a=>({活动:a.title,开始:a.startDT,结束:a.endDT,地点:a.location}))),'活动');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(DB.tasks.map(t=>({任务:t.title,发布人:t.publisher}))),'任务');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(DB.news.map(n=>({标题:n.title,类型:n.type,发布:n.publisher}))),'新闻');
  XLSX.writeFile(wb,`平台全量数据_${today()}.xlsx`);toast('已导出','ok');
};

/* ============================== 部门独立模块 ============================== */
function deptMembersHtml(org,roleDefault){
  const members=DB.users.filter(u=>u.org===org||u.role===roleDefault);
  if(!members.length)return'<div class="empty-tip">暂无'+org+'成员档案</div>';
  return`<table class="tbl"><thead><tr><th>姓名</th><th>专业部</th><th>班级</th><th>职位</th><th>状态</th><th>操作</th></tr></thead><tbody>${members.map(u=>`<tr><td><b>${esc(u.name)}</b></td><td>${esc(u.dept||'-')}</td><td>${esc(u.cls||'-')}</td><td>${esc(u.title||u.position||'-')}</td><td><span class="tag ${u.pending?'warn':(u.status==='注销'?'gray':(u.activated?'ok':'gray'))}">${u.pending?'待审':(u.status==='注销'?'注销':'在岗')}</span></td><td><div class="ops-col"><button onclick="viewFile('${u.id}')">档案详情</button><button onclick="exportCertPDF('${u.id}')">导出 PDF</button></div></td></tr>`).join('')}</tbody></table>`;
}
function renderBroadcaster(root){
  DB.broadcastRecs=DB.broadcastRecs||[];
  root.innerHTML=`<div class="page-block">${blockHead('广播部 · 广播记录',canEdit()?'<button onclick="openBroadcastForm()">新增广播记录</button>':'')}<div class="block-body"><table class="tbl"><thead><tr><th>日期</th><th>广播主题</th><th>播音员</th><th>时长(分)</th><th>内容概要</th><th>操作</th></tr></thead><tbody>${DB.broadcastRecs.length?DB.broadcastRecs.map(r=>`<tr><td>${esc(r.date||r.createdAt)}</td><td>${esc(r.topic)}</td><td>${esc(r.announcer)}</td><td>${esc(r.minutes)}</td><td>${esc(r.summary||'')}</td><td>${canEdit()?`<button class="warn" onclick="delRec('broadcastRecs','${r.id}')" style="height:26px;padding:0 10px;background:#fff;color:var(--red);box-shadow:0 0 0 1px var(--red) inset;border-radius:2px;">删除</button>`:'-'}</td></tr>`).join(''):'<tr><td colspan="6" class="empty">暂无广播记录</td></tr>'}</tbody></table></div></div><div class="page-block">${blockHead('广播站成员档案','')}<div class="block-body">${deptMembersHtml('广播站','broadcaster')}</div></div>`;
}
window.openBroadcastForm=function(){
  openModal(`<div class="modal"><div class="modal-title"><span class="bar"></span>新增广播记录<span class="bar"></span><button class="x" data-close-modal>×</button></div><div class="modal-body"><div class="form-grid"><label>日期<input id="brDate" type="date" value="${today()}"></label><label>播音员<input id="brAnnouncer" value="${esc(currentUser.name)}"></label><label>广播主题<input id="brTopic"></label><label>时长(分钟)<input id="brMin" type="number" value="30"></label><label class="full">内容概要<textarea id="brSummary"></textarea></label></div></div><div class="modal-foot"><button class="ghost" data-close-modal>取消</button><button class="primary" id="brSave">保存</button></div></div>`);
  $('#brSave').onclick=()=>{const topic=$('#brTopic').value.trim();if(!topic)return toast('请填写广播主题','err');DB.broadcastRecs=DB.broadcastRecs||[];DB.broadcastRecs.unshift({id:uid('br'),date:$('#brDate').value,announcer:$('#brAnnouncer').value,topic,minutes:parseInt($('#brMin').value)||0,summary:$('#brSummary').value,createdAt:now()});saveDB();closeModal();if(currentRoute()==='broadcaster')renderBroadcaster($('#viewRoot'));toast('已保存','ok')};
};

function renderEtiquette(root){
  DB.etiquetteRecs=DB.etiquetteRecs||[];
  root.innerHTML=`<div class="page-block">${blockHead('礼仪队 · 礼仪安排',canEdit()?'<button onclick="openEtiquetteForm()">新增礼仪安排</button>':'')}<div class="block-body"><table class="tbl"><thead><tr><th>日期</th><th>活动/场合</th><th>参与队员</th><th>负责人</th><th>备注</th><th>操作</th></tr></thead><tbody>${DB.etiquetteRecs.length?DB.etiquetteRecs.map(r=>`<tr><td>${esc(r.date||r.createdAt)}</td><td>${esc(r.occasion)}</td><td>${esc(r.members)}</td><td>${esc(r.leader)}</td><td>${esc(r.note||'')}</td><td>${canEdit()?`<button class="warn" onclick="delRec('etiquetteRecs','${r.id}')" style="height:26px;padding:0 10px;background:#fff;color:var(--red);box-shadow:0 0 0 1px var(--red) inset;border-radius:2px;">删除</button>`:'-'}</td></tr>`).join(''):'<tr><td colspan="6" class="empty">暂无礼仪记录</td></tr>'}</tbody></table></div></div><div class="page-block">${blockHead('礼仪队成员档案','')}<div class="block-body">${deptMembersHtml('礼仪队','etiquette')}</div></div>`;
}
window.openEtiquetteForm=function(){
  openModal(`<div class="modal"><div class="modal-title"><span class="bar"></span>新增礼仪安排<span class="bar"></span><button class="x" data-close-modal>×</button></div><div class="modal-body"><div class="form-grid"><label>日期<input id="etDate" type="date" value="${today()}"></label><label>负责人<input id="etLeader" value="${esc(currentUser.name)}"></label><label>活动/场合<input id="etOccasion"></label><label>参与队员<input id="etMembers"></label><label class="full">备注<textarea id="etNote"></textarea></label></div></div><div class="modal-foot"><button class="ghost" data-close-modal>取消</button><button class="primary" id="etSave">保存</button></div></div>`);
  $('#etSave').onclick=()=>{const occ=$('#etOccasion').value.trim();if(!occ)return toast('请填写活动/场合','err');DB.etiquetteRecs=DB.etiquetteRecs||[];DB.etiquetteRecs.unshift({id:uid('et'),date:$('#etDate').value,leader:$('#etLeader').value,occasion:occ,members:$('#etMembers').value,note:$('#etNote').value,createdAt:now()});saveDB();closeModal();if(currentRoute()==='etiquette')renderEtiquette($('#viewRoot'));toast('已保存','ok')};
};

function renderSubleague(root){
  DB.subleagueRecs=DB.subleagueRecs||[];
  root.innerHTML=`<div class="page-block">${blockHead('团副总支 · 组织生活记录',canEdit()?'<button onclick="openSubleagueForm()">新增记录</button>':'')}<div class="block-body"><table class="tbl"><thead><tr><th>日期</th><th>主题</th><th>主持</th><th>参与人数</th><th>内容</th><th>操作</th></tr></thead><tbody>${DB.subleagueRecs.length?DB.subleagueRecs.map(r=>`<tr><td>${esc(r.date||r.createdAt)}</td><td>${esc(r.topic)}</td><td>${esc(r.host)}</td><td>${esc(r.count)}</td><td>${esc(r.content||'')}</td><td>${canEdit()?`<button class="warn" onclick="delRec('subleagueRecs','${r.id}')" style="height:26px;padding:0 10px;background:#fff;color:var(--red);box-shadow:0 0 0 1px var(--red) inset;border-radius:2px;">删除</button>`:'-'}</td></tr>`).join(''):'<tr><td colspan="6" class="empty">暂无记录</td></tr>'}</tbody></table></div></div><div class="page-block">${blockHead('团副总支成员档案','')}<div class="block-body">${deptMembersHtml('团副总支','subleague')}</div></div>`;
}
window.openSubleagueForm=function(){
  openModal(`<div class="modal"><div class="modal-title"><span class="bar"></span>新增组织生活记录<span class="bar"></span><button class="x" data-close-modal>×</button></div><div class="modal-body"><div class="form-grid"><label>日期<input id="slDate" type="date" value="${today()}"></label><label>主持<input id="slHost" value="${esc(currentUser.name)}"></label><label>主题<input id="slTopic"></label><label>参与人数<input id="slCount" type="number" value="0"></label><label class="full">内容<textarea id="slContent"></textarea></label></div></div><div class="modal-foot"><button class="ghost" data-close-modal>取消</button><button class="primary" id="slSave">保存</button></div></div>`);
  $('#slSave').onclick=()=>{const topic=$('#slTopic').value.trim();if(!topic)return toast('请填写主题','err');DB.subleagueRecs=DB.subleagueRecs||[];DB.subleagueRecs.unshift({id:uid('sl'),date:$('#slDate').value,host:$('#slHost').value,topic,count:parseInt($('#slCount').value)||0,content:$('#slContent').value,createdAt:now()});saveDB();closeModal();if(currentRoute()==='subleague')renderSubleague($('#viewRoot'));toast('已保存','ok')};
};
window.delRec=(key,id)=>confirmDialog('确认删除该记录？',()=>{DB[key]=DB[key].filter(r=>r.id!==id);saveDB();renderRoute();toast('已删除','ok')});

/* ============================== 系统设置 + 换届 ============================== */
function renderSettings(root){
  const rules=DB.rules,dict=DB.dictionaries;
  root.innerHTML=`
    <div class="row-2 mb-16">
      <div class="page-block">${blockHead('评分规则','')}<div class="block-body"><div class="form-grid cols-2"><label>每参与人次分值（班级分=人次×分值×天数）<input id="setScore" type="number" step="0.1" value="${rules.scorePerPerson}"></label><label>部级分值（专业部总分=Σ班级分×部级分值）<input id="setMul" type="number" step="0.1" value="${rules.deptMultiplier}"></label></div><div class="tip-line mt-12">修改后自动保存，报表按新规则计算。</div><button class="primary mt-12" style="height:38px;padding:0 24px;" onclick="saveRules()">保存评分规则</button></div></div>
      <div class="page-block">${blockHead('学校信息','')}<div class="block-body"><div class="form-grid cols-2"><label>学校全称<input id="setSchool" value="${esc(DB.school)}"></label><label>学校简称<input id="setSchoolShort" value="${esc(DB.schoolShort)}"></label><label>团委名称<input id="setLeague" value="${esc(DB.league)}"></label><label>期数（如 2026 秋季学期）<input id="setPeriod" value="${esc(DB.period)}"></label><label class="full">高德地图 API Key（可选，地图导航使用）<input id="setAmap" value="${esc(DB.amapKey||'')}" placeholder="在 https://console.amap.com 申请"></label></div><button class="primary mt-12" style="height:38px;padding:0 24px;" onclick="saveSchool()">保存学校信息</button></div></div>
    </div>
    <div class="page-block">${blockHead('年级管理（分专业分年级管理）','<button onclick="addGrade()">+ 新增年级</button>')}<div class="block-body" id="gradeMgr"></div></div>
    <div class="page-block">${blockHead('专业部管理（自定义）','<button class="primary" style="height:30px;padding:0 14px;" onclick="saveDeptMgr()">保存</button><button onclick="addDept()">+ 新增专业部</button>')}<div class="block-body" id="deptMgr"></div></div>
    <div class="page-block">${blockHead('部门 / 组织 管理（自定义）','<button class="primary" style="height:30px;padding:0 14px;" onclick="saveOrgMgr()">保存</button><button onclick="addOrg()">+ 新增部门</button>')}<div class="block-body" id="orgMgr"></div></div>
    ${isSuper()?`<div class="page-block">${blockHead('管理员任命 / 换届','')}<div class="block-body"><div class="tip-line">可任命其他成员为管理员（终端管理员 / 会长 / 副会长 / 部长等），或将超级管理员权限整体移交给接班人。</div><div class="form-grid cols-3"><label>选择人员<select id="apUser">${DB.users.filter(u=>u.role!=='dev'&&u.role!=='super').map(u=>`<option value="${u.id}">${esc(u.name)}（${esc(roleLabel(u.role))}）</option>`).join('')}</select></label><label>任命为<select id="apRole2"><option value="terminal">终端管理员</option><option value="president">会长</option><option value="vice">副会长</option><option value="minister">部长/站长</option><option value="broadcaster">广播站员</option><option value="etiquette">礼仪队员</option><option value="subleague">团副总支</option></select></label><label>操作<div style="height:40px;display:flex;gap:8px;"><button class="primary" style="height:38px;flex:1;" onclick="doAppointAdmin()">任命管理员</button><button class="ghost" style="height:38px;flex:1;color:var(--red);box-shadow:0 0 0 1px var(--red) inset;" onclick="openTransferBox()">换届移交</button></div></label></div><div id="transferBox" class="mt-12"></div></div></div>`:''}
    <div class="page-block" id="zySyncBlock">${blockHead('云端同步（全设备自动同步，零配置）',`<button class="ghost" onclick="zyPullNow()">立即下载云端</button><button class="primary" onclick="zyPushNow()">立即上传本地</button>`)}<div class="block-body"><div class="tip-line" style="margin-bottom:10px;">本平台已部署在 <b>GitHub Pages 永久地址</b>，数据自动同步到你的 Supabase 云端（免费）：<b>手机/电脑/平板所有设备、所有用户自动互通</b>，无需逐台配置；数据以加密形式存储。权限隔离由系统角色/部门规则控制（如宣传部管理员只能看到宣传部档案）。</div><div class="mt-12" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;"><button class="primary" style="height:38px;padding:0 24px;" onclick="zyPullNow()">从云端拉取（覆盖本机）</button><button class="ghost" style="height:38px;padding:0 24px;" onclick="zyPushNow()">上传本机到云端（覆盖云端）</button><span class="f12 c-3" id="zyStatus">自动同步已启用</span></div><div class="tip-line mt-12" style="font-size:12px;color:var(--ink-3);">· 使用说明：登录后每 15 秒自动与云端同步一次；新增数据自动上传，云端有更新的数据自动拉取。<br>· 「上传本机到云端」用于：以本机数据为准覆盖云端（如本机刚清空演示数据）。<br>· 「从云端拉取」用于：丢弃本机数据，以云端为准。<br>· 若提示「云端数据解密失败」，点「上传本机到云端」覆盖即可（版本更新后需覆盖一次）。</div></div></div>
    <div class="page-block">${blockHead('数据维护','')}<div class="block-body"><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
      <button style="height:42px;padding:0 22px;font-size:14px;font-weight:600;background:#2a8a3a;color:#fff;border-radius:2px;box-shadow:0 4px 10px rgba(42,138,58,.25);" onclick="restoreDemo()">恢复演示数据（仅供测试）</button>
      <button style="height:42px;padding:0 22px;font-size:14px;font-weight:600;background:#c8161d;color:#fff;border-radius:2px;box-shadow:0 4px 12px rgba(200,22,29,.25);" onclick="clearAllDemo()">清除所有演示数据（开始录入真实数据）</button>
      <span class="f12 c-3">「清除所有演示数据」会清空全部业务数据（仅保留系统账号与词典结构）并立即同步云端，之后不会再自动出现演示数据，可直接录入你的真实档案；「恢复演示数据」仅用于测试/展示，会载入示例数据。两个操作<b>均不退出系统</b>，点击后直接生效。</span>
    </div></div></div>`;
  renderGradeMgr();renderDeptMgr();renderOrgMgr();
}
window.saveRules=()=>{DB.rules.scorePerPerson=parseFloat($('#setScore').value)||0.1;DB.rules.deptMultiplier=parseFloat($('#setMul').value)||0.5;saveDB();toast('评分规则已保存','ok')};
window.saveSchool=()=>{DB.school=$('#setSchool').value;DB.schoolShort=$('#setSchoolShort').value;DB.league=$('#setLeague').value;DB.period=$('#setPeriod').value;DB.amapKey=$('#setAmap').value.trim();saveDB();toast('学校信息已保存','ok')};

/* ============================== 云端同步（Supabase，零配置全设备自动同步） ============================== */
function zySetStatus(t,ok){const el=$('#zyStatus');if(el){el.textContent=t;el.className='f12 '+(ok===true?'c-2':(ok===false?'c-red':''));}}
window.zyPullNow=async function(){
  if(!window.ZY)return toast('同步模块未加载','err');
  zySetStatus('下载中…');const p=await ZY.pull();
  if(p.ok&&p.data){const backup=window.DB;window.DB=p.data;if(window.normalizeDB)window.normalizeDB();saveDB();if(window.renderRoute)renderRoute();ZY.startPoll();zySetStatus('已下载云端数据',true);toast('已下载云端数据','ok');if(window._cloudMergeCb)window._cloudMergeCb(p.data,backup);}
  else if(p.empty){zySetStatus('云端暂无数据',true);toast('云端暂无数据（本机数据可点「上传本机到云端」初始化）','ok');}
  else if(p.decryptFail)zySetStatus('解密失败：版本不匹配',false),toast('解密失败：请点「上传本机到云端」覆盖','err');
  else zySetStatus('下载失败：'+(p.msg||''),false),toast('下载失败：'+(p.msg||''),'err');
};
window.zyPushNow=async function(){
  if(!window.ZY)return toast('同步模块未加载','err');
  zySetStatus('上传中…');const p=await ZY.push();
  zySetStatus(p.ok?'已上传本机数据到云端':'上传失败：'+(p.msg||''),p.ok);toast(p.ok?'已上传':'上传失败：'+(p.msg||''),p.ok?'ok':'err');
};
window.addGrade=()=>{const name=prompt('请输入新年级（如 26级）：');if(!name)return;if((DB.dictionaries.grades||[]).includes(name))return toast('该年级已存在','err');DB.dictionaries.grades=DB.dictionaries.grades||[];DB.dictionaries.grades.push(name);DB.dictionaries.grades.sort();saveDB();renderGradeMgr();toast('已新增','ok')};
window.delGrade=(name)=>confirmDialog(`确认删除年级「${name}」？（已关联该年级的档案不受影响）`,()=>{DB.dictionaries.grades=(DB.dictionaries.grades||[]).filter(g=>g!==name);saveDB();renderGradeMgr();toast('已删除','ok')});
function renderGradeMgr(){const box=$('#gradeMgr');if(!box)return;box.innerHTML=(DB.dictionaries.grades||[]).map(g=>{const cnt=DB.users.filter(u=>u.grade===g).length;return`<span class="chip">${esc(g)}（${cnt} 人） <a onclick="delGrade('${esc(g)}')">×</a></span>`}).join('')||'<div class="tip-line">暂无年级，点击「+ 新增年级」添加</div>'}
window.doAppointAdmin=()=>{
  const uid=$('#apUser').value;if(!uid)return toast('请选择人员','err');
  const u=DB.users.find(x=>x.id===uid);const role=$('#apRole2').value;
  const rl=(DB.dictionaries.role.find(r=>r.val===role)||{}).label;
  confirmDialog(`确认将 <b>${esc(u.name)}</b> 任命为「${rl}」？`,()=>{u.role=role;u.activated=true;u.pending=false;u.status='正常在岗';u.title=rl;u.position=rl;saveDB();pushLog('任命管理员',`任命 ${u.name} 为 ${rl}`);renderSettings($('#viewRoot'));toast('任命成功','ok')},'任命管理员');
};
window.openTransferBox=function(){const box=$('#transferBox');if(!box)return;box.innerHTML=`<div class="tip-line">将超级管理员权限移交给接班人，原管理员自动降级。</div><div class="form-grid cols-2"><label>选择接班人<select id="trTo">${DB.users.filter(u=>u.id!==currentUser.id&&u.role!=='dev').map(u=>`<option value="${u.id}">${esc(u.name)}（${esc(u.dept||'-')} ${esc(u.cls||'-')}）</option>`).join('')}</select></label><label>原管理员降级为<select id="trFromRole"><option>member</option><option>president</option><option>vice</option><option>minister</option></select></label></div><button class="primary mt-12" style="height:38px;padding:0 24px;" onclick="doTransfer()">确认换届移交</button>`};
window.addDept=()=>{const name=prompt('请输入新专业部名称：');if(!name)return;if(DB.dictionaries.departments.includes(name))return toast('该专业部已存在','err');DB.dictionaries.departments.push(name);DB.dictionaries.classes[name]=[];saveDB();if(window.ZY)ZY.push();renderDeptMgr();toast('已新增','ok')};
window.delDept=(name)=>confirmDialog(`确认删除专业部「${name}」？`,()=>{DB.dictionaries.departments=DB.dictionaries.departments.filter(d=>d!==name);delete DB.dictionaries.classes[name];saveDB();if(window.ZY)ZY.push();renderDeptMgr();toast('已删除','ok')});
window.saveDeptMgr=()=>{saveDB();if(window.ZY)ZY.push();renderDeptMgr();toast('专业部设置已保存并同步到云端','ok')};
window.addOrg=()=>{const name=prompt('请输入新部门/组织名称：');if(!name)return;if(DB.dictionaries.organizations.includes(name))return toast('该部门已存在','err');DB.dictionaries.organizations.push(name);saveDB();if(window.ZY)ZY.push();renderOrgMgr();toast('已新增','ok')};
window.saveOrgMgr=()=>{saveDB();if(window.ZY)ZY.push();renderOrgMgr();toast('部门/组织设置已保存并同步到云端','ok')};
window.delOrg=(name)=>confirmDialog(`确认删除部门「${name}」？`,()=>{DB.dictionaries.organizations=DB.dictionaries.organizations.filter(o=>o!==name);saveDB();if(window.ZY)ZY.push();renderOrgMgr();toast('已删除','ok')});
function renderDeptMgr(){
  const box=$('#deptMgr');if(!box)return;
  box.innerHTML=DB.dictionaries.departments.map(d=>`<div style="padding:12px;margin-bottom:10px;background:#fafafa;border-radius:2px;"><div style="display:flex;justify-content:space-between;align-items:center;"><b>${esc(d)}</b><span style="display:flex;gap:6px;"><button class="primary" style="height:26px;padding:0 10px;" onclick="saveDeptMgr()">保存</button><button class="ghost" style="height:26px;padding:0 10px;color:var(--red);box-shadow:0 0 0 1px var(--red) inset;" onclick="delDept('${esc(d)}')">删除</button></span></div></div>`).join('');
}
function renderOrgMgr(){const box=$('#orgMgr');if(!box)return;box.innerHTML=DB.dictionaries.organizations.map(o=>`<span class="chip">${esc(o)} <a onclick="delOrg('${esc(o)}')">×</a></span>`).join('')}
window.doTransfer=()=>{
  const toId=$('#trTo').value,fromRole=$('#trFromRole').value;
  if(!toId)return toast('请选择接班人','err');
  const to=DB.users.find(u=>u.id===toId);
  confirmDialog(`确认将超级管理员权限移交给 <b>${esc(to.name)}</b>？移交后您将降级。`,()=>{
    currentUser.role=fromRole;currentUser.title='志愿者';currentUser.position='志愿者';
    to.role='super';to.title='超级管理员';to.position='会长';to.activated=true;
    saveDB();toast('换届完成，请重新登录','ok');setTimeout(()=>{localStorage.removeItem(LS_USR);location.reload()},1200);
  },'确认换届');
};

/* ============================== 我的档案 ============================== */
function renderMy(root){
  clearInterval(window._totpTimer);
  const u=currentUser,sv=DB.services.filter(s=>s.idCard===u.idCard),total=sv.reduce((s,x)=>s+durationHours(x.startDT,x.endDT),0).toFixed(1);
  root.innerHTML=`
    <div class="row-2 mb-16">
      <div class="page-block">${blockHead('我的信息',`<button onclick="openUserForm('${u.id}')">编辑</button>${u.addr?`<button class="ghost" onclick="openMap(this.dataset.a)" data-a="${esc(u.addr)}">地图导航</button>`:''}<button class="ghost" onclick="exportCertPDF('${u.id}')">导出 PDF</button>`)}<div class="block-body"><div class="kv">${[['姓名',u.name],['性别',u.gender],['出生年月',u.birth],['民族',u.nation],['籍贯',u.native],['政治面貌',u.politics],['专业部',u.dept],['班级',u.cls],['职位',u.position],['所在部门',u.org],['联系电话',u.phone],['邮箱',u.email],['身份证号',u.idCard],['所在学校',u.school||DB.school],['居住地址',u.addr],['教育程度',u.edu]].map(([l,v])=>`<div><div class="l">${esc(l)}</div><div class="v">${esc(v||'-')}</div></div>`).join('')}</div></div></div>
      <div class="page-block">${blockHead('我的志愿服务概览','')}<div class="block-body"><div class="stat-row" style="grid-template-columns:1fr 1fr;"><div class="stat-card"><div class="stat-label">服务次数</div><div class="stat-value">${sv.length}<span class="unit">次</span></div></div><div class="stat-card"><div class="stat-label">累计时长</div><div class="stat-value">${total}<span class="unit">小时</span></div></div></div><div class="tip-line">本人仅可查看与自己相关的服务记录与档案。</div></div></div>
    </div>
    <div class="page-block">${blockHead('动态口令（找回密码用）','')}<div class="block-body"><div class="totp-box"><div class="totp-code" id="myTotp">${computeTOTP(currentUser.totpSecret)}</div><div class="totp-tip">每 30 秒自动更新，找回密码时在登录页「忘记密码」中填入「动态口令」即可重置。</div></div></div></div>
    <div class="page-block">${blockHead('我的服务记录','')}<div class="block-body">${sv.length?`<table class="tbl"><thead><tr><th>序号</th><th>日期</th><th>活动</th><th>地点</th><th>时长(h)</th><th>负责人</th></tr></thead><tbody>${sv.map((s,i)=>`<tr><td>${i+1}</td><td>${esc(s.startDT.slice(0,10))}</td><td>${esc(s.activity)}</td><td>${esc(s.location)}</td><td>${durationHours(s.startDT,s.endDT)}</td><td>${esc(s.serviceBy)}</td></tr>`).join('')}</tbody></table>`:'<div class="empty-tip">暂无服务记录</div>'}</div></div>`;
  clearInterval(window._totpTimer); window._totpTimer=setInterval(()=>{const e=document.getElementById('myTotp');if(e)e.textContent=computeTOTP(currentUser.totpSecret);},1000);
}

/* ============================== 举报中心 ============================== */
function renderReport(root){
  const isSuperRole=currentUser.role==='super';
  const list=isSuperRole?DB.reports.slice().sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))):DB.reports.filter(r=>r.reporterId===currentUser.id).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  const statusTag=st=>({pending:'<span class="tag gray">待受理</span>',processing:'<span class="tag warn">受理中</span>',resolved:'<span class="tag ok">已处理</span>'})[st]||'<span class="tag gray">待受理</span>';
  root.innerHTML=`
    <div class="page-block">${blockHead('举报中心', isSuperRole?'':'<button onclick="openReportForm()">我要举报</button>')}
      <div class="block-body">
        ${isSuperRole?'<div class="tip-line">仅超级管理员可查看全部举报并受理；普通成员仅能查看自己提交的举报及受理状态。</div>':'<div class="tip-line">你可举报违规内容（文字 / 图片 / 文档 / 声音 / 视频），提交后可在本页查看受理进度。</div>'}
        <div class="tbl-shell scroll-x"><table class="tbl"><thead><tr><th>时间</th>${isSuperRole?'<th>举报人</th>':''}<th>类型</th><th>内容</th><th>附件</th><th>受理状态</th>${isSuperRole?'<th>受理说明</th><th>操作</th>':''}</tr></thead><tbody>${list.length?list.map(r=>`<tr><td class="nowrap">${esc(r.createdAt)}</td>${isSuperRole?`<td>${esc(r.reporter)}</td>`:''}<td>${esc(r.kind)}</td><td>${esc((r.content||'').slice(0,40))}${(r.content||'').length>40?'…':''}</td><td>${r.files&&r.files.length?r.files.map((f,i)=>`<a href="${f.dataUrl}" download="${esc(f.name)}">附件${i+1}</a>`).join(' '):'-'}</td><td>${statusTag(r.status)}</td>${isSuperRole?`<td>${esc(r.reply||'-')}</td><td><button onclick="handleReport('${r.id}')">受理</button></td>`:''}</tr>`).join(''):`<tr><td colspan="${isSuperRole?7:5}" class="empty">—— 暂无举报 ——</td></tr>`}</tbody></table></div>
      </div>
    </div>`;
}
window.openReportForm=function(){
  openModal(`<div class="modal wide"><div class="modal-title"><span class="bar"></span>我要举报<span class="bar"></span><button class="x" data-close-modal>×</button></div><div class="modal-body"><div class="form-grid cols-2">
    <label>举报类型<select id="rpKind"><option>文字</option><option>图片</option><option>文档</option><option>声音</option><option>视频</option></select></label>
    <label>涉及对象（选填）<input id="rpTarget" placeholder="被举报人姓名 / 班级"></label>
    <label class="full">举报内容<i>*</i><textarea id="rpContent" placeholder="请描述具体情况"></textarea></label>
    <label class="full">附件（按类型上传，可选）<input id="rpFile" type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx"></label>
  </div></div><div class="modal-foot"><button class="ghost" data-close-modal>取消</button><button class="primary" id="rpSubmit">提交举报</button></div></div>`);
  $('#rpSubmit').onclick=()=>{
    const kind=$('#rpKind').value,content=$('#rpContent').value.trim(),target=$('#rpTarget').value.trim();
    if(!content)return toast('请填写举报内容','err');
    const file=$('#rpFile').files[0];
    const done=files=>{
      DB.reports.unshift({id:'r-'+(DB.nextIds.report=(DB.nextIds.report||0)+1),reporterId:currentUser.id,reporter:currentUser.name,kind,content,target,files:files||[],status:'pending',reply:'',createdAt:now()});
      saveDB(); pushLog('举报',`${currentUser.name} 提交${kind}举报`);
      toast('举报已提交，等待管理员受理','ok'); closeModal(); renderRoute();
    };
    if(file){const r=new FileReader();r.onload=()=>done([{name:file.name,dataUrl:r.result,type:file.type}]);r.readAsDataURL(file);}else done([]);
  };
};
window.handleReport=function(id){
  const r=DB.reports.find(x=>x.id===id);if(!r)return;
  openModal(`<div class="modal"><div class="modal-title"><span class="bar"></span>受理举报<span class="bar"></span><button class="x" data-close-modal>×</button></div><div class="modal-body"><div class="kv"><div><div class="l">举报人</div><div class="v">${esc(r.reporter)}</div></div><div><div class="l">类型</div><div class="v">${esc(r.kind)}</div></div><div><div class="l">内容</div><div class="v">${esc(r.content)}</div></div></div><label>受理状态<select id="hdStatus"><option value="pending">待受理</option><option value="processing">受理中</option><option value="resolved">已处理</option></select></label><label class="full">受理说明<textarea id="hdReply" placeholder="填写处理结果与说明">${esc(r.reply||'')}</textarea></label></div><div class="modal-foot"><button class="ghost" data-close-modal>取消</button><button class="primary" id="hdSave">保存</button></div></div>`);
  $('#hdSave').onclick=()=>{r.status=$('#hdStatus').value;r.reply=$('#hdReply').value.trim();saveDB();pushLog('受理举报',`受理 ${r.reporter} 的举报：${r.status}`);toast('已更新受理状态','ok');closeModal();renderRoute();};
};

/* ============================== 操作日志 ============================== */
function renderTraces(root){
  if(!canSeeTrace()){ root.innerHTML='<div class="empty-tip" style="padding:80px;text-align:center;color:var(--ink-3);">您当前角色不可查看痕迹日志<br><span class="f12">（仅终端管理员可查看，超级管理员/校团委不可见）</span></div>'; return; }
  const list=DB.traces||[];
  root.innerHTML=`
    <div class="page-block">${blockHead('痕迹日志（<span id="trCount">0</span>）','<button class="ghost" onclick="exportTraces()">导出 Excel</button>')}
      <div class="block-body">
        <div class="tip-line">记录数据级操作痕迹（修改/删除/审核/任命的<span class="b">前后值差异</span>），便于系统维护时追溯"谁动了哪些数据"。<b>仅终端管理员（系统最高权限者）可查看</b>；超级管理员（校团委）权限等同但看不到本页，避免他们反查你的维护动作。</div>
        <table class="tbl"><thead><tr><th style="width:140px">时间</th><th style="width:80px">操作人</th><th style="width:90px">角色</th><th style="width:100px">操作</th><th style="width:140px">对象</th><th>前后值差异</th></tr></thead><tbody id="trBody"></tbody></table>
      </div>
    </div>`;
  const rows=list.slice(0,500);
  $('#trCount').textContent=list.length;
  $('#trBody').innerHTML=rows.map(t=>{
    let diff='';
    try{
      const b=JSON.parse(t.before||'{}'),a=JSON.parse(t.after||'{}');
      const keys=new Set([...Object.keys(b||{}),...Object.keys(a||{})]);
      diff=Array.from(keys).map(k=>{
        const x=b[k],y=a[k];
        if(JSON.stringify(x)===JSON.stringify(y)) return `<span class="f12 c-3">${esc(k)}=${esc(JSON.stringify(x)||'-')}</span>`;
        return `<div class="f12"><b>${esc(k)}</b>: <span style="background:#fff1d6;color:#d46b08;padding:1px 6px;">${esc(JSON.stringify(x||'')||'(空)')}</span> → <span style="background:#d9f7be;color:#389e0d;padding:1px 6px;">${esc(JSON.stringify(y||'')||'(空)')}</span></div>`;
      }).join('') || '<span class="c-3 f12">（无字段差异）</span>';
    }catch(e){ diff='<span class="c-3 f12">'+esc(t.hint||'')+'</span>'; }
    return `<tr><td>${esc(fmtDateTime(t.time))}</td><td>${esc(t.user)}</td><td>${esc(roleLabel(t.role))}</td><td><span style="background:#fff1d6;color:#d46b08;padding:2px 8px;border-radius:4px;font-size:12px;">${esc(t.action)}</span></td><td>${esc(t.target||'-')}</td><td>${diff}</td></tr>`;
  }).join('')||'<tr><td colspan="6" class="empty-tip">暂无痕迹日志</td></tr>';
  window.exportTraces=function(){
    if(!window.XLSX)return toast('导出模块未加载','err');
    const ws=XLSX.utils.json_to_sheet((DB.traces||[]).map(t=>({时间:t.time,操作人:t.user,角色:roleLabel(t.role),操作:t.action,对象:t.target,变更字段:t.hint||''})));
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'痕迹日志');
    XLSX.writeFile(wb,'痕迹日志.xlsx');
  };
}

/* ============================== 操作手册（各角色使用说明） ============================== */
function renderHelp(root){
  const me=currentUser;
  const guides=[
    {key:'terminal',name:'终端管理员（系统维护）',icon:'🔧',who:'终端管理员',lines:[
      ['登录','使用身份证号 000000000000000002 / 密码 term123 登录'],
      ['系统设置','左侧「系统设置」：评分规则、学校信息、年级/专业部/部门管理、管理员任命与换届'],
      ['任命校团委','系统设置 → 管理员任命/换届 → 选择人员 → 任命为「超级管理员」；换届可整体移交权限'],
      ['痕迹日志','左侧「痕迹日志」：查看谁在什么时间改了什么数据（前后值对比），只有您可见'],
      ['操作日志','左侧「操作日志」：查看登录/注册/档案变更等全部关键操作'],
      ['数据维护','系统设置 → 数据维护：两个按钮（恢复演示数据 / 清除所有演示数据，不退出系统）'],
      ['云端同步','系统设置 → 云端同步：全设备自动同步，无需配置；异常时可手动「上传/下载」']
    ]},
    {key:'super',name:'校团委 · 超级管理员（数据负责人）',icon:'🏛',who:'超级管理员',lines:[
      ['登录','身份证号 000000000000000001 / 密码 admin123（密码可在系统设置或「我的档案」中修改）'],
      ['录入档案','左侧「档案中心」→ 选部门 tab（青年志愿者协会/广播站/礼仪队/团副总支/团总支/学生会）→ 「录入XX档案」→ 按模板填写 → 提交'],
      ['模板差异','不同部门录入模板不同：志愿者看"志愿服务经历"、广播站看"语言功底+普通话清晰度"、礼仪队看"礼仪服务经历"、负责人看"分管工作与职责"'],
      ['发布活动','「活动中心」→ 新增活动（标题/时间/地点/人数/封面）→ 发布后志愿者可报名'],
      ['加分服务','「服务与加分」→ 录入服务记录（活动/班级/姓名/时长）→ 自动计入报表与排行'],
      ['审核注册','「审核中心」→ 手机端提交的注册自动出现 → 审核通过/驳回（结果自动通知本人）'],
      ['发布新闻','「新闻·通报」→ 发布新闻/通报（可置顶）'],
      ['月度总结','「月度总结」→ 按月份写总结 + 上传活动图片 → 导出 PDF'],
      ['查看报表','「报表中心」→ 按日期范围导出 Excel/PDF（相同活动自动合并）'],
      ['团员名额','「团员名额」→ 审批推荐/自荐申请'],
      ['资料文件','「资料文件」→ 可发布文字、上传文件（表格/通知等）、贴外部链接，供全员查看']
    ]},
    {key:'president',name:'会长 / 副会长',icon:'🎖',who:'会长/副会长',lines:[
      ['查看数据','「数据中心」「报表中心」「年度/月度看板」：查看全校志愿服务数据与排行'],
      ['管理活动','「活动中心」→ 发布活动、管理报名'],
      ['审核','「审核中心」→ 审核注册与名额申请'],
      ['任务','「任务中心」→ 发布任务（值日/招募），查看报名'],
      ['权限范围','可查看全部档案与数据（除痕迹日志）']
    ]},
    {key:'minister',name:'部长 / 站长 / 管理员',icon:'📌',who:'部长/站长/管理员',lines:[
      ['本部门档案','「档案中心」→ 只显示本部门档案（防信息泄露），可录入/编辑/导出'],
      ['部门活动','「活动中心」→ 发布本部门活动'],
      ['部门服务','「服务与加分」→ 录入本部门服务记录'],
      ['权限范围','只能查看自己部门的数据，其他部门不可见']
    ]},
    {key:'broadcaster',name:'广播站',icon:'📻',who:'广播站',lines:[
      ['广播记录','「广播部管理」→ 录入每次广播记录（日期/主题/时长）'],
      ['档案','「档案中心」→ 查看本部门（广播站）成员档案，模板含语言功底/普通话清晰度'],
      ['权限范围','只能看广播站数据']
    ]},
    {key:'etiquette',name:'礼仪队',icon:'🌸',who:'礼仪队',lines:[
      ['礼仪安排','「礼仪队管理」→ 录入礼仪活动安排（日期/活动/负责人/人数）'],
      ['档案','「档案中心」→ 查看本部门（礼仪队）成员档案，模板含礼仪服务经历'],
      ['权限范围','只能看礼仪队数据']
    ]},
    {key:'subleague',name:'团副总支',icon:'',who:'团副总支',lines:[
      ['组织生活','「团副总支」→ 录入团支部组织生活/活动记录'],
      ['档案','「档案中心」→ 查看本部门（团副总支）成员档案'],
      ['权限范围','只能看团副总支数据']
    ]},
    {key:'member',name:'志愿者（学生）',icon:'🙋',who:'志愿者',lines:[
      ['注册','登录页点「志愿者注册」→ 填写信息提交 → 等待管理员审核'],
      ['登录','审核通过后，用身份证号 + 自己设置的密码登录'],
      ['报名活动','「活动中心」→ 查看招募中的活动 → 报名'],
      ['报名任务','「任务中心」→ 报名任务（值日/招募）'],
      ['我的档案','「我的档案」→ 查看个人档案、累计服务时长、审核状态'],
      ['通知','「通知中心」→ 查看系统通知（审核结果、活动通知）'],
      ['申请名额','「团员名额」→ 提交入团名额自荐申请'],
      ['注意事项','所有数据自动云端同步，换设备登录同一账号即可看到一致数据']
    ]}
  ];
  const tabBar=guides.map(g=>`<a class="file-tab ${g.key===me.role?'active':''}" data-guide="${g.key}" style="cursor:pointer;padding:7px 14px;display:inline-block;background:${g.key===me.role?'var(--red)':'#f0f2f5'};color:${g.key===me.role?'#fff':'var(--ink-2)'};font-size:13px;margin:0 4px 8px 0;border-radius:2px;">${g.icon}${g.name}</a>`).join('');
  const cur=guides.find(g=>g.key===me.role)||guides[1];
  root.innerHTML=`
    <div class="notice-strip"><span class="label">操作手册</span><span class="ct">按角色查看系统使用说明 · 管理员可在「资料文件」发布补充文档</span></div>
    <div class="page-block">${blockHead('使用说明 · 按角色','')}<div class="block-body">
      <div style="margin-bottom:6px;">${tabBar}</div>
      <div id="helpBody"></div>
    </div></div>`;
  const renderGuide=(key)=>{
    const g=guides.find(x=>x.key===key)||guides[0];
    $('#helpBody').innerHTML=`<div style="background:#fafbfc;border:1px solid #f0f2f5;padding:18px 22px;">
      <div style="font-size:16px;font-weight:700;color:var(--red);margin-bottom:4px;">${g.icon}${g.name}</div>
      <div style="font-size:12px;color:var(--ink-3);margin-bottom:12px;">以下为「${g.who}」的完整操作说明：</div>
      ${g.lines.map(([t,c])=>`<div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px dashed #e8eaee;font-size:14px;"><div style="flex:0 0 110px;color:var(--red);font-weight:600;">${esc(t)}</div><div style="flex:1;color:var(--ink-2);line-height:1.7;">${esc(c)}</div></div>`).join('')}
      <div class="tip-line mt-12" style="color:var(--ink-3);">提示：管理员可在「资料文件」模块发布图文/文件/链接形式的补充说明，供全体成员查阅。</div>
    </div>`;
  };
  renderGuide(me.role);
  $$('.file-tab[data-guide]').forEach(a=>a.onclick=()=>{
    $$('.file-tab[data-guide]').forEach(x=>{x.style.background=x.dataset.guide===a.dataset.guide?'var(--red)':'#f0f2f5';x.style.color=x.dataset.guide===a.dataset.guide?'#fff':'var(--ink-2)';});
    renderGuide(a.dataset.guide);
  });
}

/* ============================== 资料文件（上传文件 + 文字 + 链接） ============================== */
function renderOther(root){
  const list=(DB.others||[]).slice().sort((a,b)=>String(b.time||'').localeCompare(String(a.time||'')));
  const canPub=currentUser&&(ROLE_RANK[currentUser.role]||0)>=60; /* 管理级可发布 */
  root.innerHTML=`
    <div class="notice-strip"><span class="label">资料文件</span><span class="ct">发布文字 / 上传文件 / 外链，供全员查阅；管理员可发布与删除</span></div>
    ${canPub?`<div class="page-block">${blockHead('发布资料','')}<div class="block-body"><button class="primary" style="height:38px;padding:0 22px;" onclick="openOtherForm()">+ 发布文字 / 文件 / 链接</button><span class="f12 c-3" style="margin-left:10px;">可上传：通知文件、表格模板、活动资料、操作手册补充文档等</span></div></div>`:''}
    <div class="page-block">${blockHead('资料列表（'+list.length+'）','<button class="ghost" onclick="exportOthers()">导出清单</button>')}<div class="block-body">
      ${list.length?`<div class="tbl-shell scroll-x"><table class="tbl"><thead><tr><th style="width:40px">#</th><th>标题</th><th style="width:70px">类型</th><th style="width:100px">发布人</th><th style="width:120px">时间</th><th style="width:160px">操作</th></tr></thead><tbody>
      ${list.map((o,i)=>`<tr><td class="ctr">${i+1}</td><td><b>${esc(o.title)}</b>${o.content?`<div class="f12 c-3" style="margin-top:3px;">${esc((o.content||'').slice(0,60))}${(o.content||'').length>60?'…':''}</div>`:''}</td>
      <td>${o.files&&o.files.length?`<span class="tag ok">文件 ${o.files.length}</span>`:''}${o.links&&o.links.length?`<span class="tag" style="background:#e6f7ff;color:#1890ff;">链接 ${o.links.length}</span>`:''}${o.content?'<span class="tag" style="background:#f0f0f0;color:#5a5a5a;">文字</span>':''}</td>
      <td>${esc(o.publisher||'-')}</td><td>${esc((o.time||'').slice(0,16))}</td>
      <td class="ops-cell"><div class="ops-col"><button onclick="viewOther('${o.id}')">查看</button>${canPub||o.publisher===currentUser.name?`<button class="warn" onclick="delOther('${o.id}')">删除</button>`:''}</div></td></tr>`).join('')}
      </tbody></table></div>`:'<div class="empty-tip">暂无资料，管理员可点击上方「发布资料」添加文件/文字/链接</div>'}
    </div></div>`;
  window.exportOthers=function(){
    if(!window.XLSX)return toast('导出模块未加载','err');
    const ws=XLSX.utils.json_to_sheet((DB.others||[]).map(o=>({标题:o.title,发布人:o.publisher,时间:o.time,文字:(o.content||'').slice(0,200),文件数:(o.files||[]).length,链接数:(o.links||[]).length})));
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'资料文件');XLSX.writeFile(wb,'资料文件清单.xlsx');
  };
}
window.openOtherForm=function(){
  openModal(`<div class="modal wide"><div class="modal-title"><span class="bar"></span>发布资料（文字 / 文件 / 链接）<span class="bar"></span><button class="x" data-close-modal>×</button></div><div class="modal-body">
    <div class="form-grid cols-1">
      <label>标题<i>*</i><input id="otTitle" placeholder="如：志愿者管理办法 / 活动资料模板"></label>
      <label>文字内容（选填）<textarea id="otContent" style="min-height:110px;" placeholder="支持图文说明、通知正文、使用说明……"></textarea></label>
      <label>上传文件（可多选：PDF/Word/Excel/图片等）<input id="otFiles" type="file" multiple></label>
      <div id="otFileList" class="f12 c-3"></div>
      <label>外部链接（格式：标题|网址，一行一条，如：高德地图|https://uri.amap.com）<textarea id="otLinks" style="min-height:54px;" placeholder="名称|https://网址"></textarea></label>
    </div>
  </div><div class="modal-foot"><button class="ghost" data-close-modal>取消</button><button class="primary" id="otSave">发布</button></div></div>`);
  const fileInfo=$('#otFileList');
  $('#otFiles').onchange=()=>{
    const fs=$('#otFiles').files;
    fileInfo.innerHTML=Array.from(fs).map(f=>`📄 ${esc(f.name)} (${(f.size/1024).toFixed(0)}KB)`).join('<br>');
  };
  $('#otSave').onclick=()=>{
    const title=$('#otTitle').value.trim();
    if(!title)return toast('请填写标题','err');
    const files=Array.from($('#otFiles').files||[]);
    const links=($('#otLinks').value||'').split('\n').map(s=>s.trim()).filter(Boolean).map(s=>{
      const m=s.split('|');return {text:(m[0]||'').trim(),url:(m[1]||m[0]||'').trim()};
    }).filter(l=>l.url);
    if(!files.length && !links.length && !$('#otContent').value.trim())return toast('请至少填写文字、上传文件或添加链接之一','err');
    let pending=files.length,fileItems=[];
    const finish=()=>{
      DB.others=DB.others||[];
      DB.others.unshift({id:uid('ot'),title,content:$('#otContent').value.trim(),files:fileItems,links,publisher:currentUser.name,role:currentUser.role,time:now()});
      saveDB();pushLog('发布资料',`发布「${title}」`);pushTrace('发布资料','资料: '+title);
      closeModal();if(currentRoute()==='other')renderOther($('#viewRoot'));toast('发布成功','ok');
    };
    if(!files.length){finish();return}
    files.forEach(f=>{
      const r=new FileReader();
      r.onload=()=>{fileItems.push({name:f.name,size:f.size,type:f.type,dataUrl:r.result});if(--pending===0)finish();};
      r.onerror=()=>{if(--pending===0)finish();};
      r.readAsDataURL(f);
    });
  };
};
window.viewOther=function(id){
  const o=(DB.others||[]).find(x=>x.id===id);if(!o)return;
  openModal(`<div class="modal wide"><div class="modal-title"><span class="bar"></span>${esc(o.title)}<span class="bar"></span><button class="x" data-close-modal>×</button></div><div class="modal-body">
    <div class="f12 c-3" style="margin-bottom:10px;">发布人：${esc(o.publisher)} · ${esc(fmtDateTime(o.time))}</div>
    ${o.content?`<div style="white-space:pre-wrap;line-height:1.8;font-size:14px;color:var(--ink);background:#fafbfc;border:1px solid #f0f2f5;padding:14px 16px;margin-bottom:14px;">${esc(o.content)}</div>`:''}
    ${(o.files||[]).length?`<div class="block-title">附件文件</div><div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;">${o.files.map(f=>`<a href="${f.dataUrl}" download="${esc(f.name)}" style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:#f7f8fa;border:1px solid #f0f2f5;text-decoration:none;color:var(--red);font-size:14px;">📄 ${esc(f.name)} <span class="f12 c-3">(${(f.size/1024).toFixed(0)}KB) 下载</span></a>`).join('')}</div>`:''}
    ${(o.links||[]).length?`<div class="block-title">相关链接</div><div style="display:flex;flex-direction:column;gap:8px;">${o.links.map(l=>`<a href="${esc(l.url)}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:#e6f7ff;border:1px solid #bae7ff;text-decoration:none;color:#1890ff;font-size:14px;">🔗 ${esc(l.text||l.url)} <span class="f12 c-3">${esc(l.url)} ↗</span></a>`).join('')}</div>`:''}
    ${(!o.content&&!(o.files||[]).length&&!(o.links||[]).length)?'<div class="empty-tip">该资料暂无内容</div>':''}
  </div><div class="modal-foot"><button class="ghost" data-close-modal>关闭</button></div></div>`);
};
window.delOther=function(id){
  const o=(DB.others||[]).find(x=>x.id===id);if(!o)return;
  confirmDialog(`确认删除资料「<b>${esc(o.title)}</b>」？`,()=>{
    DB.others=DB.others.filter(x=>x.id!==id);saveDB();pushLog('删除资料',`删除「${o.title}」`);pushTrace('删除资料','资料: '+o.title);
    if(currentRoute()==='other')renderOther($('#viewRoot'));toast('已删除','ok');
  },'删除资料');
};

function renderLogs(root){  root.innerHTML=`
    <div class="search-bar">
      <div class="field"><div class="l">关键字（操作人 / 内容）</div><input id="logKw" placeholder="搜索日志"></div>
      <div class="field"><div class="l">操作类型</div><select id="logAct"><option value="">全部</option><option>登录</option><option>注册</option><option>重置密码</option><option>录入档案</option><option>修改档案</option><option>签到</option><option>举报</option><option>受理举报</option></select></div>
      <div class="btns"><button onclick="logSearch()">查 询</button><button class="ghost" onclick="logReset()">重 置</button></div>
    </div>
    <div class="page-block">${blockHead('操作日志','<button onclick="exportLogs()">导出 Excel</button>')}
      <div class="block-body">
        <div class="tip-line">共 <span id="logCount">0</span> 条 · 仅管理员可见 · 系统自动记录登录、注册、重置密码、档案变更、签到、举报等全部关键操作。</div>
        <table class="tbl"><thead><tr><th>时间</th><th>操作人</th><th>角色</th><th>操作类型</th><th>内容</th></tr></thead><tbody id="logBody"></tbody></table>
      </div>
    </div>`;
  window.logSearch=function(){
    const kw=$('#logKw').value.trim().toLowerCase(),act=$('#logAct').value;
    const rows=DB.logs.filter(l=>{
      if(act&&l.action!==act)return false;
      if(kw){const h=[l.user,l.role,l.action,l.content].join(' ').toLowerCase();if(!h.includes(kw))return false;}
      return true;
    });
    $('#logCount').textContent=rows.length;
    $('#logBody').innerHTML=rows.map(l=>`<tr><td>${esc(fmtDateTime(l.time))}</td><td>${esc(l.user)}</td><td>${esc(roleLabel(l.role))}</td><td><span style="background:var(--red-soft);color:var(--red);padding:2px 8px;border-radius:4px;font-size:12px;">${esc(l.action)}</span></td><td>${esc(l.content)}</td></tr>`).join('')||'<tr><td colspan="5" class="empty-tip">无匹配日志</td></tr>';
  };
  window.logReset=function(){$('#logKw').value='';$('#logAct').value='';logSearch();};
  window.exportLogs=function(){
    const rows=DB.logs.slice();
    const head=['时间','操作人','角色','操作类型','内容'];
    const lines=[head.join('\t')].concat(rows.map(l=>[fmtDateTime(l.time),l.user,roleLabel(l.role),l.action,l.content].map(c=>(c||'').replace(/\t/g,' ')).join('\t')));
    const csv='\ufeff'+lines.join('\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='操作日志_'+fmtDate(now())+'.xls';a.click();
    pushLog('导出','导出操作日志 '+rows.length+' 条');
  };
  logSearch();
}

/* ============================== 资料打印（报表中心·按人） ============================== */
function renderPrint(root){
  root.innerHTML=`
    <div class="search-bar">
      <div class="field"><div class="l">姓名</div><input id="ptName" placeholder="输入姓名"></div>
      <div class="field"><div class="l">身份证号</div><input id="ptId" maxlength="18" placeholder="输入完整身份证号"></div>
      <div class="btns"><button onclick="printSearch()">查 询</button><button class="ghost" onclick="printReset()">重 置</button></div>
    </div>
    <div class="tip-line">资料打印中心：按「姓名 / 身份证号」检索志愿者，勾选要打印的资料（纸质档案 / 服务记录 / 志愿服务证明），一键导出 PDF，无需下载模板。</div>
    <div class="page-block" id="ptResult"></div>`;
}
window.printReset=function(){$('#ptName').value='';$('#ptId').value='';$('#ptResult').innerHTML='<div class="empty-tip">输入姓名或身份证号后点击查询</div>'};
window.printSearch=function(){
  const name=$('#ptName').value.trim(),id=$('#ptId').value.trim();
  if(!name&&!id)return toast('请输入姓名或身份证号','err');
  const list=DB.users.filter(u=>u.role!=='dev'&&(!name||u.name.includes(name))&&(!id||u.idCard===id));
  const box=$('#ptResult');
  if(!list.length){box.innerHTML='<div class="empty-tip">未找到匹配档案</div>';return}
  box.innerHTML=`<div class="block-head" style="height:auto;padding:14px 18px;flex-direction:column;align-items:flex-start;gap:4px;"><div class="title" style="font-size:15px;">检索结果（共 ${list.length} 人）</div><div class="f12 c-3">选择人员后点击对应按钮打印资料</div></div>
  <div class="block-body"><div class="tbl-shell scroll-x"><table class="tbl"><thead><tr><th>姓名</th><th>身份证号</th><th>专业部</th><th>班级</th><th>部门</th><th>职位</th><th>状态</th><th>操作（打印）</th></tr></thead><tbody>${list.map(u=>`<tr><td><b>${esc(u.name)}</b></td><td>${esc(u.idCard)}</td><td>${esc(u.dept||'-')}</td><td>${esc(u.cls||'-')}</td><td>${esc(u.org||'-')}</td><td>${esc(roleLabel(u.role))}</td><td><span class="tag ${u.status==='注销'?'gray':(u.activated?'ok':'warn')}">${esc(u.status||'正常在岗')}</span></td><td><div class="ops-col"><button onclick="exportCertPDF('${u.id}')">纸质档案</button><button onclick="exportServicePDF('${u.id}')">服务记录</button><button onclick="exportProofPDF('${u.id}')">志愿证明</button><button class="ok" onclick="exportAllPDF('${u.id}')">全部打印</button></div></td></tr>`).join('')}</tbody></table></div></div>`;
};
window.exportServicePDF=function(id){
  const u=DB.users.find(x=>x.id===id);if(!u)return;
  const sv=DB.services.filter(s=>s.name===u.name&&s.idCard===u.idCard).sort((a,b)=>String(a.startDT).localeCompare(String(b.startDT)));
  const P=window.CanvasPDF;P.init();
  P.center('志愿服务记录明细',P.y,{size:20,bold:true,color:'#c8161d'});P.y+=8;
  P.center(DB.school+' · '+esc(u.name)+' · '+esc(u.idCard),P.y,{size:11,color:'#5a5a5a'});P.y+=6;
  P.line(56,P.y,P.W-56,P.y,'#c8161d',1);P.y+=14;
  const head=['序号','服务日期','活动名称','服务地点','时长(小时)','负责人'];
  const cw=[48,96,200,150,80,96];
  P.table(head,sv.map((s,i)=>[i+1,s.startDT.slice(0,10),s.activity,s.location,durationHours(s.startDT,s.endDT),s.serviceBy||'']),cw,{size:10});
  P.y+=12;
  const total=sv.reduce((s,x)=>s+durationHours(x.startDT,x.endDT),0).toFixed(1);
  P.text('合计：共 '+sv.length+' 次，累计 '+total+' 小时。',56,P.y,{size:11,bold:true,color:'#1a1a1a'});P.y+=24;
  P.text('制表人：'+currentUser.name+'    日期：'+today(),56,P.y,{size:10,color:'#5a5a5a'});
  P.save(u.name+'_志愿服务记录.pdf');toast('已导出 PDF','ok');
};
window.exportProofPDF=function(id){
  const u=DB.users.find(x=>x.id===id);if(!u)return;
  const sv=DB.services.filter(s=>s.name===u.name&&s.idCard===u.idCard);
  const total=sv.reduce((s,x)=>s+durationHours(x.startDT,x.endDT),0).toFixed(1);
  const P=window.CanvasPDF;P.init();
  P.center('志愿服务证明',P.y,{size:22,bold:true,color:'#c8161d'});P.y+=6;
  P.center('（'+DB.school+'）',P.y,{size:12,color:'#5a5a5a'});P.y+=10;
  P.line(56,P.y,P.W-56,P.y,'#c8161d',1);P.y+=30;
  const lines=[`兹证明 ${u.name}（身份证号：${u.idCard}）系我校${u.dept||''}${u.cls||''}${u.org||''}成员，在校期间积极参加志愿服务活动，表现良好。`,``,`截至 ${today()}，累计参加志愿服务 ${sv.length} 次，累计服务时长 ${total} 小时。`,``,`特此证明。`];
  lines.forEach(ln=>{const chunks=P._wrap(ln,P.W-120,14);chunks.forEach(ch=>{P.ensure(30);P.text(ch,60,P.y,{size:14,color:'#1a1a1a',align:'center'});P.y+=32});P.y+=6});
  P.y+=40;
  P.text('单位（盖章）：'+(u.org||'青年志愿者协会'),P.W-260,P.y,{size:12});
  P.text('日期：'+today(),P.W-260,P.y+26,{size:12});
  P.save(u.name+'_志愿服务证明.pdf');toast('已导出 PDF','ok');
};
window.exportAllPDF=function(id){
  const u=DB.users.find(x=>x.id===id);if(!u)return;
  const sv=DB.services.filter(s=>s.name===u.name&&s.idCard===u.idCard).sort((a,b)=>String(a.startDT).localeCompare(String(b.startDT)));
  const total=sv.reduce((s,x)=>s+durationHours(x.startDT,x.endDT),0).toFixed(1);
  const P=window.CanvasPDF;P.init();
  P.center((u.org||'志愿者')+'个人信息表',P.y,{size:22,bold:true,color:'#c8161d'});P.y+=10;
  P.line(56,P.y,P.W-56,P.y,'#c8161d',1.2);P.y+=14;
  const fields=[['姓名',u.name],['性别',u.gender],['出生年月',u.birth],['民族',u.nation],['籍贯',u.native],['政治面貌',u.politics],['专业部',u.dept],['班级',u.cls],['职位',u.position],['所在部门',u.org],['联系电话',u.phone],['身份证号',u.idCard],['所在学校',u.school||DB.school],['居住地址',u.addr],['是否住校',u.live],['教育程度',u.edu],['邮箱',u.email],['个人经历',(u.exp||'').slice(0,30)]];
  const colW=Math.floor((P.W-112)/2),lbl=72,rowH=27;
  fields.forEach((f,i)=>{const c=i%2,r=Math.floor(i/2),x=56+c*colW,yy=P.y+r*rowH;
    P.ensure(rowH);
    P.box(x,yy-19,lbl,rowH,'#fbecee');
    P.ctx.strokeStyle='#e5e7eb';P.ctx.lineWidth=.5;P.ctx.strokeRect(x,yy-19,colW,rowH);
    P.text(f[0],x+8,yy,{size:11,bold:true,color:'#5a5a5a'});
    P.text(P._clip(String(f[1]==null?'-':f[1]),colW-lbl-18,11),x+lbl+8,yy,{size:11,color:'#1a1a1a'});
  });
  P.y+=Math.ceil(fields.length/2)*rowH+16;
  P.text('志愿服务经历',56,P.y,{size:15,bold:true,color:'#c8161d'});P.y+=4;
  P.line(56,P.y,120,P.y,'#c8161d',.8);P.y+=10;
  P.table(['序号','服务日期','活动名称','服务地点','时长(小时)','负责人'],sv.map((s,i)=>[i+1,s.startDT.slice(0,10),s.activity,s.location,durationHours(s.startDT,s.endDT),s.serviceBy||'']),[48,96,200,150,80,96],{size:10,rowH:25});
  P.y+=10;
  P.text('累计服务总时长：'+total+' 小时（共 '+sv.length+' 次）',56,P.y,{size:11,bold:true});P.y+=26;
  P.text('申请人签字：',56,P.y,{size:12});P.text('审核人签字：',P.W/2+20,P.y,{size:12});
  P.save(u.name+'_全部资料.pdf');toast('已导出 PDF','ok');
};

/* ============================== 评优评先 ============================== */
function renderEval(root){
  DB.evaluations=DB.evaluations||[];
  const curYear=new Date().getFullYear();
  const term=window._evalTerm||'year';
  const inTerm=(dt)=>{const y=+String(dt).slice(0,4),m=+String(dt).slice(5,7);if(term==='year')return y===curYear;if(term==='s1')return y===curYear&&m>=2&&m<=7;if(term==='s2')return (y===curYear&&m>=8)||(y===curYear+1&&m===1);return true;};
  const memberMap={};
  DB.services.filter(s=>inTerm(s.startDT)).forEach(s=>{const k=s.name+'|'+s.idCard;if(!memberMap[k])memberMap[k]={name:s.name,idCard:s.idCard,dept:s.dept,cls:s.cls,org:s.org,times:0,hours:0};memberMap[k].times++;memberMap[k].hours+=durationHours(s.startDT,s.endDT);});
  const topMembers=Object.values(memberMap).sort((a,b)=>b.hours-a.hours).slice(0,15);
  const classMap={};
  DB.services.filter(s=>inTerm(s.startDT)).forEach(s=>{const k=s.dept+'|'+s.cls;if(!classMap[k])classMap[k]={dept:s.dept,cls:s.cls,times:0,hours:0};classMap[k].times++;classMap[k].hours+=durationHours(s.startDT,s.endDT);});
  const topClasses=Object.values(classMap).sort((a,b)=>b.hours-a.hours).slice(0,10);
  const orgMap={};
  DB.services.filter(s=>inTerm(s.startDT)).forEach(s=>{const k=s.org||'(未指定)';orgMap[k]=(orgMap[k]||0)+durationHours(s.startDT,s.endDT);});
  const topOrgs=Object.entries(orgMap).sort((a,b)=>b[1]-a[1]);
  window.evalTermChange=()=>{window._evalTerm=$('#evTerm').value;renderEval($('#viewRoot'))};
  const list=DB.evaluations.slice().sort((a,b)=>String(b.time).localeCompare(String(a.time)));
  const termOpts=[['year',curYear+' 全年'],['s1',curYear+' 上期'],['s2',curYear+' 下期']].map(([v,t])=>`<option value="${v}" ${term===v?'selected':''}>${t}</option>`).join('');
  root.innerHTML=`
    <div class="search-bar">
      <div class="field"><div class="l">评选周期（学期 / 学年）</div><select id="evTerm">${termOpts}</select></div>
      <div class="btns"><button onclick="evalTermChange()">生 成</button></div>
    </div>
    <div class="tip-line">评优评先：按所选「学期 / 学年」的服务时长自动生成候选榜单，管理员可一键标记「优秀 / 表扬」等评级，导出获奖名单 PDF。系统每年自动归档。</div>
    <div class="row-3 mb-16">
      <div class="page-block">${blockHead('优秀志愿者候选（按服务时长）',`<button class="primary" onclick="openEvalForm()">新增评优</button>`)}
        <div class="block-body"><table class="tbl"><thead><tr><th>排名</th><th>姓名</th><th>身份证</th><th>专业部 / 班级</th><th>部门</th><th>服务次数</th><th>服务时长(h)</th><th>操作</th></tr></thead><tbody>${topMembers.length?topMembers.map((m,i)=>`<tr><td class="ctr">${i+1}</td><td><b>${esc(m.name)}</b></td><td>${esc((m.idCard||'').slice(0,6))}****${esc((m.idCard||'').slice(-4))}</td><td>${esc(m.dept||'-')} / ${esc(m.cls||'-')}</td><td>${esc(m.org||'-')}</td><td class="ctr">${m.times}</td><td class="r"><b>${m.hours.toFixed(1)}</b></td><td><button class="ok" onclick="quickEval('成员','${esc(m.name)}','${esc(m.idCard)}','${esc(m.dept||'')}','${esc(m.cls||'')}','${m.hours.toFixed(1)}')">标记评优</button></td></tr>`).join(''):'<tr><td colspan="8" class="empty">—— 暂无服务记录 ——</td></tr>'}</tbody></table></div>
      </div>
      <div class="page-block">${blockHead('优秀班级候选（按班级总时长）','')}
        <div class="block-body"><table class="tbl"><thead><tr><th>排名</th><th>专业部</th><th>班级</th><th>人次</th><th>总时长(h)</th></tr></thead><tbody>${topClasses.length?topClasses.map((c,i)=>`<tr><td class="ctr">${i+1}</td><td>${esc(c.dept||'-')}</td><td>${esc(c.cls||'-')}</td><td class="ctr">${c.times}</td><td class="r"><b>${c.hours.toFixed(1)}</b></td></tr>`).join(''):'<tr><td colspan="5" class="empty">—— 暂无数据 ——</td></tr>'}</tbody></table></div>
      </div>
      <div class="page-block">${blockHead('优秀组织候选（按部门总时长）','')}
        <div class="block-body"><table class="tbl"><thead><tr><th>排名</th><th>部门 / 组织</th><th>总时长(h)</th></tr></thead><tbody>${topOrgs.length?topOrgs.map(([o,h],i)=>`<tr><td class="ctr">${i+1}</td><td>${esc(o)}</td><td class="r"><b>${h.toFixed(1)}</b></td></tr>`).join(''):'<tr><td colspan="3" class="empty">—— 暂无数据 ——</td></tr>'}</tbody></table></div>
      </div>
    </div>
    <div class="page-block">${blockHead('已评定记录（'+list.length+' 项）','<button class="ghost" onclick="exportEvalList()">导出获奖名单</button>')}
      <div class="block-body">${list.length?`<table class="tbl"><thead><tr><th>时间</th><th>年度</th><th>类型</th><th>对象</th><th>称号</th><th>事由</th><th>评定人</th><th>操作</th></tr></thead><tbody>${list.map(e=>`<tr><td class="nowrap">${esc(fmtDateTime(e.time))}</td><td>${esc(e.year||'')}</td><td>${esc(e.type)}</td><td>${esc(e.target)}</td><td><span class="tag ok">${esc(e.level)}</span></td><td>${esc(e.reason||'')}</td><td>${esc(e.creator||'')}</td><td>${currentUser.role==='super'||currentUser.role==='terminal'?`<button class="warn" onclick="delEval('${e.id}')">撤销</button>`:'-'}</td></tr>`).join('')}</tbody></table>`:'<div class="empty-tip">尚未评定任何奖项</div>'}</div>
    </div>`;
}
window.openEvalForm=function(existing,prefill){
  if(!canEdit())return toast('仅管理员可评定','err');
  prefill=prefill||{};
  const def={year:(new Date().getFullYear())+' 年',type:'成员',target:'',level:'优秀',reason:''};
  const init=Object.assign({},def,prefill);
  openModal(`<div class="modal"><div class="modal-title"><span class="bar"></span>新增评优评先<span class="bar"></span><button class="x" data-close-modal>×</button></div><div class="modal-body"><div class="form-grid cols-2">
    <label>年度<input id="evYear" value="${esc(init.year)}"></label>
    <label>类型<select id="evType"><option ${init.type==='成员'?'selected':''}>成员</option><option ${init.type==='班级'?'selected':''}>班级</option><option ${init.type==='组织'?'selected':''}>组织</option></select></label>
    <label class="full">对象（姓名 / 班级 / 部门）<input id="evTarget" value="${esc(init.target)}" placeholder="如 张三 / 24级综合高中1班 / 青年志愿者协会"></label>
    <label>称号<select id="evLevel"><option ${init.level==='优秀'?'selected':''}>优秀</option><option ${init.level==='表扬'?'selected':''}>表扬</option><option ${init.level==='嘉奖'?'selected':''}>嘉奖</option><option ${init.level==='突出贡献'?'selected':''}>突出贡献</option></select></label>
    <label class="full">评定事由<textarea id="evReason" placeholder="如：年度服务时长第一 / 积极参与活动">${esc(init.reason)}</textarea></label>
  </div></div><div class="modal-foot"><button class="ghost" data-close-modal>取消</button><button class="primary" id="evSave">保存评优</button></div></div>`);
  $('#evSave').onclick=()=>{const o={id:uid('ev'),time:now(),creator:currentUser.name,year:$('#evYear').value.trim()||(new Date().getFullYear()+' 年'),type:$('#evType').value,target:$('#evTarget').value.trim(),level:$('#evLevel').value,reason:$('#evReason').value.trim()};if(!o.target)return toast('请填写对象','err');DB.evaluations.unshift(o);saveDB();pushLog('评优',`评定 ${o.target} 为 ${o.level}（${o.type}）`);closeModal();renderEval($('#viewRoot'));toast('已保存','ok')};
};
window.quickEval=function(type,target,idCard,dept,cls,hours){
  if(!canEdit())return toast('仅管理员可评定','err');
  openEvalForm(null,{type:type,target:target,level:'优秀',reason:`年度服务时长 ${hours} 小时`});
};
window.delEval=(id)=>{confirmDialog('确认撤销此评优？',()=>{DB.evaluations=DB.evaluations.filter(e=>e.id!==id);saveDB();renderEval($('#viewRoot'));toast('已撤销','ok')})};
window.exportEvalList=function(){
  const rows=DB.evaluations.map(e=>({年度:e.year,类型:e.type,对象:e.target,称号:e.level,事由:e.reason,评定人:e.creator,时间:e.time}));
  const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'评优名单');XLSX.writeFile(wb,`评优评先名单_${today()}.xlsx`);toast('已导出','ok');
};

/* ============================== 人员全景（全局搜索身份证） ============================== */
window.showProfile=function(uid){
  const u=DB.users.find(x=>x.id===uid);if(!u)return;
  const sv=DB.services.filter(s=>s.name===u.name&&s.idCard===u.idCard).sort((a,b)=>String(b.startDT).localeCompare(String(a.startDT)));
  const total=sv.reduce((s,x)=>s+durationHours(x.startDT,x.endDT),0).toFixed(1);
  const signIns=sv.filter(s=>s.recordType==='signin');
  const taskSubs=[];
  DB.tasks.forEach(t=>{(t.signups||[]).forEach(s=>{if(s.name===u.name||s.idCard===u.idCard)taskSubs.push({t,s})})});
  const actSubs=[];
  DB.activities.forEach(a=>{(a.signups||[]).forEach(s=>{if(s.name===u.name||s.idCard===u.idCard)actSubs.push({a,s})})});
  const evs=(DB.evaluations||[]).filter(e=>e.type==='成员'&&e.target===u.name);
  const logs=(DB.logs||[]).filter(l=>l.user===u.name).slice(0,20);
  const rep=(DB.reports||[]).filter(r=>r.reporter===u.name);
  openModal(`<div class="modal wide"><div class="modal-title"><span class="bar"></span>人员全景 · ${esc(u.name)}<span class="bar"></span><button class="x" data-close-modal>×</button></div><div class="modal-body">
    <div class="page-block" style="margin-bottom:12px;"><div class="block-head" style="height:auto;padding:10px 14px;"><div class="title" style="font-size:14px;">基础信息</div></div><div class="block-body"><div class="kv" style="grid-template-columns:repeat(4,1fr);">${[['姓名',u.name],['身份证',u.idCard],['性别',u.gender||'-'],['专业部',u.dept||'-'],['班级',u.cls||'-'],['部门',u.org||'-'],['职位',u.position||u.title||'-'],['角色',roleLabel(u.role)],['状态',u.status||'正常在岗'],['服务次数',sv.length+' 次'],['累计时长',total+' 小时'],['签到次数',signIns.length+' 次']].map(([l,v])=>`<div><div class="l">${esc(l)}</div><div class="v">${esc(v)}</div></div>`).join('')}</div></div></div>
    <div class="page-block" style="margin-bottom:12px;"><div class="block-head" style="height:auto;padding:10px 14px;"><div class="title" style="font-size:14px;">服务记录（共 ${sv.length} 次 · ${total} h）</div><div class="ops"><button class="ghost" style="height:26px;padding:0 12px;" onclick="exportCertPDF('${u.id}')">导出档案</button><button class="ghost" style="height:26px;padding:0 12px;" onclick="exportServicePDF('${u.id}')">导出服务</button><button class="ghost" style="height:26px;padding:0 12px;" onclick="exportProofPDF('${u.id}')">导出证明</button></div></div><div class="block-body">${sv.length?`<table class="tbl"><thead><tr><th>日期</th><th>活动</th><th>专业部/班级</th><th>时长(h)</th><th>来源</th><th>负责人</th></tr></thead><tbody>${sv.map(s=>`<tr><td class="nowrap">${esc(s.startDT.slice(0,10))}</td><td>${esc(s.activity)}</td><td>${esc(s.dept||'-')} / ${esc(s.cls||'-')}</td><td class="ctr">${durationHours(s.startDT,s.endDT)}</td><td><span class="tag ${s.recordType==='signin'?'ok':'gray'}">${s.recordType==='signin'?'签到':'录入'}</span></td><td>${esc(s.serviceBy||'-')}</td></tr>`).join('')}</tbody></table>`:'<div class="empty-tip">暂无服务记录</div>'}</div></div>
    <div class="row-2 mb-12">
      <div class="page-block" style="margin-bottom:0;"><div class="block-head" style="height:auto;padding:10px 14px;"><div class="title" style="font-size:14px;">活动报名（${actSubs.length}）</div></div><div class="block-body">${actSubs.length?`<table class="tbl"><thead><tr><th>报名时间</th><th>活动</th><th>活动日期</th></tr></thead><tbody>${actSubs.map(({a,s})=>`<tr><td>${esc((s.time||'').slice(0,16))}</td><td>${esc(a.title)}</td><td>${esc((a.startDT||'').slice(0,10))}</td></tr>`).join('')}</tbody></table>`:'<div class="empty-tip">暂无活动报名</div>'}</div></div>
      <div class="page-block" style="margin-bottom:0;"><div class="block-head" style="height:auto;padding:10px 14px;"><div class="title" style="font-size:14px;">任务报名（${taskSubs.length}）</div></div><div class="block-body">${taskSubs.length?`<table class="tbl"><thead><tr><th>报名时间</th><th>任务</th><th>发布人</th></tr></thead><tbody>${taskSubs.map(({t,s})=>`<tr><td>${esc((s.time||'').slice(0,16))}</td><td>${esc(t.title)}</td><td>${esc(t.publisher)}</td></tr>`).join('')}</tbody></table>`:'<div class="empty-tip">暂无任务报名</div>'}</div></div>
    </div>
    <div class="row-2 mb-12">
      <div class="page-block" style="margin-bottom:0;"><div class="block-head" style="height:auto;padding:10px 14px;"><div class="title" style="font-size:14px;">评优记录（${evs.length}）</div></div><div class="block-body">${evs.length?`<table class="tbl"><thead><tr><th>年度</th><th>称号</th><th>事由</th><th>评定人</th></tr></thead><tbody>${evs.map(e=>`<tr><td>${esc(e.year)}</td><td><span class="tag ok">${esc(e.level)}</span></td><td>${esc(e.reason||'')}</td><td>${esc(e.creator)}</td></tr>`).join('')}</tbody></table>`:'<div class="empty-tip">暂无评优</div>'}</div></div>
      <div class="page-block" style="margin-bottom:0;"><div class="block-head" style="height:auto;padding:10px 14px;"><div class="title" style="font-size:14px;">举报记录（${rep.length}）</div></div><div class="block-body">${rep.length?`<table class="tbl"><thead><tr><th>时间</th><th>类型</th><th>内容</th><th>状态</th></tr></thead><tbody>${rep.map(r=>`<tr><td class="nowrap">${esc((r.createdAt||'').slice(0,16))}</td><td>${esc(r.kind)}</td><td>${esc((r.content||'').slice(0,40))}</td><td><span class="tag">${esc(r.status||'pending')}</span></td></tr>`).join('')}</tbody></table>`:'<div class="empty-tip">暂无举报</div>'}</div></div>
    </div>
    <div class="page-block" style="margin-bottom:0;"><div class="block-head" style="height:auto;padding:10px 14px;"><div class="title" style="font-size:14px;">操作日志（最近 ${logs.length} 条）</div></div><div class="block-body">${logs.length?`<table class="tbl"><thead><tr><th>时间</th><th>操作类型</th><th>内容</th></tr></thead><tbody>${logs.map(l=>`<tr><td class="nowrap">${esc(fmtDateTime(l.time))}</td><td><span class="tag">${esc(l.action)}</span></td><td>${esc(l.content)}</td></tr>`).join('')}</tbody></table>`:'<div class="empty-tip">暂无日志</div>'}</div></div>
  </div><div class="modal-foot"><button class="ghost" data-close-modal>关闭</button></div></div>`);
};
function renderSummary(root){
  DB.summaries=DB.summaries||[];
  const all=DB.summaries.slice().sort((a,b)=>String(b.month).localeCompare(String(a.month)));
  const isMgr=['super','terminal','president','vice','minister','broadcaster','etiquette','subleague'].includes(currentUser.role);
  root.innerHTML=`
    <div class="page-block">${blockHead('总结中心（月度 / 年度）',(isMgr?'<button class="primary" onclick="openSummaryForm()">写总结</button>':''))}
      <div class="block-body">
        ${isMgr?'<div class="tip-line">每位管理员（会长/副会长/部长/广播员/礼仪队/团副总支）每月撰写个人总结，可上传活动图片，格式自定，支持导出 PDF。</div>':''}
        <div class="act-grid">${all.map(s=>`<div class="act-card">
          <div class="top"><div class="ti">${esc(s.title||'工作总结')}</div><span class="tag ${s.type==='年度总结'?'super':'ok'}">${esc(s.type||'月度总结')}</span><span class="tag">${esc(s.month||'')}</span></div>
          <div class="meta"><span>作者：${esc(s.author)}</span><span>部门：${esc(s.org||'-')}</span></div>
          <div class="desc">${esc((s.content||'').slice(0,120))}${(s.content||'').length>120?'…':''}</div>
          ${(s.photos||[]).length?`<div class="gallery" style="grid-template-columns:repeat(4,1fr);">${s.photos.slice(0,4).map(p=>p.dataUrl?`<div class="g-item"><img src="${p.dataUrl}" onclick="viewImg('${p.dataUrl}')"></div>`:'').join('')}</div>`:''}
          <div class="meta"><span>${esc(fmtDateTime(s.createdAt))}</span></div>
          <div class="ops">
            <button onclick="viewSummary('${s.id}')">查看</button>
            <button onclick="exportSummaryPDF('${s.id}')">导出 PDF</button>
            ${s.author===currentUser.name||isSuper()?`<button class="warn" onclick="delSummary('${s.id}')">删除</button>`:''}
          </div>
        </div>`).join('')||'<div class="empty-tip">暂无总结，点击「写总结」开始</div>'}</div>
      </div>
    </div>`;
}
window.openSummaryForm=function(existing){
  const s=existing?DB.summaries.find(x=>x.id===existing):null,isEdit=!!s;
  window._smPhotos=[]; // 每次打开重置，防止上次取消残留的图片串到本次
  const month=s?.month||today().slice(0,7);
  openModal(`<div class="modal wide"><div class="modal-title"><span class="bar"></span>${isEdit?'编辑总结':'写总结'}<span class="bar"></span><button class="x" data-close-modal>×</button></div><div class="modal-body"><div class="form-grid cols-2">
    <label>所属月份<input id="smMonth" type="month" value="${esc(month)}"></label>
    <label>总结类型<select id="smType"><option ${s?.type!=='年度总结'?'selected':''}>月度总结</option><option ${s?.type==='年度总结'?'selected':''}>年度总结</option></select></label>
    <label>总结标题<input id="smTitle" value="${esc(s?.title||'')}" placeholder="如：4 月志愿服务工作总结"></label>
    <label>所属部门<input id="smOrg" value="${esc(s?.org||currentUser.org||'')}"></label>
    <label>作者<input id="smAuthor" value="${esc(s?.author||currentUser.name)}" disabled></label>
    <label class="full">总结内容（格式自定）<textarea id="smContent" style="min-height:200px;line-height:1.8;">${esc(s?.content||'')}</textarea></label>
    <label class="full">上传活动图片（可多张）<input id="smPhotos" type="file" accept="image/*" multiple><div id="smPreview" class="gallery mt-8"></div></label>
  </div></div><div class="modal-foot"><button class="ghost" data-close-modal>取消</button><button class="primary" id="smSave">${isEdit?'保存':'提交'}</button></div></div>`);
  if(s&&s.photos&&s.photos.length){window._smPhotos=s.photos.slice();$('#smPreview').innerHTML=s.photos.map(p=>p.dataUrl?`<div class="g-item"><img src="${p.dataUrl}"></div>`:'').join('');}
  $('#smPhotos').onchange=(ev)=>{const files=Array.from(ev.target.files);Promise.all(files.map(f=>new Promise(r=>{const rd=new FileReader();rd.onload=()=>r({name:f.name,dataUrl:rd.result});rd.readAsDataURL(f)}))).then(arr=>{window._smPhotos=arr;$('#smPreview').innerHTML=arr.map(p=>`<div class="g-item"><img src="${p.dataUrl}"></div>`).join('')})};
  $('#smSave').onclick=()=>{
    const content=$('#smContent').value.trim();
    if(!content)return toast('请填写总结内容','err');
    const o={month:$('#smMonth').value,type:$('#smType').value,title:$('#smTitle').value,org:$('#smOrg').value,author:currentUser.name,content};
    if(window._smPhotos&&window._smPhotos.length)o.photos=window._smPhotos;
    if(isEdit)Object.assign(s,o);else DB.summaries.unshift(Object.assign({id:uid('sm'),createdAt:now()},o));
    saveDB();closeModal();if(currentRoute()==='summary')renderSummary($('#viewRoot'));toast('已保存','ok');
  };
};
window.viewSummary=(id)=>{const s=DB.summaries.find(x=>x.id===id);if(!s)return;openModal(`<div class="modal wide"><div class="modal-title"><span class="bar"></span>${esc(s.title||'工作总结')}<span class="bar"></span><button class="x" data-close-modal>×</button></div><div class="modal-body"><div class="f12 c-3 mb-12">${esc(s.author)} · ${esc(s.org||'-')} · ${esc(s.month)} · ${esc(fmtDateTime(s.createdAt))}</div><div style="font-size:14px;line-height:2;color:var(--ink-2);white-space:pre-wrap;">${esc(s.content||'')}</div>${(s.photos||[]).length?`<div class="gallery mt-16">${s.photos.map(p=>p.dataUrl?`<div class="g-item"><img src="${p.dataUrl}" onclick="viewImg('${p.dataUrl}')"></div>`:'').join('')}</div>`:''}</div><div class="modal-foot"><button class="ghost" data-close-modal>关闭</button><button class="primary" onclick="exportSummaryPDF('${s.id}')">导出 PDF</button></div></div>`)};
window.delSummary=(id)=>confirmDialog('确认删除该总结？',()=>{DB.summaries=DB.summaries.filter(s=>s.id!==id);saveDB();renderSummary($('#viewRoot'));toast('已删除','ok')});
window.exportSummaryPDF=function(id){
  const s=DB.summaries.find(x=>x.id===id);if(!s)return;
  const P=window.CanvasPDF;P.init();
  P.center(s.title||'月度工作总结',P.y,{size:20,bold:true,color:'#c8161d'});P.y+=8;
  P.line(56,P.y,P.W-56,P.y,'#c8161d',1);P.y+=14;
  P.text('单位：'+DB.school,56,P.y,{size:11,color:'#5a5a5a'});P.text('部门：'+(s.org||'-'),P.W/2+10,P.y,{size:11,color:'#5a5a5a'});P.y+=7;
  P.text('总结人：'+s.author,56,P.y,{size:11,color:'#5a5a5a'});P.text('月份：'+s.month,P.W/2+10,P.y,{size:11,color:'#5a5a5a'});P.y+=14;
  const content=String(s.content||'');
  const cw=P.W-112,ls=20;
  content.split('\n').forEach(para=>{
    const chunks=P._wrap(para,cw,12);
    chunks.forEach(ch=>{P.ensure(ls);P.text(ch,56,P.y,{size:12,color:'#1a1a1a'});P.y+=ls;});
    P.y+=6;
  });
  P.y+=8;
  if(s.photos&&s.photos.length){
    P.text('活动图片',56,P.y,{size:14,bold:true,color:'#c8161d'});P.y+=8;
    s.photos.slice(0,6).forEach((p,i)=>{if(!p.dataUrl)return;
      const col=i%3,row=Math.floor(i/3),pw=(P.W-112-24)/3,ph=pw*0.75;
      if(P.y+ph>P.H-40)P.newPage();
      try{const img=new Image();img.src=p.dataUrl;if(img.complete&&img.naturalWidth>0)P.ctx.drawImage(img,56+col*(pw+12),P.y+row*(ph+12),pw,ph);}catch(e){}
    });
  }
  P.save((s.author||'')+'_'+(s.month||'')+'_总结.pdf');toast('已导出 PDF','ok');
};

/* ============================== 高德地图跳转（地址一键导航） ============================== */
window.openMap=function(addr){
  if(!addr)return toast('未填写地点，无法导航','err');
  const key=(DB.amapKey||'').trim();
  const url='https://uri.amap.com/search?keyword='+encodeURIComponent(addr)+'&src=xhzx'+(key?'&key='+encodeURIComponent(key):'');
  const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';
  document.body.appendChild(link);link.click();document.body.removeChild(link);
};
window.openActMap=function(id){
  const a=DB.activities.find(x=>x.id===id);
  window.openMap(a?a.location:'');
};

/* ============================== 年度看板 / 月度看板（支持年份/月份下拉切换） ============================== */
let _ykYear=0,_mkYear=0,_mkMonth=0;
function ykYears(){const ys=new Set();DB.services.forEach(s=>{const y=+(s.startDT||'').slice(0,4);if(y&&y>2000)ys.add(y)});const cy=new Date().getFullYear();ys.add(cy);return Array.from(ys).sort((a,b)=>b-a)}
function renderYearKanban(root){
  if(!_ykYear)_ykYear=ykYears()[0]||new Date().getFullYear();
  root.innerHTML=`
    <div class="notice-strip"><span class="label">年度看板</span><span class="ct">按年度统计 · 数据联动自服务记录、活动、任务、评优等全部模块，切换年份实时更新</span></div>
    <div class="search-bar">
      <div class="field"><div class="l">统计年份</div><select id="ykSel" onchange="ykChange()">${ykYears().map(y=>`<option value="${y}" ${y===_ykYear?'selected':''}>${y} 年</option>`).join('')}</select></div>
      <div class="btns"><button onclick="ykChange()">切 换</button></div>
    </div>
    <div id="ykBody"></div>`;
  drawYearKanban(_ykYear);
}
function ykChange(){_ykYear=+$('#ykSel').value;drawYearKanban(_ykYear)}
function drawYearKanban(year){
  (window._ykCharts||[]).forEach(c=>{try{c.destroy()}catch(e){}});window._ykCharts=[];
  const ystr=String(year);
  const sv=DB.services.filter(s=>(s.startDT||'').slice(0,4)===ystr);
  const totalH=sv.reduce((a,x)=>a+durationHours(x.startDT,x.endDT),0);
  const byMonth={};for(let m=1;m<=12;m++)byMonth[m]=0;sv.forEach(s=>{const m=+s.startDT.slice(5,7);if(byMonth[m]!=null)byMonth[m]+=1});
  const byDept={};sv.forEach(s=>{byDept[s.dept]=(byDept[s.dept]||0)+durationHours(s.startDT,s.endDT)});
  const deptLabels=Object.keys(byDept),deptData=deptLabels.map(d=>+(byDept[d]||0).toFixed(1));
  const acts=(DB.activities||[]).filter(a=>(a.startDT||'').slice(0,4)===ystr);
  const tasks=(DB.tasks||[]).filter(t=>(t.startDT||'').slice(0,4)===ystr);
  const evs=(DB.evaluations||[]).filter(e=>(e.date||e.time||e.createdAt||'').slice(0,4)===ystr);
  $('#ykBody').innerHTML=`
    <div class="stat-row">
      <div class="stat-card"><div class="stat-label">${year} 服务人次</div><div class="stat-value">${sv.length}<span class="unit">人次</span></div></div>
      <div class="stat-card"><div class="stat-label">${year} 累计时长</div><div class="stat-value">${totalH.toFixed(1)}<span class="unit">小时</span></div></div>
      <div class="stat-card"><div class="stat-label">开展活动</div><div class="stat-value">${acts.length}<span class="unit">场</span></div></div>
      <div class="stat-card"><div class="stat-label">发布任务</div><div class="stat-value">${tasks.length}<span class="unit">项</span></div></div>
      <div class="stat-card"><div class="stat-label">评定奖项</div><div class="stat-value">${evs.length}<span class="unit">项</span></div></div>
    </div>
    <div class="row-2 mb-16">
      <div class="page-block">${blockHead('月度服务趋势（人次）','')}<div class="chart-box"><canvas id="ykMonth"></canvas></div></div>
      <div class="page-block">${blockHead('各专业部时长对比（h）','')}<div class="chart-box"><canvas id="ykDept"></canvas></div></div>
    </div>
    <div class="row-2">
      <div class="page-block">${blockHead('政治面貌分布','')}<div class="chart-box"><canvas id="ykPol"></canvas></div></div>
      <div class="page-block">${blockHead('部门业绩梯形榜','')}<div class="block-body"><div id="ykTrap" class="trap-rank"></div></div></div>
    </div>`;
  const push=c=>window._ykCharts.push(c);
  push(new Chart($('#ykMonth'),{type:'line',data:{labels:Object.keys(byMonth).map(m=>m+'月'),datasets:[{label:'服务人次',data:Object.values(byMonth),borderColor:'#c8161d',backgroundColor:'rgba(200,22,29,.08)',fill:true,tension:.35,pointRadius:3,pointBackgroundColor:'#c8161d',borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,grid:{color:'#f0f2f5'},ticks:{font:chartFont()}},x:{grid:{display:false},ticks:{font:chartFont()}}}}}));
  push(new Chart($('#ykDept'),{type:'bar',data:{labels:deptLabels,datasets:[{label:'时长(h)',data:deptData,backgroundColor:'#c8161d',borderRadius:6,maxBarThickness:42}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,grid:{color:'#f0f2f5'},ticks:{font:chartFont()}},x:{grid:{display:false},ticks:{font:chartFont()}}}}}));
  const polMap={};DB.users.forEach(u=>{if(['member','minister','vice','president'].includes(u.role))polMap[u.politics||'未填']=(polMap[u.politics||'未填']||0)+1});const pl=Object.keys(polMap),pd=pl.map(k=>polMap[k]);
  push(new Chart($('#ykPol'),{type:'doughnut',data:{labels:pl,datasets:[{data:pd,backgroundColor:REDS,borderWidth:2,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'right',labels:{font:chartFont(),usePointStyle:true,pointStyle:'circle',boxWidth:7,color:'#5a5a5a'}}}}}));
  const tr=Object.entries(byDept).sort((a,b)=>b[1]-a[1]);const mx=tr.length?tr[0][1]:1;
  $('#ykTrap').innerHTML=tr.map(([n,h],i)=>{const w=Math.max(6,(h/mx*100).toFixed(1));const c=REDS[Math.min(REDS.length-1,i)];return`<div class="trap-row"><span class="trap-no" style="color:${c}">${i+1}</span><span class="trap-name">${esc(n)}</span><span class="trap-bar" style="width:${w}%;background:${c};"></span><span class="trap-val">${h.toFixed(1)} h</span></div>`}).join('')||'<div class="empty-tip">该年度暂无数据</div>';
}
function renderMonthKanban(root){
  const nowD=new Date();
  if(!_mkYear)_mkYear=nowD.getFullYear();
  if(!_mkMonth)_mkMonth=nowD.getMonth()+1;
  root.innerHTML=`
    <div class="notice-strip"><span class="label">月度看板</span><span class="ct">按月统计 · 与服务记录实时联动，切换年月实时更新</span></div>
    <div class="search-bar">
      <div class="field"><div class="l">统计年份</div><select id="mkYearSel" onchange="mkChange()">${ykYears().map(y=>`<option value="${y}" ${y===_mkYear?'selected':''}>${y} 年</option>`).join('')}</select></div>
      <div class="field"><div class="l">统计月份</div><select id="mkMonthSel" onchange="mkChange()">${Array.from({length:12},(_,i)=>i+1).map(m=>`<option value="${m}" ${m===_mkMonth?'selected':''}>${m} 月</option>`).join('')}</select></div>
      <div class="btns"><button onclick="mkChange()">切 换</button></div>
    </div>
    <div id="mkBody"></div>`;
  drawMonthKanban(_mkYear,_mkMonth);
}
function mkChange(){_mkYear=+$('#mkYearSel').value;_mkMonth=+$('#mkMonthSel').value;drawMonthKanban(_mkYear,_mkMonth)}
function drawMonthKanban(y,m){
  (window._mkCharts||[]).forEach(c=>{try{c.destroy()}catch(e){}});window._mkCharts=[];
  const prefix=y+'-'+String(m).padStart(2,'0');
  const sv=DB.services.filter(s=>(s.startDT||'').slice(0,7)===prefix);
  const totalH=sv.reduce((a,x)=>a+durationHours(x.startDT,x.endDT),0);
  const byDay={};for(let d=1;d<=new Date(y,m,0).getDate();d++)byDay[d]=0;sv.forEach(s=>{const dd=+s.startDT.slice(8,10);if(byDay[dd]!=null)byDay[dd]+=1});
  const byDept={};sv.forEach(s=>{byDept[s.dept]=(byDept[s.dept]||0)+1});
  const dl=Object.keys(byDept),dd=dl.map(k=>byDept[k]);
  const mActs=(DB.activities||[]).filter(a=>(a.startDT||'').slice(0,7)===prefix);
  const mSign=(DB.activities||[]).reduce((a,x)=>a+(x.signups||[]).filter(s=>s.time&&s.time.slice(0,7)===prefix).length,0);
  $('#mkBody').innerHTML=`
    <div class="notice-strip"><span class="label">${prefix}</span><span class="ct">${y} 年 ${m} 月志愿服务态势</span></div>
    <div class="stat-row">
      <div class="stat-card"><div class="stat-label">本月服务人次</div><div class="stat-value">${sv.length}<span class="unit">人次</span></div></div>
      <div class="stat-card"><div class="stat-label">本月累计时长</div><div class="stat-value">${totalH.toFixed(1)}<span class="unit">小时</span></div></div>
      <div class="stat-card"><div class="stat-label">本月活动</div><div class="stat-value">${mActs.length}<span class="unit">场</span></div></div>
      <div class="stat-card"><div class="stat-label">本月报名</div><div class="stat-value">${mSign}<span class="unit">人</span></div></div>
    </div>
    <div class="row-2 mb-16">
      <div class="page-block">${blockHead('本月每日服务趋势（人次）','')}<div class="chart-box"><canvas id="mkDay"></canvas></div></div>
      <div class="page-block">${blockHead('本月各专业部人次','')}<div class="chart-box"><canvas id="mkDept"></canvas></div></div>
    </div>
    <div class="page-block">${blockHead('本月服务明细','<button class="ghost" onclick="goto(\'service\')">前往服务与加分</button>')}<div class="block-body">${sv.length?`<table class="tbl"><thead><tr><th>日期</th><th>活动</th><th>专业部</th><th>班级</th><th>姓名</th><th>时长(h)</th></tr></thead><tbody>${sv.slice().sort((a,b)=>String(b.startDT).localeCompare(String(a.startDT))).map(s=>`<tr><td>${esc(s.startDT.slice(0,10))}</td><td>${esc(s.activity)}</td><td>${esc(s.dept)}</td><td>${esc(s.cls)}</td><td>${esc(s.name)}</td><td class="ctr">${durationHours(s.startDT,s.endDT)}</td></tr>`).join('')}</tbody></table>`:'<div class="empty-tip">本月暂无服务记录</div>'}</div></div>`;
  const push=c=>window._mkCharts.push(c);
  push(new Chart($('#mkDay'),{type:'line',data:{labels:Object.keys(byDay).map(d=>d+'日'),datasets:[{label:'人次',data:Object.values(byDay),borderColor:'#c8161d',backgroundColor:'rgba(200,22,29,.08)',fill:true,tension:.3,pointRadius:2,pointBackgroundColor:'#c8161d',borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,grid:{color:'#f0f2f5'},ticks:{font:chartFont()}},x:{grid:{display:false},ticks:{font:chartFont()}}}}}));
  push(new Chart($('#mkDept'),{type:'bar',data:{labels:dl,datasets:[{label:'人次',data:dd,backgroundColor:'#c8161d',borderRadius:6,maxBarThickness:40}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,grid:{color:'#f0f2f5'},ticks:{font:chartFont()}},x:{grid:{display:false},ticks:{font:chartFont()}}}}}));
}

/* ============================== 团员名额（推荐 → 申请中心，含流转痕迹） ============================== */
function renderQuota(root){
  DB.quotas=DB.quotas||[];
  const isMgr=isAdmin()||canEdit();
  const list=DB.quotas.slice().sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  const statusTag=st=>({recommend:'<span class="tag warn">推荐中</span>',review:'<span class="tag">审核中</span>',approved:'<span class="tag ok">已通过</span>',rejected:'<span class="tag gray">已驳回</span>'})[st]||'<span class="tag">推荐中</span>';
  const quotaTraceHtml=q=>{const tr=q.trace||[];if(!tr.length)return'<span class="f12 c-3">暂无痕迹</span>';return'<div class="trace">'+tr.map(t=>`<span class="trace-dot ${t.st}"></span>${esc(t.act)}·${esc((t.time||'').slice(5,16))}`).join(' ')+'</div>'};
  const quotaOpsHtml=q=>{if(!isMgr)return'';if(q.status==='review')return`<td><div class="ops-col"><button class="ok" onclick="quotaApprove('${q.id}')">通过</button><button class="warn" onclick="quotaReject('${q.id}')">驳回</button></div></td>`;if(q.status==='recommend')return`<td><div class="ops-col"><button class="ok" onclick="quotaSubmit('${q.id}')">送审</button></div></td>`;return'<td>-</td>'};
  const rowsHtml=list.length?list.map(q=>`<tr><td class="nowrap">${esc(fmtDateTime(q.createdAt))}</td><td><b>${esc(q.name)}</b></td><td>${esc(q.dept||'-')} / ${esc(q.cls||'-')}</td><td>${esc(q.kind||'推荐')}</td><td>${esc((q.reason||'').slice(0,30))}</td><td>${statusTag(q.status)}</td><td>${quotaTraceHtml(q)}</td>${quotaOpsHtml(q)}</tr>`).join(''):`<tr><td colspan="${isMgr?8:7}" class="empty">—— 暂无名额申请 ——</td></tr>`;
  root.innerHTML=`
    <div class="page-block">${blockHead('团员名额 · 推荐与申请中心','<button class="primary" onclick="openQuotaForm()">提交名额申请</button>')}
      <div class="block-body">
        <div class="tip-line">团员发展名额由部门推荐或本人自荐，提交后自动进入「审核中心」待办，超级管理员 / 终端管理员审核；全程留痕（推荐 → 送审 → 审核 → 通过 / 驳回）。</div>
        <div class="tbl-shell scroll-x"><table class="tbl"><thead><tr><th>提交时间</th><th>推荐人选</th><th>专业部 / 班级</th><th>申请类型</th><th>事由</th><th>状态</th><th>流转痕迹</th>${isMgr?'<th>操作</th>':''}</tr></thead><tbody>${rowsHtml}</tbody></table></div>
      </div>
    </div>`;
}
window.openQuotaForm=function(){
  const isMember=!canEdit();
  openModal(`<div class="modal"><div class="modal-title"><span class="bar"></span>团员名额申请<span class="bar"></span><button class="x" data-close-modal>×</button></div><div class="modal-body"><div class="form-grid cols-2">
    <label>申请类型<select id="qKind">${isMember?'<option>个人自荐</option>':'<option>组织推荐</option><option>个人自荐</option><option>团支部推优</option>'}</select></label>
    <label>推荐人选<input id="qName" placeholder="被推荐人姓名"></label>
    <label>专业部<select id="qDept"><option value="">-</option>${(DB.dictionaries.departments||[]).map(d=>`<option>${d}</option>`).join('')}</select></label>
    <label>班级<input id="qCls" placeholder="如：2024级计算机5班（格式：XXXX级专业XX班）"></label>
    <label class="full">推荐 / 申请事由<textarea id="qReason" placeholder="说明该人选的志愿服务表现与推优理由"></textarea></label>
  </div></div><div class="modal-foot"><button class="ghost" data-close-modal>取消</button><button class="primary" id="qSave">提交</button></div></div>`);
  $('#qSave').onclick=()=>{const name=$('#qName').value.trim();if(!name)return toast('请填写推荐人选','err');const o={id:uid('q'),name,dept:$('#qDept').value,cls:$('#qCls').value,kind:$('#qKind').value,reason:$('#qReason').value.trim(),status:'recommend',createdAt:now(),trace:[{act:'提交推荐',st:'recommend',time:now(),by:currentUser.name}]};
    DB.quotas.unshift(o);saveDB();if(window.ZY)ZY.push();pushNotify({to:'超级管理员',kind:'audit',title:'团员名额申请',content:`${name} 的名额申请已提交，请到审核中心处理`});pushNotify({to:'终端管理员',kind:'audit',title:'团员名额申请',content:`${name} 的名额申请已提交，请到审核中心处理`});pushNotify({to:'会 长',kind:'audit',title:'团员名额申请',content:`${name} 的名额申请已提交，请到审核中心处理`});pushLog('团员名额','提交 '+name+' 的名额推荐');closeModal();if(currentRoute()==='quota')renderQuota($('#viewRoot'));else if(currentRoute()==='audit')renderAudit($('#viewRoot'));toast('已提交，进入审核中心待办','ok')};
};
window.quotaSubmit=function(id){const q=DB.quotas.find(x=>x.id===id);if(!q)return;q.status='review';q.trace=q.trace||[];q.trace.push({act:'送审',st:'review',time:now(),by:currentUser.name});saveDB();if(window.ZY)ZY.push();pushNotify({to:'超级管理员',kind:'audit',title:'团员名额送审',content:`${q.name} 的名额申请已送审，请到审核中心处理`});pushNotify({to:'终端管理员',kind:'audit',title:'团员名额送审',content:`${q.name} 的名额申请已送审，请到审核中心处理`});pushLog('团员名额','送审 '+q.name);if(currentRoute()==='quota')renderQuota($('#viewRoot'));else if(currentRoute()==='audit')renderAudit($('#viewRoot'));toast('已送审','ok')};
window.quotaApprove=function(id){const q=DB.quotas.find(x=>x.id===id);if(!q)return;q.status='approved';q.trace=q.trace||[];q.trace.push({act:'审核通过',st:'approved',time:now(),by:currentUser.name});saveDB();if(window.ZY)ZY.push();pushNotify({to:q.name,kind:'sys',title:'团员名额通过',content:`您（${q.name}）的团员名额申请已通过审核。`});pushLog('团员名额','通过 '+q.name);if(currentRoute()==='quota')renderQuota($('#viewRoot'));else if(currentRoute()==='audit')renderAudit($('#viewRoot'));toast('已通过','ok')};
window.quotaReject=function(id){const q=DB.quotas.find(x=>x.id===id);if(!q)return;const r=prompt('驳回原因：');q.status='rejected';q.trace=q.trace||[];q.trace.push({act:'驳回'+(r?('：'+r):''),st:'rejected',time:now(),by:currentUser.name});saveDB();if(window.ZY)ZY.push();pushNotify({to:q.name,kind:'sys',title:'团员名额驳回',content:`您（${q.name}）的团员名额申请未通过${r?('：'+r):''}。`});pushLog('团员名额','驳回 '+q.name);if(currentRoute()==='quota')renderQuota($('#viewRoot'));else if(currentRoute()==='audit')renderAudit($('#viewRoot'));toast('已驳回','ok')};

/* ============================== 数据维护：恢复演示数据 / 清除所有演示数据（不退出系统） ============================== */
window.restoreDemo=function(){
  if(!confirm('确认恢复演示数据？将覆盖当前所有数据为演示状态（含示例档案/活动/服务/通知等），之后可随时点「清除所有演示数据」回到纯净。建议先导出 Excel 备份！')) return;
  if(!window.buildDemoData){ toast('演示数据模块未加载，请强刷页面','err'); return; }
  DB=normalizeDB(buildDemoData());
  saveDB();
  try{ if(window.ZY) ZY.push(); }catch(e){}
  if(window.renderRoute) renderRoute();
  if(window.updateNotifyBadge) updateNotifyBadge();
  if(window.buildSidebar) buildSidebar();
  toast('已恢复演示数据（演示模式）','ok');
};
window.clearAllDemo=async function(){
  if(!confirm('确认清除所有演示数据？将清空档案/活动/服务/任务/通知/总结/名额等全部业务数据，只保留系统账号与词典结构，方便录入你的真实数据。该操作不可恢复，请先导出 Excel 备份！')) return;
  const sysIds=['u-super','u-term','u-dev'];
  DB.users=(DB.users||[]).filter(u=>sysIds.includes(u.id));
  ['activities','services','tasks','news','notifies','broadcastRecs','etiquetteRecs','subleagueRecs','quotas','evaluations','reports','summaries','logs','traces'].forEach(k=>{ DB[k]=[]; });
  DB.nextIds={user:100,service:10,activity:10,task:10,news:10,notify:10,summary:10,report:10};
  saveDB();
  /* 关键修复：必须等待云端上传完成再返回，否则退出登录/刷新会把"清空"打断，
     云端仍是旧演示数据，重新登录又被同步回来，演示数据"死灰复燃"。
     同时清空注册队列 zy_regs 与审核状态 zy_status，释放被占用的身份证 */
  try{
    if(window.ZY){
      const p=await ZY.push(); if(p&&!p.ok) toast('本地已清空，但云端同步失败：'+(p.msg||'')+'，请检查网络后重试','err');
      const c=ZY.cfg, h={'apikey':c.key,'Authorization':'Bearer '+c.key,'Content-Type':'application/json'};
      await fetch(c.url+'/rest/v1/zy_regs?id=not.is.null',{method:'DELETE',headers:h});
      await fetch(c.url+'/rest/v1/zy_status?id_card=not.is.null',{method:'DELETE',headers:h});
    }
  }catch(e){}
  if(window.renderRoute) renderRoute();
  if(window.updateNotifyBadge) updateNotifyBadge();
  if(window.buildSidebar) buildSidebar();
  toast('已清除所有演示数据并同步云端，可直接录入真实数据','ok');
};

/* 启动入口：app.js 与 app-biz.js 均已加载完成后执行 */
boot();
