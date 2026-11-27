// 패널 시작: 데이터 불러오고 실시간 동기화 연결
api.onEvents((v) => { App.d.events = v; App.emit('events'); });
api.onTodos((v) => { App.d.todos = v; App.emit('todos'); });
api.onPet((v) => { App.d.pet = v; App.emit('pet'); });
api.onCharacter((v) => { App.d.character = v; App.emit('character'); });
api.onSettings((v) => { App.d.settings = v; App.emit('settings'); });
api.onFocus((v) => { v.endsAt += Date.now() - v.now; App.d.focus = v; App.emit('focus'); });
const openTab = (t) => { if (t === 'smart') { showTab('today'); Smart.open(); } else showTab(t); };
api.onTab(openTab);
api.getData().then((d) => {
  d.focus.endsAt += Date.now() - d.focus.now;
  App.d = d;
  renderHeader();
  Cal.resetForm();
  openTab(new URLSearchParams(location.search).get('tab') || 'today');
});
// 자정이 지나면 오늘 화면 갱신
let lastDay = today();
setInterval(() => { if (today() !== lastDay) { lastDay = today(); App.emit('todos'); App.emit('events'); App.emit('tab:' + App.tab); } }, 30000);

// 바탕화면 위젯 토글 버튼 + 바탕화면 미니게임
async function syncWidgetButtons() {
  const st = await api.widgetState();
  $$('.wbtn').forEach((b) => {
    const on = st[b.dataset.w]; b.classList.toggle('on', !!on);
    b.textContent = b.dataset.w === 'daily' ? (on ? '데일리 위젯 닫기' : '데일리 위젯 띄우기') : (on ? '바탕화면 달력 닫기' : '바탕화면에 띄우기');
  });
}
$$('.wbtn').forEach((b) => b.addEventListener('click', async () => { await api.widgetToggle(b.dataset.w); syncWidgetButtons(); }));
api.onWidgets(syncWidgetButtons);
syncWidgetButtons();
$('#desktopGame').onclick = () => api.gameOpen();
