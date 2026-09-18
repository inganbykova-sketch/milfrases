(function(){
  const POS = {
    noun:{label:'Noun',color:'#2563eb',bg:'rgba(37,99,235,.10)'},
    verb:{label:'Verb',color:'#dc2626',bg:'rgba(220,38,38,.10)'},
    adjective:{label:'Adjective',color:'#9333ea',bg:'rgba(147,51,234,.10)'},
    adverb:{label:'Adverb',color:'#16a34a',bg:'rgba(22,163,74,.10)'},
    pronoun:{label:'Pronoun',color:'#0891b2',bg:'rgba(8,145,178,.10)'},
    preposition:{label:'Preposition',color:'#6b7280',bg:'rgba(107,114,128,.12)'},
    article:{label:'Article',color:'#d97706',bg:'rgba(217,119,6,.10)'},
    interjection:{label:'Interjection',color:'#db2777',bg:'rgba(219,39,119,.10)'},
    numeral:{label:'Numeral',color:'#4f46e5',bg:'rgba(79,70,229,.10)'},
    phrase:{label:'Phrases',color:'#3a3d4d',bg:'rgba(58,61,77,.06)'}
  };
  const POS_ORDER = ['phrase','noun','verb','adjective','adverb','pronoun','preposition','article','interjection','numeral'];
  const TABS = window.LESSON_TABS || [];
  const TITLE = window.LESSON_TITLE || 'Lesson';
  const BACK = window.LESSON_BACK || 'index.html';

  const skeleton = `
    <a class="back-link" href="${BACK}">← Todas las lecciones</a>
    <h1 id="lessonTitle"></h1>
    <p class="sub">Pulsa 🔊 para escuchar. Haz clic en cualquier palabra para añadirla al diccionario. <strong>Ctrl+clic</strong> en varias palabras para combinarlas en una frase.</p>
    <div class="tabs" id="tabsBar"></div>
    <div class="controls">
      <label>Language<select id="lang">
        <option value="en-US">English (US)</option>
        <option value="en-GB" selected>English (UK)</option>
        <option value="ru-RU">Русский</option>
        <option value="es-ES">Español</option>
      </select></label>
      <label>Voice<select id="voice"></select></label>
      <label>Speed<input id="rate" type="range" min="0.5" max="1.6" step="0.1" value="0.9"></label>
      <label>Pause<input id="phrasePause" type="range" min="1" max="12" step="0.5" value="6"></label>
      <button class="btn play-all" id="playAllBtn">▶ Read all phrases</button>
      <button class="btn ghost" id="flipAllBtn">🔁 Flip all</button>
      <button class="btn ghost" id="stop">■ Stop</button>
      <button class="btn ghost" id="clearBtn">✕ Clear lesson</button>
    </div>
    <div class="layout sidebar-closed" id="layoutEl">
      <div class="grid" id="grid"></div>
      <aside class="sidebar">
        <div class="sidebar-scope">
          <button type="button" class="active" data-scope="current">This lesson</button>
          <button type="button" data-scope="all">All lessons <span class="scount" id="scopeCountAll"></span></button>
        </div>
        <div class="sidebar-head">
          <h2>Selected words</h2>
          <div class="sidebar-tools">
            <button class="collapse-all-btn" id="collapseAllBtn">⊟ All</button>
            <span class="count" id="count">0</span>
            <button class="sidebar-close" id="sidebarClose">✕</button>
          </div>
        </div>
        <button class="read-all-btn" id="readAllBtn" disabled>▶ Read selected</button>
        <div class="sidebar-hint">Clic en palabra → aparece aquí. Ctrl+clic → frase en <strong>Phrases</strong>.</div>
        <div class="sidebar-list" id="sidebarList"></div>
        <div class="sidebar-empty" id="sidebarEmpty">Haz clic en cualquier palabra para guardarla aquí.</div>
      </aside>
    </div>
  `;

  const wrap = document.createElement('div');
  wrap.className = 'wrap';
  wrap.innerHTML = skeleton;
  document.body.appendChild(wrap);

  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'sidebar-toggle';
  toggleBtn.id = 'sidebarToggle';
  toggleBtn.innerHTML = `
    <svg class="ic-book" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
    </svg>
    <span>Diccionario</span>
    <svg class="ic-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
    <span class="badge-mini" data-empty="1">0</span>
  `;
  document.body.appendChild(toggleBtn);

  document.getElementById('lessonTitle').textContent = TITLE;

  const synth = window.speechSynthesis;
  const $ = id => document.getElementById(id);
  const tabsBar=$('tabsBar'), grid=$('grid'), sideList=$('sidebarList'), sideEmpty=$('sidebarEmpty');
  const countEl=$('count'), langSel=$('lang'), voiceSel=$('voice'), rate=$('rate'), phrasePause=$('phrasePause');
  const stopBtn=$('stop'), clearBtn=$('clearBtn'), readAllBtn=$('readAllBtn'), playAllBtn=$('playAllBtn');
  const flipAllBtn=$('flipAllBtn'), collapseAllBtn=$('collapseAllBtn'), layoutEl=$('layoutEl');
  const sidebarToggle=$('sidebarToggle'), sidebarClose=$('sidebarClose');
  const scopeBtns=document.querySelectorAll('.sidebar-scope button'), scopeCountAll=$('scopeCountAll');

  function hash(s){let h=5381;for(let i=0;i<s.length;i++)h=((h*33)^s.charCodeAt(i))>>>0;return h.toString(36);}
  const BASE=hash(TABS.map(t=>t.phrases.map(p=>p.text).join('|')).join('#'));
  const STATE_KEY='tabsState-'+BASE, TAB_KEY='tabsActive-'+BASE, VOICE_KEY='tabsVoice-'+BASE, SIDEBAR_KEY='sidebarOpen-'+BASE;
  const PREFERRED_VOICES=['Google UK English Male','Google UK English Female','Google UK English','Daniel','Microsoft George - English (United Kingdom)'];

  let voices=[], activeTabIdx=0, currentCard=null, currentSideItem=null, speakingWordEl=null;
  let readAllActive=false, playAllActive=false, draggedSideItem=null, ctrlHeld=false;
  let pendingByCard=Object.create(null), sidebarScope='current', flipAll=false;
  let lastClick={cardIdx:-1,wordIdx:-1,time:0};
  let STATE={};

  const emptyTabState=()=>({selections:{},phrases:{},order:{},collapsed:{}});
  function loadState(){
    let p=null; try{p=JSON.parse(localStorage.getItem(STATE_KEY))||{};}catch(e){p={};}
    if(!p||typeof p!=='object'||Array.isArray(p))p={};
    STATE=p;
    TABS.forEach(t=>{
      if(!STATE[t.id]||typeof STATE[t.id]!=='object') STATE[t.id]=emptyTabState();
      const ts=STATE[t.id];
      ['selections','phrases','order','collapsed'].forEach(k=>{
        if(!ts[k]||typeof ts[k]!=='object'||Array.isArray(ts[k])) ts[k]={};
      });
    });
  }
  const saveState=()=>{try{localStorage.setItem(STATE_KEY,JSON.stringify(STATE));}catch(e){}};
  const tabState=tid=>{if(!STATE[tid])STATE[tid]=emptyTabState();return STATE[tid];};
  const curState=()=>tabState(TABS[activeTabIdx].id);

  function wordIsSelected(tid,c,w){const ts=tabState(tid);if(ts.selections[c]?.includes(w))return true;for(const g of(ts.phrases[c]||[]))if(g.includes(w))return true;return false;}
  function addWordToState(tid,c,w){if(wordIsSelected(tid,c,w))return false;const ts=tabState(tid);ts.selections[c]=ts.selections[c]||[];ts.selections[c].push(w);saveState();return true;}
  function removeWordFromState(tid,c,w){
    const ts=tabState(tid);let ch=false;
    if(ts.selections[c]){const b=ts.selections[c].length;ts.selections[c]=ts.selections[c].filter(i=>i!==w);if(!ts.selections[c].length)delete ts.selections[c];if((ts.selections[c]?.length||0)!==b)ch=true;}
    if(ts.phrases[c]){const g=ts.phrases[c],ng=g.filter(x=>!x.includes(w));if(ng.length!==g.length){if(ng.length)ts.phrases[c]=ng;else delete ts.phrases[c];ch=true;}}
    if(ch)saveState();return ch;
  }
  function addPhraseToState(tid,c,ix){
    if(!ix.length)return false;const ts=tabState(tid);
    if(ts.selections[c]){ts.selections[c]=ts.selections[c].filter(i=>!ix.includes(i));if(!ts.selections[c].length)delete ts.selections[c];}
    ts.phrases[c]=ts.phrases[c]||[];
    if(ts.phrases[c].some(g=>g.length===ix.length&&g.every((v,i)=>v===ix[i])))return false;
    ts.phrases[c].push([...ix]);saveState();return true;
  }
  function removePhraseFromState(tid,c,ix){
    const ts=tabState(tid);if(!ts.phrases[c])return false;
    const b=ts.phrases[c].length;
    ts.phrases[c]=ts.phrases[c].filter(g=>!(g.length===ix.length&&g.every((v,i)=>v===ix[i])));
    const a=ts.phrases[c]?.length||0;if(!a)delete ts.phrases[c];if(a!==b){saveState();return true;}return false;
  }

  const isSidebarOpen=()=>{try{const s=localStorage.getItem(SIDEBAR_KEY);if(s==='1')return true;if(s==='0')return false;}catch(e){}return window.innerWidth>=900;};
  function setSidebarOpen(o){try{localStorage.setItem(SIDEBAR_KEY,o?'1':'0');}catch(e){}layoutEl.classList.toggle('sidebar-closed',!o);sidebarToggle.classList.toggle('hidden',o);updateSidebarToggleBadge();}
  function updateSidebarToggleBadge(){const b=sidebarToggle.querySelector('.badge-mini');if(!b)return;const n=sideList.querySelectorAll('.side-item').length;b.textContent=n;if(n)b.removeAttribute('data-empty');else b.setAttribute('data-empty','1');}
  sidebarToggle.addEventListener('click',()=>setSidebarOpen(true));
  sidebarClose.addEventListener('click',()=>setSidebarOpen(false));

  scopeBtns.forEach(btn=>btn.addEventListener('click',()=>{
    const s=btn.dataset.scope;if(s===sidebarScope)return;sidebarScope=s;
    scopeBtns.forEach(b=>b.classList.toggle('active',b.dataset.scope===s));
    renderSidebar();
  }));
  function countTab(tid){const ts=tabState(tid);let n=0;Object.values(ts.selections||{}).forEach(a=>n+=a.length);Object.values(ts.phrases||{}).forEach(gs=>gs.forEach(g=>n+=g.length));return n;}
  function updateScopeCount(){if(!scopeCountAll)return;let t=0;TABS.forEach(x=>t+=countTab(x.id));scopeCountAll.textContent=t||'';}

  function buildTabsBar(){
    tabsBar.innerHTML='';
    TABS.forEach((t,i)=>{
      const b=document.createElement('button');b.type='button';
      b.className='tab-btn'+(i===activeTabIdx?' active':'');
      b.dataset.idx=i;b.innerHTML=`${t.name}<span class="cnt"></span>`;
      b.addEventListener('click',()=>switchTab(i));
      tabsBar.appendChild(b);
    });
    updateTabCounts();
  }
  function updateTabCounts(){
    TABS.forEach((t,i)=>{
      const btn=tabsBar.querySelector(`.tab-btn[data-idx="${i}"]`);if(!btn)return;
      const n=countTab(t.id);btn.querySelector('.cnt').textContent=n?` ${n}`:'';
    });
  }
  function switchTab(idx){
    stop();commitAllPending();activeTabIdx=idx;
    try{localStorage.setItem(TAB_KEY,String(idx));}catch(e){}
    tabsBar.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active',Number(b.dataset.idx)===idx));
    renderPhrases();renderSidebar();updateTabCounts();
  }

  function renderPhrases(){
    const tab=TABS[activeTabIdx];grid.innerHTML='';
    tab.phrases.forEach((phrase,i)=>{
      const card=document.createElement('article');card.className='card';card.dataset.index=i;
      if(flipAll)card.classList.add('translated');
      const sb=document.createElement('button');sb.className='speak-btn';sb.textContent='🔊';
      sb.addEventListener('click',()=>speak(phrase.text,card,phrase.words));
      card.appendChild(sb);
      const body=document.createElement('div');body.className='card-body';
      const num=document.createElement('button');num.className='card-num';num.textContent=String(i+1);
      if(flipAll)num.classList.add('open');
      body.appendChild(num);
      const tx=document.createElement('div');tx.className='card-text';
      const pe=document.createElement('div');pe.className='phrase';
      phrase.words.forEach((pair,idx)=>{
        const w=document.createElement('span');w.textContent=pair.en;w.dataset.idx=idx;
        const p=POS[pair.pos]||POS.noun;w.className='pw';
        w.style.setProperty('--pw-color',p.color);w.style.setProperty('--pw-bg',p.bg);
        w.addEventListener('click',e=>handleWordClick(w,i,idx,e,w));
        pe.appendChild(w);if(idx<phrase.words.length-1)pe.appendChild(document.createTextNode(' '));
      });
      tx.appendChild(pe);
      const tr=document.createElement('div');tr.className='card-translation';
      phrase.words.forEach((pair,idx)=>{
        const s=document.createElement('span');s.className='pw-es';s.dataset.idxs=String(idx);s.textContent=pair.es||'·';
        s.addEventListener('click',e=>{const wel=card.querySelector(`.pw[data-idx="${idx}"]`);if(wel)handleWordClick(wel,i,idx,e,s);});
        tr.appendChild(s);if(idx<phrase.words.length-1)tr.appendChild(document.createTextNode(' '));
      });
      tx.appendChild(tr);body.appendChild(tx);card.appendChild(body);
      num.addEventListener('click',()=>{const o=card.classList.toggle('translated');num.classList.toggle('open',o);});
      const sel=document.createElement('div');sel.className='selected-words';card.appendChild(sel);
      grid.appendChild(card);
    });
  }
  flipAllBtn.addEventListener('click',()=>{
    flipAll=!flipAll;flipAllBtn.classList.toggle('active',flipAll);
    flipAllBtn.textContent=flipAll?'🔁 Show English':'🔁 Flip all';
    document.querySelectorAll('.card').forEach(c=>{c.classList.toggle('translated',flipAll);const b=c.querySelector('.card-num');if(b)b.classList.toggle('open',flipAll);});
  });

  /* =========================================================
     SIDEBAR RENDER — ИСПРАВЛЕНО: учитываем sidebarScope
     ========================================================= */
  function renderSidebar(){
    sideList.innerHTML='';
    document.querySelectorAll('.selected-words').forEach(e=>e.innerHTML='');
    document.querySelectorAll('.pw').forEach(e=>e.classList.remove('active','in-phrase','pending'));
    document.querySelectorAll('.pw-es').forEach(e=>e.classList.remove('active','in-phrase'));

    const currentTid = TABS[activeTabIdx].id;
    const tabsToRender = sidebarScope === 'all'
      ? TABS.map(t => t.id)
      : [currentTid];

    const model = [];
    tabsToRender.forEach(tid => {
      const ts = tabState(tid);
      Object.keys(ts.selections||{}).forEach(ck => {
        const c = Number(ck);
        (ts.selections[ck]||[]).forEach(w => model.push({tabId:tid, c, w, kind:'word'}));
      });
      Object.keys(ts.phrases||{}).forEach(ck => {
        const c = Number(ck);
        (ts.phrases[ck]||[]).forEach(g => model.push({tabId:tid, c, indices:g, kind:'phrase'}));
      });
    });

    model.forEach(m => {
      if(m.kind === 'word') appendWordItem(m.tabId, m.c, m.w);
      else appendPhraseItem(m.tabId, m.c, m.indices);
    });

    if(sidebarScope === 'current') applyOrder(curState().order || {});

    const collapsed = curState().collapsed || {};
    Object.keys(collapsed).forEach(pk => {
      const g = sideList.querySelector(`.side-group[data-pos="${pk}"]`);
      if(g && collapsed[pk]) g.classList.add('collapsed');
    });

    updateSidebarMeta();
    document.querySelectorAll('.card').forEach(card => refreshSpanishHighlight(card));
    updateScopeCount();
  }

  function appendWordItem(tabId,c,w){
    const tab=TABS.find(t=>t.id===tabId);if(!tab)return;
    const pair=tab.phrases[c]?.words[w];if(!pair)return;
    const p=POS[pair.pos]||POS.noun;
    if(tabId===TABS[activeTabIdx].id){
      const card=document.querySelector(`.card[data-index="${c}"]`);
      if(card){const wel=card.querySelector(`.pw[data-idx="${w}"]`);if(wel)wel.classList.add('active');}
    }
    const item=buildSideItem({tabId,c,primaryIdx:w,indices:null,en:pair.en,es:pair.es,posKey:pair.pos,color:p.color,bg:p.bg});
    getGroupItems(getGroup(pair.pos)).appendChild(item);
  }
  function appendPhraseItem(tabId,c,indices){
    const tab=TABS.find(t=>t.id===tabId);if(!tab)return;
    const phrase=tab.phrases[c];if(!phrase||!indices.length)return;
    const cat=POS.phrase;
    if(tabId===TABS[activeTabIdx].id){
      const card=document.querySelector(`.card[data-index="${c}"]`);
      if(card)indices.forEach(i=>{const wel=card.querySelector(`.pw[data-idx="${i}"]`);if(wel)wel.classList.add('active','in-phrase');});
    }
    const en=indices.map(i=>phrase.words[i].en).join(' ');
    const es=indices.map(i=>phrase.words[i].es).join(' ');
    const item=buildSideItem({tabId,c,primaryIdx:indices[0],indices,en,es,posKey:'phrase',color:cat.color,bg:cat.bg,isPhrase:true});
    getGroupItems(getGroup('phrase')).appendChild(item);
  }

  function handleWordClick(wEl,c,w,evt,anchor){
    const now=Date.now();
    if(lastClick.cardIdx===c&&lastClick.wordIdx===w&&now-lastClick.time<300)return;
    lastClick={cardIdx:c,wordIdx:w,time:now};
    const tid=TABS[activeTabIdx].id;
    const ctrl=ctrlHeld||!!(evt&&(evt.ctrlKey||evt.metaKey));
    if(ctrl){if(wEl.classList.contains('active'))return;const set=pendingByCard[c]||(pendingByCard[c]=new Set());if(set.has(w)){set.delete(w);wEl.classList.remove('pending');if(!set.size)delete pendingByCard[c];}else{set.add(w);wEl.classList.add('pending');}return;}
    if(wEl.classList.contains('active')){removeWordFromState(tid,c,w);renderSidebar();updateTabCounts();return;}
    if(wEl.classList.contains('pending')){const set=pendingByCard[c];if(set){set.delete(w);if(!set.size)delete pendingByCard[c];}wEl.classList.remove('pending');return;}
    if(!addWordToState(tid,c,w))return;
    renderSidebar();updateTabCounts();
    const item=findSideItem(tid,c,w);
    if(item&&!playAllActive&&!readAllActive)speakWord(TABS[activeTabIdx].phrases[c].words[w].en,item);
    showFadingBubble(anchor||wEl,c,w);
  }
  const isCtrlKey=e=>e.key==='Control'||e.key==='Meta';
  window.addEventListener('keydown',e=>{if(isCtrlKey(e))ctrlHeld=true;});
  window.addEventListener('keyup',e=>{if(isCtrlKey(e)){ctrlHeld=false;commitAllPending();}});
  window.addEventListener('blur',()=>{if(ctrlHeld){ctrlHeld=false;commitAllPending();}});
  function commitAllPending(){
    const keys=Object.keys(pendingByCard);if(!keys.length)return;
    const tid=TABS[activeTabIdx].id;let changed=false;
    keys.forEach(k=>{
      const c=Number(k),set=pendingByCard[k];if(!set||!set.size)return;
      const ix=[...set].sort((a,b)=>a-b);
      ix.forEach(i=>{const wel=document.querySelector(`.card[data-index="${c}"] .pw[data-idx="${i}"]`);if(wel)wel.classList.remove('pending');});
      const usable=ix.filter(i=>{const wel=document.querySelector(`.card[data-index="${c}"] .pw[data-idx="${i}"]`);return wel&&!wel.classList.contains('active');});
      if(!usable.length)return;
      if(addPhraseToState(tid,c,usable))changed=true;
    });
    pendingByCard=Object.create(null);
    if(changed){renderSidebar();updateTabCounts();}
  }
  function refreshSpanishHighlight(card){
    if(!card)return;
    card.querySelectorAll('.pw-es').forEach(span=>{
      const ix=(span.dataset.idxs||'').split(',').map(Number);
      let ps=null,ss=null;
      for(const i of ix){const wel=card.querySelector(`.pw[data-idx="${i}"]`);if(!wel)continue;if(wel.classList.contains('in-phrase')){ps=wel;break;}if(wel.classList.contains('active')&&!ss)ss=wel;}
      span.classList.remove('active','in-phrase');
      if(ps)span.classList.add('in-phrase');else if(ss){span.classList.add('active');span.style.setProperty('--pw-color',ss.style.getPropertyValue('--pw-color'));}
    });
  }
  function showFadingBubble(anchor,c,w){
    const pair=TABS[activeTabIdx].phrases[c].words[w];
    const b=document.createElement('div');b.className='word-popup fading';
    b.innerHTML='<div class="wp-en"></div><div class="wp-es"></div>';
    b.querySelector('.wp-en').textContent=pair.en;b.querySelector('.wp-es').textContent=pair.es||'·';
    document.body.appendChild(b);
    const r=anchor.getBoundingClientRect(),pr=b.getBoundingClientRect();
    let top=r.top-pr.height-10,below=false;
    if(top<8){top=r.bottom+10;below=true;}
    let left=r.left+r.width/2-pr.width/2;left=Math.max(8,Math.min(window.innerWidth-pr.width-8,left));
    b.style.top=top+'px';b.style.left=left+'px';
    const rm=()=>{if(b.parentNode)b.remove();};
    b.addEventListener('animationend',rm,{once:true});setTimeout(rm,2500);
  }
  function getGroup(pk){
    let g=sideList.querySelector(`.side-group[data-pos="${pk}"]`);if(g)return g;
    const p=POS[pk]||POS.noun;
    g=document.createElement('div');g.className='side-group';g.dataset.pos=pk;
    g.style.setProperty('--pw-color',p.color);g.style.setProperty('--pw-bg',p.bg);
    const t=document.createElement('button');t.className='group-title';
    t.innerHTML=`<span class="chev">▼</span><span class="dot"></span><span class="gname">${p.label}</span><span class="gcount">0</span>`;
    t.addEventListener('click',()=>{
      const c=g.classList.toggle('collapsed');const ts=curState();ts.collapsed=ts.collapsed||{};ts.collapsed[pk]=c;saveState();updateCollapseAllBtn();
    });
    const items=document.createElement('div');items.className='group-items';
    g.append(t,items);
    const mr=POS_ORDER.indexOf(pk);let ins=false;
    sideList.querySelectorAll('.side-group').forEach(ex=>{
      if(ins)return;if(POS_ORDER.indexOf(ex.dataset.pos)>mr){sideList.insertBefore(g,ex);ins=true;}
    });
    if(!ins)sideList.appendChild(g);
    updateCollapseAllBtn();return g;
  }
  const getGroupItems=g=>g.querySelector('.group-items');
  function refreshGroupCount(g){if(!g)return;const gc=g.querySelector('.gcount');if(!gc)return;gc.textContent=String(g.querySelectorAll('.side-item').length);}
  function findSideItem(tid,c,w){
    let it=sideList.querySelector(`.side-item[data-tab="${tid}"][data-card="${c}"][data-idx="${w}"]`);
    if(it)return it;
    for(const el of sideList.querySelectorAll(`.side-item[data-tab="${tid}"][data-card="${c}"][data-group]`)){
      try{const g=JSON.parse(el.dataset.group);if(Array.isArray(g)&&g.includes(w))return el;}catch(e){}
    }
    return null;
  }
  function buildSideItem({tabId,c,primaryIdx,indices,en,es,posKey,color,bg,isPhrase}){
    const tab=TABS.find(t=>t.id===tabId)||TABS[activeTabIdx];
    const it=document.createElement('div');it.className='side-item'+(isPhrase?' is-phrase':'');
    it.dataset.tab=tabId;it.dataset.card=c;it.dataset.idx=primaryIdx;
    if(indices)it.dataset.group=JSON.stringify(indices);
    it.style.setProperty('--pw-color',color);it.style.setProperty('--pw-bg',bg);
    it.draggable=(sidebarScope!=='all');
    if(it.draggable){it.addEventListener('dragstart',onDragStart);it.addEventListener('dragover',onDragOver);it.addEventListener('dragend',onDragEnd);}
    const play=document.createElement('button');play.className='side-play';play.title='Play';
    const text=document.createElement('span');text.className='side-text';
    if(isPhrase&&indices&&indices.length){
      const phrase=tab.phrases[c];
      indices.forEach((idx,i)=>{
        const w=phrase.words[idx],wp=POS[w.pos]||POS.noun;
        const s=document.createElement('b');s.className='side-word';s.textContent=w.en;
        s.style.setProperty('--pw-color',wp.color);s.style.setProperty('--pw-bg',wp.bg);
        text.appendChild(s);if(i<indices.length-1)text.appendChild(document.createTextNode(' '));
      });
      const sep=document.createElement('span');sep.className='side-sep';sep.textContent='—';
      const esSpan=document.createElement('span');esSpan.textContent=es;
      text.append(sep,esSpan);
    }else{
      const b=document.createElement('b');b.textContent=en;
      const sep=document.createElement('span');sep.className='side-sep';sep.textContent='—';
      const esSpan=document.createElement('span');esSpan.textContent=es;
      text.append(b,sep,esSpan);
    }
    if(sidebarScope==='all'){
      const badge=document.createElement('span');badge.className='side-tab-badge';
      badge.textContent=tab.name.split('·')[0].trim();badge.title=tab.name;
      text.appendChild(badge);
    }
    play.append(text);
    const rm=document.createElement('button');rm.className='side-remove';rm.textContent='×';
    play.addEventListener('click',()=>speakWord(en,it));
    rm.addEventListener('click',e=>{
      e.stopPropagation();
      if(isPhrase&&indices)removePhraseFromState(tabId,c,indices);else removeWordFromState(tabId,c,primaryIdx);
      renderSidebar();updateTabCounts();
    });
    it.append(play,rm);return it;
  }
  function onDragStart(){draggedSideItem=this;this.classList.add('dragging');}
  function onDragOver(e){
    if(!draggedSideItem||draggedSideItem===this)return;
    if(draggedSideItem.parentElement!==this.parentElement)return;
    e.preventDefault();
    const r=this.getBoundingClientRect(),mid=r.top+r.height/2;
    if(e.clientY<mid)this.parentElement.insertBefore(draggedSideItem,this);
    else this.parentElement.insertBefore(draggedSideItem,this.nextSibling);
  }
  function onDragEnd(){this.classList.remove('dragging');if(draggedSideItem){draggedSideItem.classList.remove('dragging');draggedSideItem=null;}saveOrderToState();}
  function saveOrderToState(){
    if(sidebarScope==='all')return;
    const order={};
    sideList.querySelectorAll('.side-group').forEach(g=>{
      const items=[...g.querySelectorAll('.side-item')].map(el=>({c:+el.dataset.card,i:+el.dataset.idx}));
      if(items.length)order[g.dataset.pos]=items;
    });
    const ts=curState();ts.order=order;saveState();
  }
  function applyOrder(order){
    if(!order)return;
    Object.entries(order).forEach(([pk,list])=>{
      const box=sideList.querySelector(`.side-group[data-pos="${pk}"] .group-items`);if(!box)return;
      list.forEach(({c,i})=>{const it=box.querySelector(`.side-item[data-card="${c}"][data-idx="${i}"]`);if(it)box.appendChild(it);});
    });
  }
  function updateSidebarMeta(){
    const n=sideList.querySelectorAll('.side-item').length;
    countEl.textContent=n;sideEmpty.style.display=n?'none':'';
    readAllBtn.disabled=n===0;
    sideList.querySelectorAll('.side-group').forEach(refreshGroupCount);
    updateCollapseAllBtn();updateScopeCount();updateSidebarToggleBadge();
  }
  function updateCollapseAllBtn(){
    const groups=[...sideList.querySelectorAll('.side-group')];
    if(!groups.length){collapseAllBtn.style.display='none';return;}
    collapseAllBtn.style.display='';
    const anyExp=groups.some(g=>!g.classList.contains('collapsed'));
    collapseAllBtn.textContent=anyExp?'⊟ All':'⊞ All';
  }
  collapseAllBtn.addEventListener('click',()=>{
    const groups=[...sideList.querySelectorAll('.side-group')];if(!groups.length)return;
    const anyExp=groups.some(g=>!g.classList.contains('collapsed'));
    const ts=curState();ts.collapsed=ts.collapsed||{};
    groups.forEach(g=>{const pk=g.dataset.pos;if(anyExp){g.classList.add('collapsed');ts.collapsed[pk]=true;}else{g.classList.remove('collapsed');ts.collapsed[pk]=false;}});
    saveState();updateCollapseAllBtn();
  });
  clearBtn.addEventListener('click',()=>{
    stop();pendingByCard=Object.create(null);
    const tid=TABS[activeTabIdx].id;STATE[tid]=emptyTabState();saveState();
    renderSidebar();updateTabCounts();
  });

  function loadVoices(){voices=synth.getVoices()||[];fillVoices();}
  function pickDefault(list){try{const s=localStorage.getItem(VOICE_KEY);if(s&&list.some(v=>v.name===s))return s;}catch(e){}for(const w of PREFERRED_VOICES){const h=list.find(v=>v.name===w);if(h)return h.name;}return list[0]?list[0].name:'';}
  function fillVoices(){
    const want=langSel.value.slice(0,2).toLowerCase();
    const list=voices.filter(v=>v.lang.replace('_','-').toLowerCase().startsWith(want));
    voiceSel.innerHTML='';
    if(!list.length){voiceSel.disabled=true;voiceSel.appendChild(Object.assign(document.createElement('option'),{value:'',textContent:'System default'}));return;}
    voiceSel.disabled=false;
    list.forEach(v=>{const o=document.createElement('option');o.value=v.name;o.textContent=`${v.name} (${v.lang})`;voiceSel.appendChild(o);});
    const ch=pickDefault(list);if(ch)voiceSel.value=ch;
  }
  voiceSel.addEventListener('change',()=>{try{localStorage.setItem(VOICE_KEY,voiceSel.value);}catch(e){}});
  langSel.addEventListener('change',fillVoices);
  if(typeof synth.onvoiceschanged!=='undefined')synth.onvoiceschanged=loadVoices;

  function clearSpeakH(){if(speakingWordEl){speakingWordEl.classList.remove('speaking-word');speakingWordEl=null;}}
  function stop(){
    synth.cancel();clearSpeakH();
    if(currentCard){currentCard.classList.remove('speaking');currentCard=null;}
    if(currentSideItem){currentSideItem.classList.remove('speaking');currentSideItem=null;}
    if(readAllActive){readAllActive=false;readAllBtn.classList.remove('reading');readAllBtn.textContent='▶ Read selected';document.querySelectorAll('.side-item.speaking').forEach(e=>e.classList.remove('speaking'));document.querySelectorAll('.pw.speaking-word').forEach(e=>e.classList.remove('speaking-word'));}
    if(playAllActive){playAllActive=false;playAllBtn.classList.remove('playing');playAllBtn.textContent='▶ Read all phrases';document.querySelectorAll('.card.speaking').forEach(e=>e.classList.remove('speaking'));document.querySelectorAll('.pw.speaking-word').forEach(e=>e.classList.remove('speaking-word'));}
  }
  function speak(text,card,words){
    if(currentCard===card&&synth.speaking){stop();return;}
    stop();
    const u=new SpeechSynthesisUtterance(text);
    u.lang=langSel.value;u.rate=parseFloat(rate.value);u.pitch=1;
    const v=voices.find(x=>x.name===voiceSel.value);if(v)u.voice=v;
    const bounds=[];let pos=0;
    words.forEach((p,i)=>{const len=p.en.length;const wel=card.querySelector(`.pw[data-idx="${i}"]`);bounds.push({s:pos,e:pos+len,el:wel});pos+=len+1;});
    u.onboundary=ev=>{
      if(typeof ev.charIndex!=='number')return;
      const ci=ev.charIndex;let t=null;
      for(const b of bounds){if(ci>=b.s&&ci<b.e){t=b.el;break;}}
      if(!t){for(const b of bounds){if(b.s<=ci)t=b.el;else break;}}
      if(t&&t!==speakingWordEl){clearSpeakH();if(t.classList.contains('pw')){t.classList.add('speaking-word');speakingWordEl=t;}}
    };
    u.onend=u.onerror=()=>{clearSpeakH();if(currentCard===card){card.classList.remove('speaking');currentCard=null;}};
    currentCard=card;card.classList.add('speaking');synth.speak(u);
  }
  function speakWord(text,item){
    const clean=text.replace(/[.,!?;:]+$/g,'').trim();if(!clean)return;
    if(currentSideItem===item&&synth.speaking){stop();return;}
    stop();
    const u=new SpeechSynthesisUtterance(clean);
    u.lang=langSel.value;u.rate=parseFloat(rate.value);u.pitch=1;
    const v=voices.find(x=>x.name===voiceSel.value);if(v)u.voice=v;
    u.onend=u.onerror=()=>{if(currentSideItem===item){item.classList.remove('speaking');currentSideItem=null;}};
    currentSideItem=item;item.classList.add('speaking');synth.speak(u);
  }
  const READ_PAUSE=700;
  function readAllSelected(){
    if(readAllActive){stop();return;}
    stop();readAllActive=true;readAllBtn.classList.add('reading');readAllBtn.textContent='■ Stop reading';
    const list=[...sideList.querySelectorAll('.side-group:not(.collapsed) .side-item')];
    if(!list.length){stop();return;}
    let i=0;
    const next=()=>{
      if(!readAllActive)return;if(i>=list.length){stop();return;}
      const en=list[i++];
      const c=+en.dataset.card,pr=+en.dataset.idx;
      const tid=en.dataset.tab||TABS[activeTabIdx].id;
      const tab=TABS.find(t=>t.id===tid)||TABS[activeTabIdx];
      let speakText;let wordEls=[];
      const cardEl=(tid===TABS[activeTabIdx].id)?grid.querySelector(`.card[data-index="${c}"]`):null;
      if(en.dataset.group){
        try{const g=JSON.parse(en.dataset.group);if(Array.isArray(g)&&g.length){speakText=g.map(k=>tab.phrases[c].words[k].en).join(' ');wordEls=cardEl?g.map(k=>cardEl.querySelector(`.pw[data-idx="${k}"]`)).filter(Boolean):[];}}catch(e){}
      }
      if(!speakText){speakText=tab.phrases[c].words[pr].en;const we=cardEl?cardEl.querySelector(`.pw[data-idx="${pr}"]`):null;if(we)wordEls=[we];}
      speakText=speakText.replace(/[.,!?;:]+$/g,'').trim();
      if(!speakText){next();return;}
      en.classList.add('speaking');wordEls.forEach(x=>x.classList.add('speaking-word'));
      const u=new SpeechSynthesisUtterance(speakText);
      u.lang=langSel.value;u.rate=parseFloat(rate.value);u.pitch=1;
      const v=voices.find(x=>x.name===voiceSel.value);if(v)u.voice=v;
      const cl=()=>{en.classList.remove('speaking');wordEls.forEach(x=>x.classList.remove('speaking-word'));};
      u.onend=()=>{cl();if(!readAllActive)return;setTimeout(next,READ_PAUSE);};
      u.onerror=()=>{cl();if(!readAllActive)return;setTimeout(next,READ_PAUSE);};
      synth.speak(u);
    };
    next();
  }
  readAllBtn.addEventListener('click',readAllSelected);
  function playAllPhrases(){
    if(playAllActive){stop();return;}
    stop();playAllActive=true;playAllBtn.classList.add('playing');playAllBtn.textContent='■ Stop all phrases';
    const cards=[...grid.querySelectorAll('.card')];if(!cards.length){stop();return;}
    let i=0;
    const next=()=>{
      if(!playAllActive)return;if(i>=cards.length){stop();return;}
      const card=cards[i++];
      const phrase=TABS[activeTabIdx].phrases[+card.dataset.index];if(!phrase){next();return;}
      card.scrollIntoView({behavior:'smooth',block:'center'});card.classList.add('speaking');
      const u=new SpeechSynthesisUtterance(phrase.text);
      u.lang=langSel.value;u.rate=parseFloat(rate.value);u.pitch=1;
      const v=voices.find(x=>x.name===voiceSel.value);if(v)u.voice=v;
      const bounds=[];let pos=0;
      phrase.words.forEach((p,i)=>{const len=p.en.length;const wel=card.querySelector(`.pw[data-idx="${i}"]`);bounds.push({s:pos,e:pos+len,el:wel});pos+=len+1;});
      u.onboundary=ev=>{
        if(typeof ev.charIndex!=='number')return;
        const ci=ev.charIndex;let t=null;
        for(const b of bounds){if(ci>=b.s&&ci<b.e){t=b.el;break;}}
        if(!t){for(const b of bounds){if(b.s<=ci)t=b.el;else break;}}
        if(t&&t!==speakingWordEl){clearSpeakH();if(t.classList.contains('pw')){t.classList.add('speaking-word');speakingWordEl=t;}}
      };
      u.onend=u.onerror=()=>{
        clearSpeakH();card.classList.remove('speaking');if(!playAllActive)return;
        setTimeout(next,parseFloat(phrasePause.value)*1000);
      };
      synth.speak(u);
    };
    next();
  }
  playAllBtn.addEventListener('click',playAllPhrases);
  stopBtn.addEventListener('click',stop);
  window.addEventListener('beforeunload',()=>{saveState();synth.cancel();});

  (function boot(){
    loadState();
    let idx=0;
    try{const v=localStorage.getItem(TAB_KEY);if(v!==null)idx=Math.max(0,Math.min(TABS.length-1,parseInt(v,10)||0));}catch(e){}
    activeTabIdx=idx;
    buildTabsBar();renderPhrases();renderSidebar();loadVoices();fillVoices();
    setSidebarOpen(isSidebarOpen());
  })();
})();