// 큰 달력 (월/주) + 날짜 상세 + 일정 폼
const Cal = (() => {
  let view = 'month', sel = today(), cursor = S.parseYmd(today()), editingId = null;

  $('#fCat').innerHTML = S.CATEGORIES.map((c) => `<option value="${c.id}">${c.label}</option>`).join('');
  $('#calLegend').innerHTML = S.CATEGORIES.map((c) => `<span><i style="background:${c.color}"></i>${c.label}</span>`).join('');

  function chip(e) {
    const c = S.catOf(e.category).color, showTime = view === 'week' && e.time;
    return `<span class="chip ${e.isDone ? 'done' : ''}" data-ev="${e.id}" title="${e.time ? e.time + ' ' : ''}${esc(e.title)}" style="background:color-mix(in srgb, ${c} 14%, transparent);box-shadow:inset 2px 0 0 ${c}">${showTime ? `<b>${e.time}</b>` : ''}${esc(e.title)}</span>`;
  }
  function todoCount(ds) {
    const t = App.d.todos.filter((x) => x.date === ds); if (!t.length) return '';
    return `<span class="tc">${t.filter((x) => x.done).length}/${t.length}</span>`;
  }
  function renderGrid() {
    const tdy = today();
    if (view === 'month') {
      const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      $('#calLabel').textContent = `${first.getFullYear()}년 ${first.getMonth() + 1}월`;
      const start = new Date(first); start.setDate(1 - first.getDay());
      const weeks = Math.ceil((first.getDay() + new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()) / 7);
      let h = DOW.map((d) => `<div class="dow">${d}</div>`).join('');
      for (let i = 0; i < weeks * 7; i++) {
        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i), ds = S.ymd(d);
        const MAXC = document.body.classList.contains('cal-big') ? 6 : 3;
        const evs = S.eventsOn(App.d.events, ds), shown = evs.slice(0, MAXC);
        const cls = ['cell', d.getMonth() !== first.getMonth() && 'other', ds === tdy && 'today', ds === sel && 'sel'].filter(Boolean).join(' ');
        h += `<div class="${cls}" data-d="${ds}"><span class="num">${d.getDate()}</span>${todoCount(ds)}
          ${shown.map(chip).join('')}${evs.length > MAXC ? `<span class="chip-more">+${evs.length - MAXC}개 더</span>` : ''}</div>`;
      }
      $('#calGrid').innerHTML = `<div class="mgrid">${h}</div>`;
    } else {
      const s = S.parseYmd(sel); s.setDate(s.getDate() - s.getDay());
      const e = new Date(s); e.setDate(e.getDate() + 6);
      $('#calLabel').textContent = `${s.getMonth() + 1}/${s.getDate()} ~ ${e.getMonth() + 1}/${e.getDate()}`;
      let h = '';
      for (let i = 0; i < 7; i++) {
        const d = new Date(s.getFullYear(), s.getMonth(), s.getDate() + i), ds = S.ymd(d);
        const cls = ['wcol', ds === tdy && 'today', ds === sel && 'sel'].filter(Boolean).join(' ');
        h += `<div class="${cls}" data-d="${ds}"><div class="wh">${DOW[i]}<b>${d.getDate()}</b></div>${todoCount(ds)}
          ${S.eventsOn(App.d.events, ds).map(chip).join('') || ''}</div>`;
      }
      $('#calGrid').innerHTML = `<div class="wgrid">${h}</div>`;
    }
  }
  function renderDay() {
    $('#dayTitle').textContent = fmtDate(sel) + (sel === today() ? ' · 오늘' : '');
    const evs = S.eventsOn(App.d.events, sel);
    $('#dayEvents').innerHTML = evs.length ? evs.map((e) => `
      <div class="ev ${e.isDone ? 'done' : ''}" data-id="${e.id}">
        <span class="bar" style="background:${S.catOf(e.category).color}"></span>
        <input type="checkbox" data-act="done" ${e.isDone ? 'checked' : ''}>
        <span class="time">${e.time || '종일'}${e.dur ? `<small>~${endHM(e.time, e.dur)}</small>` : ''}</span>
        <span class="title">${esc(e.title)}${e.auto ? '<span class="tag">자동</span>' : ''}
          ${e.repeat && e.repeat !== 'none' ? `<span class="tag">${S.REPEAT_LABEL[e.repeat]}</span>` : ''}
          ${(e.alarm || App.d.settings.defaultAlarm) === 'strong' && e.time ? '<span class="tag">알람</span>' : ''}</span>
      </div>`).join('') : '<div class="empty">일정이 없습니다</div>';
    renderDayTodos();
    if (!editingId) $('#fDate').value = sel;
  }
  const renderDayTodos = mountTodoBox($('#dayTodos'), () => sel);
  function render() { if (App.tab !== 'calendar') return; renderGrid(); renderDay(); }

  function select(ds) {
    sel = ds; const d = S.parseYmd(ds);
    if (view === 'month' && (d.getMonth() !== cursor.getMonth() || d.getFullYear() !== cursor.getFullYear())) cursor = new Date(d.getFullYear(), d.getMonth(), 1);
    if (!editingId) $('#fDate').value = ds;
    render();
  }
  function resetForm() {
    editingId = null; $('#evForm').reset();
    $('#fDate').value = sel; $('#fRemind').value = '10'; $('#fAlarm').value = App.d.settings.defaultAlarm; $('#fCat').value = 'personal';
    $('#formTitle').textContent = '새 일정'; $('#fSubmit').textContent = '추가'; $('#fDur').value = '';
    $('#fCancel').hidden = true; $('#fDelete').hidden = true;
  }
  function edit(id) {
    const ev = App.d.events.find((x) => x.id === id); if (!ev) return;
    editingId = id;
    $('#fTitle').value = ev.title; $('#fDate').value = ev.date; $('#fTime').value = ev.time || '';
    $('#fRepeat').value = ev.repeat || 'none'; $('#fCat').value = ev.category || 'etc';
    $('#fRemind').value = String(ev.remind || 0); $('#fDur').value = ev.dur ? String(ev.dur) : ''; $('#fAlarm').value = ev.alarm || App.d.settings.defaultAlarm;
    $('#formTitle').textContent = '일정 수정'; $('#fSubmit').textContent = '저장';
    $('#fCancel').hidden = false; $('#fDelete').hidden = false;
    $('#fTitle').focus();
  }

  $('#calGrid').addEventListener('click', (e) => {
    const c = e.target.closest('[data-d]'); if (!c) return;
    select(c.dataset.d);
    if (document.body.classList.contains('cal-big')) $('.day-panel').classList.add('open');
    const ch = e.target.closest('[data-ev]'); if (ch) edit(ch.dataset.ev);
  });
  $('#calGrid').addEventListener('dblclick', (e) => { if (e.target.closest('[data-d]') && !e.target.closest('[data-ev]')) { resetForm(); $('#fTitle').focus(); } });
  $('#dayEvents').addEventListener('click', (e) => {
    const row = e.target.closest('.ev'); if (!row) return;
    const ev = App.d.events.find((x) => x.id === row.dataset.id);
    if (e.target.dataset.act === 'done') {
      ev.doneDates = ev.doneDates || [];
      if (e.target.checked) ev.doneDates.push(sel); else ev.doneDates = ev.doneDates.filter((x) => x !== sel);
      App.saveEvents();
    } else edit(ev.id);
  });
  $('#calPrev').onclick = () => { if (view === 'month') cursor.setMonth(cursor.getMonth() - 1); else sel = S.addDays(sel, -7); render(); };
  $('#calNext').onclick = () => { if (view === 'month') cursor.setMonth(cursor.getMonth() + 1); else sel = S.addDays(sel, 7); render(); };
  $('#calToday').onclick = () => { cursor = S.parseYmd(today()); select(today()); };
  $('#calView').addEventListener('click', (e) => {
    const v = e.target.dataset.v; if (!v) return; view = v;
    $$('#calView button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
    cursor = S.parseYmd(sel); render();
  });
  // 크게 보기: 사이드바·상세 패널을 접고 달력이 창 전체를 사용
  function setBig(on) {
    document.body.classList.toggle('cal-big', on); $('#calExpand').classList.toggle('on', on);
    $('#calExpand').textContent = on ? '기본 보기' : '크게 보기'; $('.day-panel').classList.remove('open'); render();
  }
  $('#calExpand').onclick = () => setBig(!document.body.classList.contains('cal-big'));
  $('#dayClose').onclick = () => $('.day-panel').classList.remove('open');
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !document.body.classList.contains('cal-big') || !$('#smartModal').hidden) return;
    if ($('.day-panel').classList.contains('open')) $('.day-panel').classList.remove('open'); else setBig(false);
  });
  App.on('tab:today', () => document.body.classList.contains('cal-big') && setBig(false));
  $('#fCancel').onclick = resetForm;
  $('#fDelete').onclick = () => {
    const ev = App.d.events.find((x) => x.id === editingId); if (!ev) return;
    if (!confirm(`"${ev.title}" 일정을 삭제할까요?${ev.repeat && ev.repeat !== 'none' ? '\n(반복 일정 전체가 삭제돼요)' : ''}`)) return;
    App.d.events = App.d.events.filter((x) => x !== ev); resetForm(); App.saveEvents(); toast('삭제했어요');
  };
  $('#evForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = { title: $('#fTitle').value.trim(), date: $('#fDate').value, time: $('#fTime').value, repeat: $('#fRepeat').value,
      category: $('#fCat').value, remind: Number($('#fRemind').value), alarm: $('#fAlarm').value, dur: $('#fDur').value ? Number($('#fDur').value) : null };
    if (!v.title || !v.date) return;
    if (editingId) Object.assign(App.d.events.find((x) => x.id === editingId), v, { lastNotified: null, lastReminded: null });
    else App.d.events.push({ id: S.uid(), ...v, doneDates: [] });
    toast(editingId ? '수정했어요' : '일정을 추가했어요');
    sel = v.date; resetForm(); App.saveEvents();
  });
  ['events', 'todos', 'settings', 'tab:calendar'].forEach((n) => App.on(n, render));
  return { select, edit, resetForm, render };
})();
