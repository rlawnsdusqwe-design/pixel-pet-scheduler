// 뽀모도로 집중 타이머
(() => {
  const opts = (arr, v) => arr.map((n) => `<option ${n === v ? 'selected' : ''}>${n}</option>`).join('');
  petCanvases.push({
    canvas: $('#focusPet'),
    frame: (t) => { const f = App.d.focus; if (f.state === 'focus' && !f.paused) return t % 30 < 2 ? 'blink' : 'idle'; if (f.state === 'break') return t % 8 < 4 ? 'happy' : 'idle'; return t % 40 < 2 ? 'blink' : 'idle'; },
    bob: (t) => (App.d.focus.state === 'break' ? (t % 8 < 4 ? 3 : 0) : 0),
  });
  function left() { const f = App.d.focus; return f.state === 'idle' ? f.focusMin * 60000 : Math.max(0, f.paused ? f.left : f.endsAt - Date.now()); }
  function renderButtons() {
    const f = App.d.focus;
    let h;
    if (f.state === 'idle') h = `<button class="primary" data-c="focus">${f.focusMin}분 집중 시작</button><button data-c="break">${f.breakMin}분 휴식</button>`;
    else h = `${f.paused ? '<button class="primary" data-c="resume">계속</button>' : '<button data-c="pause">일시정지</button>'}<button data-c="stop">중지</button>`;
    $('#focusBtns').innerHTML = h;
    $('#fmFocus').innerHTML = opts([15, 20, 25, 30, 40, 50, 60, 90], App.d.settings.focusMin);
    $('#fmBreak').innerHTML = opts([3, 5, 10, 15, 20], App.d.settings.breakMin);
    const c = f.todayCount;
    $('#focusTomatoes').innerHTML = `오늘 완료<b>${c}회</b>`;
    // 최근 7일
    const days = [...Array(7)].map((_, i) => S.addDays(today(), i - 6)), max = Math.max(1, ...days.map((d) => App.d.focusLog[d] || 0));
    $('#focusWeek').innerHTML = days.map((d) => { const n = App.d.focusLog[d] || 0; return `<div>${n}<i style="height:${(n / max) * 60 + 4}px;opacity:${n ? 1 : .25}"></i>${DOW[S.parseYmd(d).getDay()]}</div>`; }).join('');
  }
  function renderTime() {
    if (App.tab !== 'focus' || !App.d) return;
    const f = App.d.focus, ms = left(), s = Math.ceil(ms / 1000);
    $('#focusTime').textContent = `${S.pad(Math.floor(s / 60))}:${S.pad(s % 60)}`;
    $('#focusMode').textContent = f.state === 'focus' ? (f.paused ? '일시정지됨' : '집중하는 중') : f.state === 'break' ? '휴식 중' : '준비';
    $('#focusBar').style.width = f.state === 'idle' ? '0%' : (100 - ms / f.total * 100) + '%';
    $('#focusBar').style.background = f.state === 'break' ? 'var(--ok)' : 'var(--accent)';
  }
  setInterval(renderTime, 250);
  $('#focusBtns').addEventListener('click', (e) => { if (e.target.dataset.c) api.focus(e.target.dataset.c); });
  $('#fmFocus').onchange = (e) => api.saveSettings({ focusMin: Number(e.target.value) });
  $('#fmBreak').onchange = (e) => api.saveSettings({ breakMin: Number(e.target.value) });
  ['focus', 'tab:focus', 'settings'].forEach((n) => App.on(n, () => { if (App.tab === 'focus') { renderButtons(); renderTime(); } }));
})();
