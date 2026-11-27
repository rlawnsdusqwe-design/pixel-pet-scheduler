// 문장으로 일정 만들기: 붙여넣기 → 분석 → 미리보기/수정 → 추가
const Smart = (() => {
  let items = [];
  const KIND = { event: '일정', todo: '할 일', auto: '자동 배치' };
  const EXAMPLE = `내일 오후 3시 팀 회의 10분 전 알림
다음주 월요일 10시 반 클라이언트 미팅
금요일까지 분기 보고서 작성 2시간
매일 아침 8시 약 먹기
평일 저녁 7시 헬스
영어 단어 외우기 30분
장보기, 택배 보내기
모레까지 과제 제출 중요!!`;

  function open(prefill) {
    $('#smartModal').hidden = false;
    $('#smartInput').hidden = false; $('#smartPreview').hidden = true;
    if (prefill) $('#smartText').value = prefill;
    setTimeout(() => $('#smartText').focus(), 30);
  }
  function close() { $('#smartModal').hidden = true; }

  function analyze() {
    const text = $('#smartText').value.trim();
    if (!text) { toast('내용을 입력해 주세요'); return; }
    const s = App.d.settings;
    items = SmartParse.autoSchedule(SmartParse.parse(text), App.d.events, { dayStart: s.dayStart, dayEnd: s.dayEnd });
    items.forEach((i) => (i.on = true));
    if (!items.length) { toast('인식된 항목이 없어요'); return; }
    renderRows();
    $('#smartInput').hidden = true; $('#smartPreview').hidden = false;
  }
  const catOpts = (v) => S.CATEGORIES.map((c) => `<option value="${c.id}" ${c.id === v ? 'selected' : ''}>${c.label}</option>`).join('');
  function renderRows() {
    const head = `<div class="srow head"><span></span><span>종류</span><span>제목</span><span>날짜</span><span>시간</span><span>소요</span><span>분류</span></div>`;
    $('#smartRows').innerHTML = head + items.map((it, i) => {
      const isTodo = it.kind === 'todo';
      const extra = [
        it.repeat !== 'none' ? S.REPEAT_LABEL[it.repeat] + ' 반복' : '',
        it.remind ? `${it.remind}분 전 알림` : '',
        it.due ? `마감 ${it.due.slice(5).replace('-', '/')}` : '',
        it.autoPlaced ? '빈 시간에 자동 배치' : '', it.note || '', it.important ? '중요' : '',
      ].filter(Boolean).join(' · ');
      return `<div class="srow ${it.on ? '' : 'off'}" data-i="${i}">
        <input type="checkbox" data-k="on" ${it.on ? 'checked' : ''}>
        <select data-k="kind"><option value="event" ${!isTodo ? 'selected' : ''}>${it.kind === 'auto' ? '자동 배치' : '일정'}</option><option value="todo" ${isTodo ? 'selected' : ''}>할 일</option></select>
        <input data-k="title" value="${esc(it.title)}">
        <input type="date" data-k="date" value="${it.date || ''}">
        <input type="time" data-k="time" value="${it.time || ''}" ${isTodo ? 'disabled' : ''}>
        <select data-k="dur" ${isTodo ? 'disabled' : ''}>${['', 30, 60, 90, 120, 180, 240].map((d) => `<option value="${d}" ${String(it.dur || '') === String(d) ? 'selected' : ''}>${d ? (d >= 60 ? d / 60 + '시간' : d + '분') : '-'}</option>`).join('')}</select>
        <select data-k="category">${catOpts(it.category)}</select>
        <div class="src">“${esc(it.raw)}”${extra ? ' → ' + esc(extra) : ''}</div>
      </div>`;
    }).join('');
    const on = items.filter((i) => i.on);
    const ev = on.filter((i) => i.kind !== 'todo').length, td = on.length - ev, auto = on.filter((i) => i.autoPlaced && i.kind !== 'todo').length;
    $('#smartSummary').textContent = `일정 ${ev}개${auto ? ` (자동 배치 ${auto})` : ''} · 할 일 ${td}개`;
  }
  $('#smartRows').addEventListener('change', (e) => {
    const row = e.target.closest('.srow'); if (!row || row.classList.contains('head')) return;
    const it = items[row.dataset.i], k = e.target.dataset.k;
    if (k === 'on') it.on = e.target.checked;
    else if (k === 'kind') { if (e.target.value === 'todo') it.kind = 'todo'; else it.kind = it.autoPlaced ? 'auto' : 'event'; }
    else if (k === 'dur') it.dur = e.target.value ? Number(e.target.value) : null;
    else it[k] = e.target.value;
    renderRows();
  });
  async function apply() {
    const on = items.filter((i) => i.on && i.title.trim());
    if (!on.length) return toast('추가할 항목을 선택해 주세요');
    const defAlarm = App.d.settings.defaultAlarm;
    let ne = 0, nt = 0;
    for (const it of on) {
      if (it.kind === 'todo') {
        App.d.todos.push({ id: S.uid(), text: it.title.trim(), date: it.date || today(), done: false, order: Date.now() + nt, due: it.due || null, important: it.important });
        nt++;
      } else {
        App.d.events.push({ id: S.uid(), title: it.title.trim(), date: it.date || today(), time: it.time || '', dur: it.dur || null,
          repeat: it.repeat || 'none', category: it.category, remind: it.remind != null ? it.remind : it.time ? 10 : 0,
          alarm: defAlarm, auto: !!it.autoPlaced, doneDates: [] });
        ne++;
      }
    }
    if (nt) await App.saveTodos();
    if (ne) await App.saveEvents();
    close(); $('#smartText').value = '';
    toast(`일정 ${ne}개, 할 일 ${nt}개를 추가했어요`);
  }
  $('#smartParse').onclick = analyze;
  $('#smartText').addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') analyze(); });
  $('#smartBack').onclick = () => { $('#smartInput').hidden = false; $('#smartPreview').hidden = true; };
  $('#smartApply').onclick = apply;
  $('#smartClose').onclick = close;
  $('#smartExample').onclick = () => { $('#smartText').value = EXAMPLE; };
  $('#smartModal').addEventListener('mousedown', (e) => { if (e.target.id === 'smartModal') close(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#smartModal').hidden) close(); });
  ['#smartOpen', '#todaySmart', '#calSmart'].forEach((s) => $(s).addEventListener('click', () => open()));
  return { open };
})();
