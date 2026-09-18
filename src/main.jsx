import React,{useEffect,useMemo,useState}from'react';
import{createRoot}from'react-dom/client';
import'./styles.css';

const seed={
  name:'暮光边境',system:'D&D 5E',
  sessions:[
    {id:1,tag:'主线',color:'#d8a153',revisions:[{title:'第一章：灰港的钟声',date:'2024-06-08',summary:'队伍抵达灰港，在失落的钟楼发现了神秘符文。',characters:['艾德里安','瑟琳'],reason:'初始记录',at:'2024-06-08T20:00:00+08:00'}]},
    {id:2,tag:'主线',color:'#93b7a6',revisions:[{title:'第二章：雾中来客',date:'2024-06-15',summary:'与流浪法师伊琳结盟，追踪海雾中的脚印。',characters:['瑟琳','莫尔'],reason:'初始记录',at:'2024-06-15T20:00:00+08:00'}]},
    {id:3,tag:'支线',color:'#b9a6d1',revisions:[{title:'支线：深林采药',date:'2024-06-22',summary:'帮助村民寻找月光草，获得一枚古老铜币。',characters:['艾德里安','莫尔'],reason:'初始记录',at:'2024-06-22T20:00:00+08:00'}]}
  ],
  characters:[
    {name:'艾德里安',role:'圣骑士',player:'林默',color:'#d8a153'},
    {name:'瑟琳',role:'游侠',player:'安然',color:'#93b7a6'},
    {name:'莫尔',role:'术士',player:'周岳',color:'#b9a6d1'}
  ]
};

// 旧版本数据迁移：把扁平章节包上一层修订链，保证刷新后结构一致
const normalize=d=>{
  const sessions=(d.sessions||[]).map(s=>s.revisions?s:{id:s.id,tag:s.tag,color:s.color,revisions:[{title:s.title,date:s.date,summary:s.summary,characters:s.characters||[],reason:'初始记录',at:new Date().toISOString()}]});
  return{...seed,...d,sessions};
};
const read=()=>{try{const d=JSON.parse(localStorage.getItem('campaign-log'));return d?normalize(d):seed}catch{return seed}};
const cur=s=>s.revisions[s.revisions.length-1];
const uniq=a=>[...new Set(a)];
const emptyForm={title:'',date:'2024-07-01',summary:'',tag:'主线',characters:[],reason:''};

function App(){
  const[data,setData]=useState(read);
  const[tab,setTab]=useState('timeline');
  const[active,setActive]=useState(1);
  const[modal,setModal]=useState(null);// null | {mode:'new'} | {mode:'edit',id}
  const[notice,setNotice]=useState('');
  const[error,setError]=useState('');
  const[form,setForm]=useState(emptyForm);
  const[newChar,setNewChar]=useState({name:'',role:'',player:''});
  const[openChar,setOpenChar]=useState(null);

  useEffect(()=>localStorage.setItem('campaign-log',JSON.stringify(data)),[data]);
  useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),2600);return()=>clearTimeout(t)},[notice]);

  // 时间线按游戏内日期排序，刷新后顺序稳定
  const sorted=useMemo(()=>[...data.sessions].sort((a,b)=>cur(a).date.localeCompare(cur(b).date)||a.id-b.id),[data.sessions]);
  const earliest=useMemo(()=>sorted.length?cur(sorted[0]).date:null,[sorted]);
  const session=data.sessions.find(x=>x.id===active)||sorted[0];
  const rev=session?cur(session):null;

  // 每位角色的出场章节（按当前修订计算）
  const appearances=useMemo(()=>{
    const m={};
    data.sessions.forEach(s=>uniq(cur(s).characters).forEach(n=>{(m[n]=m[n]||[]).push(s)}));
    return m;
  },[data.sessions]);

  const toggleChar=n=>setForm(f=>({...f,characters:f.characters.includes(n)?f.characters.filter(x=>x!==n):[...f.characters,n]}));

  // 校验：至少一位已知角色、必填摘要、日期不早于已有最早章节（编辑时排除自身）
  const validate=(f,excludeId)=>{
    if(!f.title.trim())return'请填写章节标题';
    if(!f.summary.trim())return'请填写章节摘要';
    if(!f.date)return'请选择游戏内日期';
    if(!f.characters.length)return'请至少选择一位已知角色';
    const known=data.characters.map(c=>c.name);
    if(f.characters.some(n=>!known.includes(n)))return'只能选择名册中的已知角色';
    const others=data.sessions.filter(s=>s.id!==excludeId);
    if(others.length){const min=others.map(s=>cur(s).date).sort()[0];if(f.date<min)return`日期不能早于已有最早章节（${min}）`}
    return'';
  };

  const openNew=()=>{setForm({...emptyForm,date:earliest||'2024-07-01'});setError('');setModal({mode:'new'})};
  const openEdit=s=>{const r=cur(s);setForm({title:r.title,date:r.date,summary:r.summary,tag:s.tag,characters:[...r.characters],reason:''});setError('');setModal({mode:'edit',id:s.id})};

  const save=()=>{
    const excludeId=modal.mode==='edit'?modal.id:null;
    const err=validate(form,excludeId);
    if(err)return setError(err);
    if(modal.mode==='edit'&&!form.reason.trim())return setError('修改已保存章节必须填写修改原因');
    const revision={title:form.title.trim(),date:form.date,summary:form.summary.trim(),characters:uniq(form.characters),reason:modal.mode==='edit'?form.reason.trim():'初始记录',at:new Date().toISOString()};
    if(modal.mode==='new'){
      const s={id:Date.now(),tag:form.tag,color:'#d8a153',revisions:[revision]};
      setData({...data,sessions:[...data.sessions,s]});
      setActive(s.id);
      setNotice('新章节已加入时间线');
    }else{
      setData({...data,sessions:data.sessions.map(s=>s.id===modal.id?{...s,tag:form.tag,revisions:[...s.revisions,revision]}:s)});
      setNotice(`已生成第 ${session.revisions.length+1} 版修订，旧内容仍可查看`);
    }
    setModal(null);setError('');
  };

  const addCharacter=()=>{
    const n=newChar.name.trim();
    if(!n)return;
    if(data.characters.some(c=>c.name===n))return setNotice(`角色「${n}」已存在`);
    setData({...data,characters:[...data.characters,{name:n,role:newChar.role.trim()||'冒险者',player:newChar.player.trim()||'—',color:'#8fb0c9'}]});
    setNewChar({name:'',role:'',player:''});
    setNotice(`角色「${n}」已加入名册`);
  };

  const removeCharacter=c=>{
    const linked=appearances[c.name]?.length||0;
    if(linked>0)return setNotice(`「${c.name}」仍关联 ${linked} 个章节，必须保留`);
    setData({...data,characters:data.characters.filter(x=>x.name!==c.name)});
    setNotice(`角色「${c.name}」已移出名册`);
  };

  const gotoChapter=id=>{setActive(id);setTab('timeline')};

  const exportData=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='campaign.json';a.click();setNotice('战役记录已导出')};

  return <div className="shell">
    <aside>
      <div className="logo"><span>✦</span> CAMPAIGNER</div>
      <div className="campaign"><small>当前战役</small><strong>{data.name}</strong><span>{data.system} · 2024</span></div>
      <nav>{[['timeline','◌','时间线'],['characters','♙','角色与阵营'],['places','⌖','地点图鉴'],['loot','◇','战利品']].map(([id,i,t])=><button className={tab===id?'active':''} onClick={()=>setTab(id)} key={id}><i>{i}</i>{t}</button>)}</nav>
      <div className="side-bottom"><button>⚙ 偏好设置</button><small>本地存储已开启</small></div>
    </aside>
    <main>
      <header>
        <div><span className="crumb">MY CAMPAIGN / {data.system}</span><h1>{tab==='timeline'?'战役时间线':tab==='characters'?'角色与阵营':tab==='places'?'地点图鉴':'战利品'}</h1></div>
        <div className="actions"><button onClick={exportData} className="outline">↓ 导出</button><button onClick={openNew} className="primary">＋ 新建章节</button></div>
      </header>

      {tab==='timeline'&&<div className="timeline-layout">
        <section className="timeline">
          <div className="timeline-intro"><div><span>THE CHRONICLE</span><h2>记录每一次冒险</h2></div><span className="count">{data.sessions.length} CHAPTERS</span></div>
          {sorted.map((s,i)=>{const r=cur(s);return<button className={'chapter '+(active===s.id?'selected':'')} onClick={()=>setActive(s.id)} key={s.id}>
            <div className="date"><b>{new Date(r.date+'T00:00:00').toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'})}</b><small>{r.date.slice(0,4)}</small></div>
            <div className="line"><span style={{background:s.color}}></span>{i<sorted.length-1&&<i/>}</div>
            <div className="chapter-copy"><div className="tag">{s.tag}</div><h3>{r.title}</h3><p>{r.summary}</p><div className="who">{uniq(r.characters).join(' · ')}{s.revisions.length>1&&<em>　v{s.revisions.length}</em>}</div></div>
            <span className="arrow">↗</span>
          </button>})}
        </section>
        {session&&<section className="detail-panel">
          <div className="detail-cover" style={{background:session.color}}><span>CHAPTER {String(sorted.findIndex(x=>x.id===session.id)+1).padStart(2,'0')}</span><i>✦</i></div>
          <div className="detail-body">
            <span className="tag">{session.tag}</span>
            <h2>{rev.title}</h2>
            <p>{rev.summary}</p>
            <div className="meta-grid">
              <div><small>游戏日期</small><strong>{rev.date}</strong></div>
              <div><small>出场角色</small><strong>{uniq(rev.characters).join('、')}</strong></div>
            </div>
            <div className="note"><span>✎</span><div><strong>修订</strong><p>修改将生成带原因的新修订，旧版本保留在下方修订链中。</p></div><button onClick={()=>openEdit(session)}>编辑</button></div>
            <div className="rev-block">
              <div className="rev-head">修订链 · {session.revisions.length} 版</div>
              {[...session.revisions].reverse().map((r,i)=>{const v=session.revisions.length-i;return<div className={'rev '+(i===0?'current':'')} key={r.at+v}>
                <div className="rev-top"><b>v{v}</b><span>{new Date(r.at).toLocaleString('zh-CN')}</span>{i===0&&<em>当前</em>}</div>
                <div className="rev-reason">原因：{r.reason}</div>
                <div className="rev-body">{r.date} · {r.title} — {r.summary}</div>
                <div className="rev-who">出场：{uniq(r.characters).join('、')||'—'}</div>
              </div>})}
            </div>
          </div>
        </section>}
      </div>}

      {tab==='characters'&&<section className="cards">
        <div className="section-note">队伍中有 {data.characters.length} 位冒险者。仍有关联章节的角色必须保留，点击卡片查看关联章节。</div>
        <div className="addchar">
          <input placeholder="新角色名" value={newChar.name} onChange={e=>setNewChar({...newChar,name:e.target.value})}/>
          <input placeholder="职业" value={newChar.role} onChange={e=>setNewChar({...newChar,role:e.target.value})}/>
          <input placeholder="玩家" value={newChar.player} onChange={e=>setNewChar({...newChar,player:e.target.value})}/>
          <button className="primary" onClick={addCharacter}>＋ 加入名册</button>
        </div>
        {data.characters.map(c=>{const linked=appearances[c.name]||[];return<article className="char-card" key={c.name}>
          <div className="avatar" style={{background:c.color}}>{c.name[0]}</div>
          <div>
            <small>{c.role}</small>
            <h3>{c.name}</h3>
            <p>玩家 · {c.player}　·　出场 {linked.length} 章</p>
            {openChar===c.name&&<div className="char-chapters">
              {linked.length?linked.map(s=><button className="linkbtn" key={s.id} onClick={()=>gotoChapter(s.id)}>↗ {cur(s).date}　{cur(s).title}</button>):<span>暂无关联章节</span>}
            </div>}
          </div>
          <div className="char-actions">
            <button onClick={()=>setOpenChar(openChar===c.name?null:c.name)} title="查看关联章节">↗</button>
            <button className={'del '+(linked.length?'locked':'')} title={linked.length?`仍关联 ${linked.length} 个章节，必须保留`:'移出名册'} onClick={()=>removeCharacter(c)}>{linked.length?'🔒':'×'}</button>
          </div>
        </article>})}
      </section>}

      {tab==='places'&&<section className="empty"><div>⌖</div><h2>地点图鉴</h2><p>从章节笔记中收集地点。当前已记录灰港、雾林和失落钟楼。</p><div className="place-list"><span>01　灰港 <b>已探索</b></span><span>02　失落钟楼 <b>已探索</b></span><span>03　雾林 <b>待探索</b></span></div></section>}
      {tab==='loot'&&<section className="empty"><div>◇</div><h2>战利品清单</h2><p>追踪旅途中获得的装备、遗物和金币。</p><div className="place-list"><span>月光草 × 3 <b>消耗品</b></span><span>古老铜币 × 1 <b>遗物</b></span><span>灰港守卫徽章 × 2 <b>任务物品</b></span></div></section>}
    </main>

    {modal&&<div className="modal-bg"><div className="modal">
      <button className="close" onClick={()=>setModal(null)}>×</button>
      <span className="crumb">{modal.mode==='new'?'NEW CHAPTER':'NEW REVISION'}</span>
      <h2>{modal.mode==='new'?'记录新的章节':'修订已保存章节'}</h2>
      <label>章节标题<input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="例：第三章：月下集市"/></label>
      <label>游戏日期<input type="date" min={modal.mode==='new'?earliest:undefined} value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label>
      <label>章节摘要<textarea rows="3" value={form.summary} onChange={e=>setForm({...form,summary:e.target.value})} placeholder="发生了什么？"/></label>
      <label>出场角色（至少一位，不可重复）</label>
      <div className="chips">{data.characters.map(c=><button type="button" key={c.name} className={'chip '+(form.characters.includes(c.name)?'on':'')} onClick={()=>toggleChar(c.name)}>{form.characters.includes(c.name)?'✓ ':''}{c.name}</button>)}</div>
      <label>章节类型<select value={form.tag} onChange={e=>setForm({...form,tag:e.target.value})}><option>主线</option><option>支线</option><option>番外</option></select></label>
      {modal.mode==='edit'&&<label>修改原因（必填，将写入修订链）<input value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})} placeholder="例：补充战斗结果与战利品"/></label>}
      {error&&<div className="err">⚠ {error}</div>}
      <button className="primary full" onClick={save}>{modal.mode==='new'?'保存章节':'保存为新修订'}</button>
    </div></div>}

    {notice&&<div className="toast">{notice}</div>}
  </div>
}
createRoot(document.getElementById('root')).render(<App/>);
