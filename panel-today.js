// 할 일 목록 컴포넌트 + 오늘 탭
function todoListHTML(date) {
  const list = App.d.todos.filter((t) => t.date === date).sort((a, b) => (a.done - b.done) || (a.order || 0) - (b.order || 0));
  const items = list.map((t) => `
    <li data-id="${t.id}" class="${t.done ? 'done' : ''}">
      <input type="checkbox" data-act="toggle" ${t.done ? 'checked' : ''}>
      <span class="text" title="더블클릭해서 수정">${esc(t.text)}</span>
      ${t.important && !t.done ? '<span class="tag warn">중요</span>' : ''}
      ${t.due && !t.done ? `<span class="tag${t.due <= today() ? ' warn' : ''}">마감 ${t.due.slice(5).replace('-', '/')}</span>` : ''}
      ${t.carried && !t.done ? '<span class="tag">이월</span>' : ''}
      ${!t.done ? '<button class="ghost" data-act="tomorrow" title="내일로 미루기">⏭</button>' : ''}
      <button class="ghost" data-act="del" title="삭제">🗑️</button>
    </li>`).join('');
  return `<div class="todo-add"><input placeholder="할 일 추가 (Enter)" maxlength="120"><button class="small" data-act="add">추가</button></div>
    <ul class="todos">${items || '<div class="empty">할 일이 없습니다</div>'}</ul>`;
}
function mountTodoBox(el, getDate) {
  const render = () => {
    const prev = $('.todo-add input', el), keep = prev && document.activeElement === prev ? prev.value : null;
    el.innerHTML = todoListHTML(getDate());
    if (keep !== null) { const i = $('.todo-add input', el); i.value = keep; i.focus(); }
  };
  const add = () => {
    const inp = $('.todo-add input', el), text = inp.value.trim(); if (!text) return;
    inp.value = '';
    App.d.todos.push({ id: S.uid(), text, date: getDate(), done: false, order: Date.now() });
    App.saveTodos();
  };
  el.addEventListener('keydown', (e) => {
    if (e.target.matches('.todo-add input') && e.key === 'Enter' && !e.isComposing) { e.preventDefault(); add(); }
    if (e.target.matches('.text[contenteditable=true]') && e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
  });
  el.addEventListener('click', (e) => {
    const act = e.target.dataset.act; if (!act) return;
    if (act === 'add') return add();
    const t = App.d.todos.find((x) => x.id === e.target.closest('li').dataset.id); if (!t) return;
    if (act === 'toggle') { t.done = e.target.checked; t.doneAt = t.done ? Date.now() : null; }
    if (act === 'del') App.d.todos = App.d.todos.filter((x) => x !== t);
    if (act === 'tomorrow') { t.date = S.addDays(t.date < today() ? today() : t.date, 1); t.carried = false; toast('내일로 옮겼어요'); }
    App.saveTodos();
  });
  el.addEventListener('dblclick', (e) => {
    const span = e.target.closest('.text'); if (!span) return;
    span.contentEditable = 'true'; span.focus();
    document.getSelection().selectAllChildren(span);
    span.addEventListener('blur', () => {
      const t = App.d.todos.find((x) => x.id === span.closest('li').dataset.id), v = span.textContent.trim();
      span.contentEditable = 'false';
      if (t && v && v !== t.text) { t.text = v; App.saveTodos(); } else render();
    }, { once: true });
  });
  App.on('todos', render);
  return render;
}

// ---------- 오늘 탭 ----------
const renderTodayTodos = mountTodoBox($('#todayTodos'), today);
function renderToday() {
  const d = today(), todos = App.d.todos.filter((t) => t.date === d), done = todos.filter((t) => t.done).length;
  const evCount = S.eventsOn(App.d.events, d).length;
  $('#todayTitle').textContent = fmtDate(d);
  $('#todaySub').textContent = `할 일 ${todos.length - done}개 남음 · 일정 ${evCount}개`;
  $('#todayProgressText').textContent = todos.length ? `${done} / ${todos.length} 완료` : '';
  $('#todayProgress').style.width = todos.length ? (done / todos.length * 100) + '%' : '0%';
  const past = App.d.todos.filter((t) => !t.done && t.date < d);
  const n = $('#carryNotice'); n.hidden = !past.length;
  if (past.length) n.innerHTML = `<span>지난 날 완료하지 못한 할 일 ${past.length}개</span><button class="small" id="carryBtn">오늘로 가져오기</button>`;
  renderTodayTodos();
  const now = S.hm(new Date()), evs = S.eventsOn(App.d.events, d);
  const nextId = (evs.find((e) => !e.isDone && e.time && e.time >= now) || {}).id;
  $('#todayEvents').innerHTML = evs.length ? evs.map((e) => `
    <div class="ev ${e.isDone ? 'done' : ''} ${e.time && e.time < now ? 'past' : ''} ${e.id === nextId ? 'next' : ''}" data-id="${e.id}">
      <span class="bar" style="background:${S.catOf(e.category).color}"></span>
      <input type="checkbox" data-act="done" ${e.isDone ? 'checked' : ''}>
      <span class="time">${e.time || '종일'}${e.dur ? `<small>~${endHM(e.time, e.dur)}</small>` : ''}</span><span class="title">${esc(e.title)}${e.auto ? '<span class="tag">자동</span>' : ''}</span>
      ${e.id === nextId ? '<span class="tag">다음</span>' : ''}
    </div>`).join('') : '<div class="empty">오늘 일정이 없습니다</div>';
  const f = App.d.focus;
  $('#todayFocusCount').textContent = `오늘 ${f.todayCount}회 완료`;
  $('#todayFocusBtn').textContent = f.state === 'idle' ? `${App.d.settings.focusMin}분 집중 시작` : '진행 중 · 중지';
  $('#todayStats').innerHTML = statBars(App.d.pet);
}
$('#carryNotice').addEventListener('click', (e) => {
  if (e.target.id !== 'carryBtn') return;
  App.d.todos.forEach((t) => { if (!t.done && t.date < today()) { t.date = today(); t.carried = true; } });
  App.saveTodos();
});
$('#todayEvents').addEventListener('click', (e) => {
  const row = e.target.closest('.ev'); if (!row) return;
  const ev = App.d.events.find((x) => x.id === row.dataset.id); if (!ev) return;
  if (e.target.dataset.act === 'done') {
    ev.doneDates = ev.doneDates || [];
    if (e.target.checked) ev.doneDates.push(today()); else ev.doneDates = ev.doneDates.filter((x) => x !== today());
    App.saveEvents();
  } else { Cal.select(today()); Cal.edit(ev.id); showTab('calendar'); }
});
$('#todayAddEvent').onclick = () => { Cal.select(today()); Cal.resetForm(); showTab('calendar'); $('#fTitle').focus(); };
$('#todayFocusBtn').onclick = () => api.focus(App.d.focus.state === 'idle' ? 'focus' : 'stop');
$('#todayFocusGo').onclick = () => showTab('focus');
$('#todayPetCard').onclick = () => showTab('pet');
['todos', 'events', 'pet', 'focus', 'tab:today'].forEach((n) => App.on(n, () => App.tab === 'today' && renderToday()));
