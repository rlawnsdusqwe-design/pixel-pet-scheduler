// 패널 공통: 상태, 이벤트 버스, 탭, 헤더
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const S = window.Shared;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const fmtDate = (ds) => { const d = S.parseYmd(ds); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`; };
const today = () => S.ymd(new Date());
const endHM = (t, dur) => { if (!t || !dur) return ''; const [h, m] = t.split(':').map(Number), x = h * 60 + m + Number(dur); return `${S.pad(Math.floor(x / 60) % 24)}:${S.pad(x % 60)}`; };

const App = {
  d: null, tab: 'today', handlers: {},
  on(name, fn) { (this.handlers[name] = this.handlers[name] || []).push(fn); },
  emit(name) { (this.handlers[name] || []).forEach((fn) => fn()); },
  async saveTodos() { this.d.todos = await api.saveTodos(this.d.todos); this.emit('todos'); },
  async saveEvents() { this.d.events = await api.saveEvents(this.d.events); this.emit('events'); },
};

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200);
}
function showTab(t) {
  App.tab = t;
  $$('.tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
  $$('main section').forEach((s) => s.classList.toggle('on', s.id === t));
  App.emit('tab:' + t);
}
$$('.tab').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

// 펫 애니메이션 공용 루프: 등록된 캔버스들을 같이 움직임
const petCanvases = []; // {canvas, frame(t), bob(t), character(), acc()}
let animT = 0;
setInterval(() => {
  animT++;
  if (!App.d) return;
  for (const pc of petCanvases) {
    if (!pc.canvas.offsetParent) continue; // 안 보이면 생략
    const ch = pc.character ? pc.character() : App.d.character; if (!ch) continue;
    Render.renderPet(pc.canvas.getContext('2d'), ch, pc.frame ? pc.frame(animT) : (animT % 40 < 2 ? 'blink' : 'idle'),
      { bob: pc.bob ? pc.bob(animT) : 0, acc: pc.acc ? pc.acc() : App.d.pet.equipped });
  }
}, 90);

function renderHeader() {
  const p = App.d.pet, L = S.levelInfo(p.xp);
  $('#petName').textContent = App.d.character.name || '도트 펫';
  $('#hdrLevel').textContent = `Lv.${L.level}`;
  $('#hdrCoins').textContent = `꿀 ${p.coins}`;
}
App.on('pet', renderHeader); App.on('character', renderHeader);
petCanvases.push({ canvas: $('#mini') });

// 펫 상태 막대
const STAT_DEF = [['hunger', '배부름', '#f0a030'], ['fun', '기분', '#ff7a90'], ['clean', '청결', '#5bc0eb'], ['energy', '기운', '#3fae6a']];
function statBars(p) {
  return STAT_DEF.map(([k, l, c]) => `<div class="stat"><span>${l}</span><div class="progress"><i style="width:${p[k]}%;background:${p[k] < 30 ? '#e2504c' : c}"></i></div><b>${Math.round(p[k])}</b></div>`).join('');
}
