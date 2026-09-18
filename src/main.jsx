import React, {useEffect, useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import './styles.css';

const TAG_COLORS = {'主线': '#d8a153', '支线': '#93b7a6', '番外': '#b9a6d1'};

const seed = {
  name: '暮光边境',
  system: 'D&D 5E',
  characters: [
    {id: 'c1', name: '艾德里安', role: '圣骑士', player: '林默', color: '#d8a153'},
    {id: 'c2', name: '瑟琳', role: '游侠', player: '安然', color: '#93b7a6'},
    {id: 'c3', name: '莫尔', role: '术士', player: '周岳', color: '#b9a6d1'},
  ],
  sessions: [
    {id: 1, revisions: [{title: '第一章：灰港的钟声', date: '2024-06-08', summary: '队伍抵达灰港，在失落的钟楼发现了神秘符文。', tag: '主线', characterIds: ['c1', 'c2', 'c3'], reason: '初始记录', editedAt: '2024-06-08T20:00:00'}]},
    {id: 2, revisions: [{title: '第二章：雾中来客', date: '2024-06-15', summary: '与流浪法师伊琳结盟，追踪海雾中的脚印。', tag: '主线', characterIds: ['c1', 'c2'], reason: '初始记录', editedAt: '2024-06-15T20:00:00'}]},
    {id: 3, revisions: [{title: '支线：深林采药', date: '2024-06-22', summary: '帮助村民寻找月光草，获得一枚古老铜币。', tag: '支线', characterIds: ['c2', 'c3'], reason: '初始记录', editedAt: '2024-06-22T20:00:00'}]},
  ],
};

// 兼容旧存档：把扁平章节包装成单条修订的修订链
const normalize = (d) => {
  if (!d || !Array.isArray(d.sessions) || !Array.isArray(d.characters)) return seed;
  const characters = d.characters.map((c, i) => ({color: '#93b7a6', role: '冒险者', player: '—', ...c, id: c.id || `c${i + 1}`}));
  const sessions = d.sessions.map((s, i) => {
    if (Array.isArray(s.revisions) && s.revisions.length) return s;
    const {id, color, ...rest} = s;
    return {id: id ?? i + 1, revisions: [{title: '', date: '', summary: '', tag: '主线', characterIds: [], ...rest, reason: '初始记录', editedAt: new Date().toISOString()}]};
  });
  return {...d, characters, sessions};
};

const read = () => {
  try { return normalize(JSON.parse(localStorage.getItem('campaign-log'))); }
  catch { return seed; }
};

const cur = (s) => s.revisions[s.revisions.length - 1];
const fmtDT = (iso) => {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleString('zh-CN', {month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'});
};

const emptyForm = {title: '', date: '', summary: '', tag: '主线', characterIds: [], reason: ''};

function App() {
  const [data, setData] = useState(read);
  const [tab, setTab] = useState('timeline');
  const [active, setActive] = useState(null);       // 当前选中章节 id
  const [viewRev, setViewRev] = useState(null);     // 正在查看的历史修订下标
  const [modal, setModal] = useState(null);         // 'new' | 'edit' | 'char'
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [activeChar, setActiveChar] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [charForm, setCharForm] = useState({name: '', role: '', player: ''});

  useEffect(() => localStorage.setItem('campaign-log', JSON.stringify(data)), [data]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 2600);
    return () => clearTimeout(t);
  }, [notice]);

  // 时间线按游戏内日期排序，刷新后顺序稳定
  const sorted = useMemo(
    () => [...data.sessions].sort((a, b) => cur(a).date.localeCompare(cur(b).date) || a.id - b.id),
    [data]
  );
  const activeSession = sorted.find((s) => s.id === active) || sorted[0];
  const minDate = sorted.length ? cur(sorted[0]).date : null;
  const activeIndex = sorted.findIndex((s) => s.id === activeSession?.id);

  // 角色出场：按各章节当前修订统计
  const appearances = (cid) => sorted.filter((s) => cur(s).characterIds.includes(cid));

  const viewing = activeSession
    ? (viewRev == null ? cur(activeSession) : activeSession.revisions[viewRev])
    : null;
  const isHistory = viewRev != null && activeSession && viewRev < activeSession.revisions.length - 1;

  const validate = (f) => {
    if (!f.title.trim()) return '请填写章节标题';
    if (!f.date) return '请选择游戏内日期';
    if (minDate && f.date < minDate) return `游戏日期不能早于已有最早章节（${minDate}）`;
    if (!f.summary.trim()) return '请填写章节摘要';
    if (!f.characterIds.length) return '请至少选择一位已知角色';
    return '';
  };

  // 同一角色在同一章节只保留一次
  const toggleChar = (cid) => setForm((f) => ({
    ...f,
    characterIds: f.characterIds.includes(cid)
      ? f.characterIds.filter((x) => x !== cid)
      : [...f.characterIds, cid],
  }));

  const openNew = () => {
    const latest = sorted.length ? cur(sorted[sorted.length - 1]).date : '2024-07-01';
    setForm({...emptyForm, date: latest});
    setError('');
    setModal('new');
  };

  const openEdit = () => {
    const r = cur(activeSession);
    setForm({title: r.title, date: r.date, summary: r.summary, tag: r.tag, characterIds: [...r.characterIds], reason: ''});
    setError('');
    setModal('edit');
  };

  const snapshot = (f, reason) => ({
    title: f.title.trim(),
    date: f.date,
    summary: f.summary.trim(),
    tag: f.tag,
    characterIds: [...new Set(f.characterIds)],
    reason,
    editedAt: new Date().toISOString(),
  });

  const saveNew = () => {
    const err = validate(form);
    if (err) return setError(err);
    const s = {id: Date.now(), revisions: [snapshot(form, '初始记录')]};
    setData((d) => ({...d, sessions: [...d.sessions, s]}));
    setActive(s.id);
    setViewRev(null);
    setModal(null);
    setNotice('新章节已加入时间线');
  };

  // 修改已保存章节：只追加一条带修改原因的新修订，旧内容保留
  const saveEdit = () => {
    const err = validate(form) || (form.reason.trim() ? '' : '请填写修改原因');
    if (err) return setError(err);
    const revNo = activeSession.revisions.length + 1;
    setData((d) => ({
      ...d,
      sessions: d.sessions.map((s) => s.id === activeSession.id
        ? {...s, revisions: [...s.revisions, snapshot(form, form.reason.trim())]}
        : s),
    }));
    setViewRev(null);
    setModal(null);
    setNotice(`已保存为第 ${revNo} 版修订，旧版本仍可查看`);
  };

  const saveChar = () => {
    if (!charForm.name.trim()) return setError('请填写角色名称');
    const c = {id: `c${Date.now()}`, name: charForm.name.trim(), role: charForm.role.trim() || '冒险者', player: charForm.player.trim() || '—', color: '#93b7a6'};
    setData((d) => ({...d, characters: [...d.characters, c]}));
    setCharForm({name: '', role: '', player: ''});
    setModal(null);
    setNotice(`角色 ${c.name} 已加入队伍`);
  };

  // 仍有关联章节的角色必须保留
  const removeChar = (c) => {
    if (appearances(c.id).length) return;
    setData((d) => ({...d, characters: d.characters.filter((x) => x.id !== c.id)}));
    setActiveChar(null);
    setNotice(`角色 ${c.name} 已移除`);
  };

  const exportData = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'}));
    a.download = 'campaign.json';
    a.click();
    setNotice('战役记录已导出');
  };

  const charById = (cid) => data.characters.find((x) => x.id === cid);

  return (
    <div className="shell">
      <aside>
        <div className="logo"><span>✦</span> CAMPAIGNER</div>
        <div className="campaign"><small>当前战役</small><strong>{data.name}</strong><span>{data.system} · 2024</span></div>
        <nav>{[['timeline', '◌', '时间线'], ['characters', '♙', '角色与阵营'], ['places', '⌖', '地点图鉴'], ['loot', '◇', '战利品']].map(([id, i, t]) => (
          <button className={tab === id ? 'active' : ''} onClick={() => setTab(id)} key={id}><i>{i}</i>{t}</button>
        ))}</nav>
        <div className="side-bottom"><button>⚙ 偏好设置</button><small>本地存储已开启</small></div>
      </aside>
      <main>
        <header>
          <div>
            <span className="crumb">MY CAMPAIGN / {data.system}</span>
            <h1>{tab === 'timeline' ? '战役时间线' : tab === 'characters' ? '角色与阵营' : tab === 'places' ? '地点图鉴' : '战利品'}</h1>
          </div>
          <div className="actions">
            <button onClick={exportData} className="outline">↓ 导出</button>
            <button onClick={openNew} className="primary">＋ 新建章节</button>
          </div>
        </header>

        {tab === 'timeline' && (
          <div className="timeline-layout">
            <section className="timeline">
              <div className="timeline-intro">
                <div><span>THE CHRONICLE</span><h2>记录每一次冒险</h2></div>
                <span className="count">{sorted.length} CHAPTERS</span>
              </div>
              {sorted.map((s, i) => {
                const r = cur(s);
                const [y, m, dd] = r.date.split('-');
                return (
                  <button className={'chapter ' + (activeSession?.id === s.id ? 'selected' : '')} onClick={() => { setActive(s.id); setViewRev(null); }} key={s.id}>
                    <div className="date"><b>{m}/{dd}</b><small>{y}</small></div>
                    <div className="line"><span style={{background: TAG_COLORS[r.tag] || '#d8a153'}}></span>{i < sorted.length - 1 && <i/>}</div>
                    <div className="chapter-copy">
                      <div className="tag">{r.tag}</div>
                      <h3>{r.title}{s.revisions.length > 1 && <em className="rev-badge">v{s.revisions.length}</em>}</h3>
                      <p>{r.summary}</p>
                      <div className="cast-row">
                        {r.characterIds.map((cid) => {
                          const c = charById(cid);
                          return c ? <span key={cid} className="cast-dot" style={{background: c.color}} title={c.name}>{c.name[0]}</span> : null;
                        })}
                      </div>
                    </div>
                    <span className="arrow">↗</span>
                  </button>
                );
              })}
            </section>

            {activeSession && viewing && (
              <section className="detail-panel">
                <div className="detail-cover" style={{background: TAG_COLORS[viewing.tag] || '#d8a153'}}>
                  <span>CHAPTER {String(activeIndex + 1).padStart(2, '0')}</span><i>✦</i>
                </div>
                <div className="detail-body">
                  {isHistory && (
                    <div className="history-banner">
                      正在查看历史修订 v{viewRev + 1} · {viewing.reason}
                      <button onClick={() => setViewRev(null)}>返回当前版本</button>
                    </div>
                  )}
                  <span className="tag">{viewing.tag}</span>
                  <h2>{viewing.title}</h2>
                  <p>{viewing.summary}</p>
                  <div className="cast-list">
                    {viewing.characterIds.map((cid) => {
                      const c = charById(cid);
                      return c ? <span key={cid} className="cast-chip"><i style={{background: c.color}}></i>{c.name}</span> : null;
                    })}
                  </div>
                  <div className="meta-grid">
                    <div><small>游戏日期</small><strong>{viewing.date}</strong></div>
                    <div><small>出场角色</small><strong>{viewing.characterIds.length} 位</strong></div>
                    <div><small>当前版本</small><strong>v{activeSession.revisions.length}</strong></div>
                  </div>
                  <div className="note">
                    <span>✎</span>
                    <div><strong>修订</strong><p>修改将生成带原因的新修订，旧版本保留可查。</p></div>
                    <button onClick={openEdit}>编辑</button>
                  </div>
                  <div className="rev-history">
                    <small>修订链 · {activeSession.revisions.length} 版</small>
                    {activeSession.revisions.map((r, ri) => (
                      <button
                        key={ri}
                        className={'rev-item' + ((viewRev ?? activeSession.revisions.length - 1) === ri ? ' on' : '')}
                        onClick={() => setViewRev(ri === activeSession.revisions.length - 1 ? null : ri)}
                      >
                        <b>v{ri + 1}</b>
                        <span>{r.reason}</span>
                        <small>{fmtDT(r.editedAt)}</small>
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </div>
        )}

        {tab === 'characters' && (
          <section className="cards">
            <div className="section-note">队伍中有 {data.characters.length} 位冒险者。仍有关联章节的角色必须保留，无法移除。</div>
            {data.characters.map((c) => {
              const apps = appearances(c.id);
              return (
                <article className="char-card" key={c.id}>
                  <div className="avatar" style={{background: c.color}}>{c.name[0]}</div>
                  <div>
                    <small>{c.role}</small>
                    <h3>{c.name}</h3>
                    <p>玩家 · {c.player} · 出场 {apps.length} 次</p>
                  </div>
                  <button onClick={() => setActiveChar(c.id)}>↗</button>
                </article>
              );
            })}
            <button className="char-card add-char" onClick={() => { setCharForm({name: '', role: '', player: ''}); setError(''); setModal('char'); }}>＋ 添加角色</button>
          </section>
        )}

        {tab === 'places' && (
          <section className="empty">
            <div>⌖</div>
            <h2>地点图鉴</h2>
            <p>从章节笔记中收集地点。当前已记录灰港、雾林和失落钟楼。</p>
            <div className="place-list">
              <span>01　灰港 <b>已探索</b></span>
              <span>02　失落钟楼 <b>已探索</b></span>
              <span>03　雾林 <b>待探索</b></span>
            </div>
          </section>
        )}

        {tab === 'loot' && (
          <section className="empty">
            <div>◇</div>
            <h2>战利品清单</h2>
            <p>追踪旅途中获得的装备、遗物和金币。</p>
            <div className="place-list">
              <span>月光草 × 3 <b>消耗品</b></span>
              <span>古老铜币 × 1 <b>遗物</b></span>
              <span>灰港守卫徽章 × 2 <b>任务物品</b></span>
            </div>
          </section>
        )}
      </main>

      {(modal === 'new' || modal === 'edit') && (
        <div className="modal-bg">
          <div className="modal">
            <button className="close" onClick={() => setModal(null)}>×</button>
            <span className="crumb">{modal === 'new' ? 'NEW CHAPTER' : 'NEW REVISION'}</span>
            <h2>{modal === 'new' ? '记录新的章节' : '修改章节 · 生成新修订'}</h2>
            <label>章节标题<input value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} placeholder="例：第三章：月下集市"/></label>
            <label>游戏日期<input type="date" min={minDate || undefined} value={form.date} onChange={(e) => setForm({...form, date: e.target.value})}/></label>
            <label>章节摘要<textarea rows="3" value={form.summary} onChange={(e) => setForm({...form, summary: e.target.value})} placeholder="发生了什么？"/></label>
            <label>章节类型<select value={form.tag} onChange={(e) => setForm({...form, tag: e.target.value})}><option>主线</option><option>支线</option><option>番外</option></select></label>
            <div className="pick">
              <small>出场角色（至少选择一位，同一角色不会重复）</small>
              <div className="pick-row">
                {data.characters.map((c) => (
                  <button type="button" key={c.id} className={'pick-chip' + (form.characterIds.includes(c.id) ? ' on' : '')} onClick={() => toggleChar(c.id)}>{c.name}</button>
                ))}
              </div>
            </div>
            {modal === 'edit' && (
              <label>修改原因<input value={form.reason} onChange={(e) => setForm({...form, reason: e.target.value})} placeholder="例：修正日期 / 补充出场角色"/></label>
            )}
            {error && <p className="form-error">{error}</p>}
            <button className="primary full" onClick={modal === 'new' ? saveNew : saveEdit}>{modal === 'new' ? '保存章节' : '保存为新修订'}</button>
          </div>
        </div>
      )}

      {modal === 'char' && (
        <div className="modal-bg">
          <div className="modal">
            <button className="close" onClick={() => setModal(null)}>×</button>
            <span className="crumb">NEW CHARACTER</span>
            <h2>添加角色</h2>
            <label>名称<input value={charForm.name} onChange={(e) => setCharForm({...charForm, name: e.target.value})} placeholder="例：伊琳"/></label>
            <label>职业<input value={charForm.role} onChange={(e) => setCharForm({...charForm, role: e.target.value})} placeholder="例：法师"/></label>
            <label>玩家<input value={charForm.player} onChange={(e) => setCharForm({...charForm, player: e.target.value})} placeholder="例：小林"/></label>
            {error && <p className="form-error">{error}</p>}
            <button className="primary full" onClick={saveChar}>保存角色</button>
          </div>
        </div>
      )}

      {activeChar && (() => {
        const c = charById(activeChar);
        if (!c) return null;
        const apps = appearances(c.id);
        return (
          <div className="modal-bg">
            <div className="modal">
              <button className="close" onClick={() => setActiveChar(null)}>×</button>
              <span className="crumb">CHARACTER FILE</span>
              <h2>{c.name}</h2>
              <p className="char-sub">{c.role} · 玩家 {c.player} · 出场 {apps.length} 次</p>
              <div className="linked">
                <small>关联章节</small>
                {apps.length === 0 && <p className="none">暂无关联章节</p>}
                {apps.map((s) => {
                  const r = cur(s);
                  return (
                    <button key={s.id} className="linked-item" onClick={() => { setActive(s.id); setViewRev(null); setActiveChar(null); setTab('timeline'); }}>
                      <b>{r.date}</b><span>{r.title}</span><em>{r.tag}</em>
                    </button>
                  );
                })}
              </div>
              {apps.length === 0
                ? <button className="danger" onClick={() => removeChar(c)}>移除角色</button>
                : <p className="keep-note">该角色仍有关联章节，必须保留，无法移除。</p>}
            </div>
          </div>
        );
      })()}

      {notice && <div className="toast">{notice}</div>}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App/>);
