const cv = document.getElementById('pet'), ctx = cv.getContext('2d');
const bubble = document.getElementById('bubble'), chip = document.getElementById('chip'), giftEl = document.getElementById('gift');
let character, settings, petData, focus, mode = 'idle', dir = 1, tickN = 0, blinkUntil = 0, cssH = 0;
let act = { anim: null, until: 0 };

// 리그 캐릭터(릴리): 상황마다 전용 모션
function rigAnim() {
  if (mode === 'drag') return 'drag';
  if (mode === 'fall') return 'fall';
  if (Date.now() < act.until) return act.anim;
  switch (mode) {
    case 'walk': case 'goto': return 'walk';
    case 'alert': return 'alarm';
    case 'hop': return 'wave';
    case 'happy': return 'cheer';
    case 'eat': return 'eat';
    case 'sleep': return 'sleep';
    case 'focus': return 'focus';
    default: {
      const needs = petData ? Shared.needsOf(petData) : [];
      if (needs.length && Math.floor(Date.now() / 5000) % 3 === 0)
        return needs.some((n) => n.key === 'clean') ? 'angry' : needs.some((n) => n.key === 'fun') ? 'sad' : 'needy';
      return 'idle';
    }
  }
}

function frameName() {
  const t = Math.floor(tickN / 6) % 2;
  switch (mode) {
    case 'walk': case 'goto': return t ? 'walk1' : 'walk2';
    case 'alert': return t ? 'surprised' : 'happy';
    case 'hop': return 'wave';
    case 'happy': return 'happy';
    case 'eat': return Math.floor(tickN / 5) % 2 ? 'eat' : 'idle';
    case 'sleep': return 'sleep';
    case 'drag': case 'fall': return 'surprised';
    default:
      if (Date.now() < blinkUntil) return 'blink';
      return petData && Shared.needsOf(petData).length && Math.floor(tickN / 50) % 2 ? 'sad' : 'idle';
  }
}
function layout() {
  const cssW = 32 * settings.scale; cssH = Math.round(cssW * 84 / 64);
  cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
  cv.style.imageRendering = character && character.size >= 128 && cssW < 128 ? 'auto' : 'pixelated';
  chip.style.bottom = (cssH + 2) + 'px';
  giftEl.style.bottom = (cssH - 4) + 'px';
  bubble.style.bottom = (cssH + 26) + 'px';
}
function draw() {
  if (!character) return;
  const bob = (mode === 'walk' || mode === 'goto') && Math.floor(tickN / 6) % 2 ? 2 : (mode === 'sleep' && Math.floor(tickN / 12) % 2 ? 1 : 0);
  if (character.rig) return Render.renderPet(ctx, character, rigAnim(), { flip: dir < 0, acc: petData && petData.equipped });
  Render.renderPet(ctx, character, frameName(), { flip: dir < 0, bob, acc: petData && petData.equipped });
}
setInterval(() => {
  tickN++;
  if ((mode === 'idle' || mode === 'focus') && Math.random() < 0.012) blinkUntil = Date.now() + 160;
  if (mode === 'sleep' && tickN % 38 === 0) spawnEmote('💤', 1);
  if (mode === 'focus' && tickN % 90 === 0) spawnEmote(['📖', '✏️', '💡'][Math.floor(Math.random() * 3)], 1);
  draw();
}, 40);

// ---- 이모티콘 ----
function spawnEmote(emoji, count = 1) {
  for (let i = 0; i < count; i++) setTimeout(() => {
    const el = document.createElement('div'); el.className = 'emote'; el.textContent = emoji;
    el.style.left = (window.innerWidth / 2 - 10 + (Math.random() - 0.5) * 60) + 'px';
    el.style.bottom = (cssH * 0.6 + Math.random() * 20) + 'px';
    document.body.appendChild(el); setTimeout(() => el.remove(), 1700);
  }, i * 140);
}

// ---- 말풍선 ----
let bubbleTimer;
function say(text, ms = 4000) {
  bubble.textContent = text; bubble.classList.add('show');
  clearTimeout(bubbleTimer); bubbleTimer = setTimeout(() => bubble.classList.remove('show'), ms);
}
bubble.addEventListener('click', () => { bubble.classList.remove('show'); api.openPanel('today'); });

async function showSummary() {
  const s = await api.summary();
  if (s.sleeping) return api.action('wake');
  const lines = [], left = s.todos.filter((t) => !t.done);
  if (s.todos.length) {
    lines.push(`📝 할 일 ${s.todos.length - left.length}/${s.todos.length} 완료`);
    left.slice(0, 3).forEach((t) => lines.push(`  · ${t.text}`));
  }
  const today = Shared.ymd(new Date());
  s.upcoming.slice(0, 2).forEach((e) => lines.push(`⏰ ${e.occDate === today ? '' : '내일 '}${e.time || '종일'} ${e.title}`));
  if (s.needs.length) lines.push(s.needs[0].text);
  if (!lines.length) lines.push('오늘은 여유로운 날!\n더블클릭해서 할 일을 추가해봐 ✨');
  say(lines.join('\n'), 7000);
}

// ---- 집중 타이머 칩 ----
function updateChip() {
  if (!focus || focus.state === 'idle') { chip.style.display = 'none'; return; }
  const left = Math.max(0, focus.paused ? focus.left : focus.endsAt - Date.now()), s = Math.ceil(left / 1000);
  chip.textContent = `${focus.state === 'focus' ? '집중' : '휴식'} ${Shared.pad(Math.floor(s / 60))}:${Shared.pad(s % 60)}${focus.paused ? ' · 일시정지' : ''}`;
  chip.style.background = focus.state === 'focus' ? '#4f5bd5' : '#1f9d6b';
  chip.style.display = 'block';
}
setInterval(updateChip, 500);

// ---- 마우스: 투명 부분은 클릭 통과 / 드래그 / 클릭 / 쓰다듬기 ----
function hitCanvas(e) {
  const r = cv.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX >= r.right || e.clientY < r.top || e.clientY >= r.bottom) return false;
  const x = Math.floor((e.clientX - r.left) / r.width * cv.width), y = Math.floor((e.clientY - r.top) / r.height * cv.height);
  const d = ctx.getImageData(Math.max(0, x - 1), Math.max(0, y - 1), 3, 3).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
  return false;
}
function hitBubble(e) {
  if (!bubble.classList.contains('show')) return false;
  const b = bubble.getBoundingClientRect();
  return e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom;
}
let ignoring = true, drag = null, stroke = { lastX: null, dirX: 0, flips: [], cool: 0 };
window.addEventListener('mousemove', (e) => {
  if (drag) {
    if (!drag.moved && Math.hypot(e.screenX - drag.sx, e.screenY - drag.sy) > 5) { drag.moved = true; api.dragStart(); cv.classList.add('dragging'); }
    if (drag.moved) api.dragMove({ x: e.screenX - drag.ox, y: e.screenY - drag.oy });
    return;
  }
  const onPet = hitCanvas(e), want = !(onPet || hitBubble(e));
  if (want !== ignoring) { ignoring = want; api.setIgnore(want); }
  // 쓰다듬기: 캐릭터 위에서 좌우로 문지르기
  if (onPet && e.buttons === 0) {
    if (stroke.lastX !== null) {
      const d = e.clientX - stroke.lastX, s = Math.sign(d);
      if (Math.abs(d) > 1 && s !== stroke.dirX) { if (stroke.dirX !== 0) stroke.flips.push(Date.now()); stroke.dirX = s; }
    }
    stroke.lastX = e.clientX;
    stroke.flips = stroke.flips.filter((t) => Date.now() - t < 1400);
    if (stroke.flips.length >= 4 && Date.now() > stroke.cool) { stroke.flips = []; stroke.cool = Date.now() + 1800; api.action('stroke'); }
  } else stroke.lastX = null;
});
cv.addEventListener('mousedown', (e) => { if (e.button === 0) drag = { sx: e.screenX, sy: e.screenY, ox: e.clientX, oy: e.clientY, moved: false }; });
let clickCount = 0, clickTimer;
window.addEventListener('mouseup', () => {
  if (!drag) return;
  const moved = drag.moved; drag = null; cv.classList.remove('dragging');
  if (moved) return api.dragEnd();
  clickCount++; clearTimeout(clickTimer);
  clickTimer = setTimeout(async () => {
    const n = clickCount; clickCount = 0;
    if (n >= 2) return api.openPanel('today');
    if (giftEl.style.display === 'block') return api.action('gift');
    if (mode !== 'sleep') api.hop();
    showSummary();
  }, 260);
});
cv.addEventListener('contextmenu', (e) => { e.preventDefault(); api.petMenu(); });

// ---- 메인 프로세스 연결 ----
api.onState((s) => { mode = s.mode; dir = s.dir; });
api.onBubble(({ text, ms }) => say(text, ms));
api.onEmote(({ emoji, count }) => spawnEmote(emoji, count));
api.onSound(({ type, volume }) => Sound.play(type, volume));
api.onGift((v) => { giftEl.style.display = v ? 'block' : 'none'; });
api.onCharacter((c) => { character = c; layout(); });
api.onAct(({ anim, ms }) => { act = { anim, until: Date.now() + ms }; });
api.onSettings((s) => { settings = s; layout(); });
api.onPet((p) => { petData = p; });
api.onFocus((f) => { focus = f; f.endsAt += Date.now() - f.now; updateChip(); });
api.getData().then((d) => {
  character = d.character; settings = d.settings; petData = d.pet; focus = d.focus;
  layout(); draw(); updateChip();
});
