// 바탕화면 위젯: kind=calendar(달력) | daily(오늘 할 일·그래프)
const S = window.Shared, $ = (s) => document.querySelector(s);
const KIND = new URLSearchParams(location.search).get('kind') || 'daily';
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let D = null, cfg = {}, month = new Date(); month.setDate(1);
const today = () => S.ymd(new Date());

// ---------- 달력 ----------
function renderCalendar() {
  const first = new Date(month.getFullYear(), month.getMonth(), 1), start = new Date(first); start.setDate(1 - first.getDay());
  const weeks = Math.ceil((first.getDay() + new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()) / 7);
  const ch = Math.max(40, Math.floor((window.innerHeight - 34 - 24 - 34 - 18 - 120) / weeks));
  let cells = '';
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i), ds = S.ymd(d);
    const evs = S.eventsOn(D.events, ds), max = Math.max(1, Math.floor((ch - 22) / 14));
    cells += `<div class="c ${d.getMonth() !== first.getMonth() ? 'o' : ''} ${ds === today() ? 't' : ''}" data-d="${ds}"><span class="n">${d.getDate()}</span>
      ${evs.slice(0, max).map((e) => `<i style="background:color-mix(in srgb, ${S.catOf(e.category).color} 18%, transparent)">${esc(e.title)}</i>`).join('')}
      ${evs.length > max ? `<i style="color:var(--muted)">+${evs.length - max}</i>` : ''}</div>`;
  }
  const up = S.upcoming(D.events, new Date(), 14, 4);
  $('#main').innerHTML = `
    <div class="mhead"><h2>${first.getFullYear()}년 ${first.getMonth() + 1}월</h2><button data-m="-1">‹</button><button data-m="0">•</button><button data-m="1">›</button></div>
    <div class="grid" style="--ch:${ch}px">${DOW.map((d) => `<div class="dow">${d}</div>`).join('')}${cells}</div>
    <div class="agenda">${up.length ? up.map((e) => `<div class="ag"><span>${e.occDate.slice(5).replace('-', '/')} ${e.time || '종일'}</span><span>${esc(e.title)}</span></div>`).join('') : '<div class="empty">다가오는 일정이 없어요</div>'}</div>`;
}

// ---------- 데일리 ----------
function renderDaily() {
  const d = today(), now = new Date(), nowHM = S.hm(now);
  const todos = D.todos.filter((t) => t.date === d).sort((a, b) => a.done - b.done);
  const done = todos.filter((t) => t.done).length, pct = todos.length ? Math.round(done / todos.length * 100) : 0;
  const evs = S.eventsOn(D.events, d), next = evs.find((e) => e.time && e.time >= nowHM && !e.isDone);
  const R = 36, Cc = 2 * Math.PI * R;
  // 최근 7일 완료한 할 일
  const days = [...Array(7)].map((_, i) => S.addDays(d, i - 6));
  const counts = days.map((ds) => D.todos.filter((t) => t.done && (t.doneAt ? S.ymd(new Date(t.doneAt)) === ds : t.date === ds)).length);
  const max = Math.max(1, ...counts);
  let until = '';
  if (next) { const [h, m] = next.time.split(':').map(Number), mins = h * 60 + m - (now.getHours() * 60 + now.getMinutes()); until = mins < 60 ? `${mins}분 후` : `${Math.floor(mins / 60)}시간 ${mins % 60}분 후`; }
  let tl = '', nowPlaced = false;
  for (const e of evs) {
    if (!nowPlaced && e.time && e.time > nowHM) { tl += `<div class="now"><span>지금 ${nowHM}</span></div>`; nowPlaced = true; }
    tl += `<div class="ev ${e.time && e.time < nowHM ? 'past' : ''}" style="--c:${S.catOf(e.category).color}"><b>${e.time || '종일'}</b>${esc(e.title)}</div>`;
  }
  if (evs.length && !nowPlaced) tl += `<div class="now"><span>지금 ${nowHM}</span></div>`;
  $('#main').innerHTML = `
    <div class="top">
      <div class="date"><b>${now.getMonth() + 1}월 ${now.getDate()}일 ${DOW[now.getDay()]}요일</b><span>${next ? `다음 일정 · ${esc(next.title)} (${until})` : '남은 일정이 없어요'}</span></div>
      <div class="ring"><svg viewBox="0 0 84 84"><circle cx="42" cy="42" r="${R}" stroke="var(--line)" stroke-width="8" fill="none"/>
        <circle cx="42" cy="42" r="${R}" stroke="var(--accent)" stroke-width="8" fill="none" stroke-linecap="round" stroke-dasharray="${Cc}" stroke-dashoffset="${Cc * (1 - pct / 100)}"/></svg>
        <div><span><b>${pct}%</b>${done}/${todos.length}</span></div></div>
    </div>
    <div class="stats">
      <div class="stat"><b>${todos.length - done}</b><span>남은 할 일</span></div>
      <div class="stat"><b>${evs.filter((e) => !e.time || e.time >= nowHM).length}</b><span>남은 일정</span></div>
      <div class="stat"><b>${D.focus ? D.focus.todayCount : 0}</b><span>집중 완료</span></div>
    </div>
    <h3>오늘 할 일</h3>
    <div id="todos">${todos.length ? todos.map((t) => `<label class="todo ${t.done ? 'd' : ''}"><input type="checkbox" data-id="${t.id}" ${t.done ? 'checked' : ''}><span>${esc(t.text)}</span></label>`).join('') : '<div class="empty">할 일이 없어요</div>'}</div>
    <div class="add"><input id="addTodo" placeholder="할 일 추가 (Enter)"></div>
    <h3>오늘 일정</h3>
    <div class="tl">${tl || '<div class="empty">일정이 없어요</div>'}</div>
    <h3>최근 7일 완료</h3>
    <div class="bars">${days.map((ds, i) => `<div class="${ds === d ? 'today' : ''}">${counts[i]}<i style="height:${counts[i] / max * 44 + 2}px"></i>${DOW[S.parseYmd(ds).getDay()]}</div>`).join('')}</div>`;
}
function render() { if (!D) return; KIND === 'calendar' ? renderCalendar() : renderDaily(); }

// ---------- 상호작용 ----------
$('#main').addEventListener('click', (e) => {
  const m = e.target.dataset.m;
  if (m !== undefined) { if (m === '0') month = new Date(); else month.setMonth(month.getMonth() + Number(m)); month.setDate(1); render(); return; }
  if (e.target.closest('.c')) api.openPanel('calendar');
});
$('#main').addEventListener('change', (e) => {
  const id = e.target.dataset.id; if (!id) return;
  const t = D.todos.find((x) => x.id === id); t.done = e.target.checked; t.doneAt = t.done ? Date.now() : null;
  api.saveTodos(D.todos).then((v) => { D.todos = v; render(); });
});
$('#main').addEventListener('keydown', (e) => {
  if (e.target.id !== 'addTodo' || e.key !== 'Enter' || e.isComposing) return;
  const text = e.target.value.trim(); if (!text) return;
  D.todos.push({ id: S.uid(), text, date: today(), done: false, order: Date.now() });
  api.saveTodos(D.todos).then((v) => { D.todos = v; render(); setTimeout(() => $('#addTodo') && $('#addTodo').focus(), 0); });
});
function applyCfg() {
  $('#pinBtn').classList.toggle('on', !!cfg.onTop); $('#lockBtn').classList.toggle('on', !!cfg.locked);
  document.body.classList.toggle('locked', !!cfg.locked); $('#opacity').value = cfg.opacity || 1;
}
$('#pinBtn').onclick = () => api.widgetSet(KIND, { onTop: !cfg.onTop });
$('#lockBtn').onclick = () => api.widgetSet(KIND, { locked: !cfg.locked });
$('#closeBtn').onclick = () => api.widgetToggle(KIND);
$('#openBtn').onclick = () => api.openPanel(KIND === 'calendar' ? 'calendar' : 'today');
$('#opacity').addEventListener('input', (e) => api.widgetSet(KIND, { opacity: Number(e.target.value) }));
// 잠금 중에는 자물쇠 버튼 위에서만 클릭을 받고 나머지는 바탕화면으로 통과
let ignoring = false;
window.addEventListener('mousemove', (e) => {
  if (!cfg.locked) { if (ignoring) { ignoring = false; api.widgetIgnore(false); } return; }
  const r = $('#lockBtn').getBoundingClientRect(), over = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  if (over === ignoring) { ignoring = !over; api.widgetIgnore(!over); }
});
$('#title').textContent = KIND === 'calendar' ? '달력' : '오늘';
api.onWidgetCfg(({ kind, cfg: c }) => { if (kind !== KIND) return; cfg = c; applyCfg(); if (!cfg.locked && ignoring) { ignoring = false; api.widgetIgnore(false); } });
api.onEvents((v) => { D.events = v; render(); });
api.onTodos((v) => { D.todos = v; render(); });
api.onFocus((v) => { D.focus = v; render(); });
window.addEventListener('resize', () => KIND === 'calendar' && render());
setInterval(render, 60000);
api.getData().then((d) => { D = d; cfg = (d.settings.widgets || {})[KIND] || {}; applyCfg(); render(); });
