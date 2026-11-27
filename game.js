// 바탕화면 미니게임: 화면 위에서 떨어지는 간식을 캐릭터가 작업 표시줄 위를 달리며 받기
const cv = document.getElementById('cv'), g = cv.getContext('2d'), $ = (s) => document.getElementById(s);
const sprite = document.createElement('canvas');
const ITEMS = [['🍙', 1, 30], ['🍓', 1, 24], ['🍪', 1, 24], ['🐟', 2, 14], ['🍯', 3, 8], ['⭐', 5, 4], ['💣', -5, 14]];
const TOTAL_W = ITEMS.reduce((s, i) => s + i[2], 0), DURATION = 45;
let D = null, st = null, raf = 0, W = 0, H = 0, scale = 1;
let DPR = window.devicePixelRatio || 1;
function resize() { DPR = window.devicePixelRatio || 1; W = cv.width = Math.round(innerWidth * DPR); H = cv.height = Math.round(innerHeight * DPR); scale = Math.max(1, Math.round(Math.max(1.2, Math.min(2.2, innerHeight / 520)) * DPR)); sprite.width = 128 * scale; sprite.height = 168 * scale; }
addEventListener('resize', resize); resize();
const pick = () => { let r = Math.random() * TOTAL_W; for (const it of ITEMS) if ((r -= it[2]) < 0) return it; return ITEMS[0]; };

function start() {
  $('start').hidden = true; $('end').hidden = true;
  st = { score: 0, time: DURATION, items: [], pops: [], px: W / 2, target: W / 2, dir: 1, last: performance.now(), spawn: 0, keys: {}, over: false, shake: 0, t: 0 };
  cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
}
function loop(now) {
  if (!st) return;
  const dt = Math.min(0.05, (now - st.last) / 1000); st.last = now; st.t += dt;
  if (!st.over) {
    st.time -= dt;
    if (st.keys.ArrowLeft) st.target -= 900 * DPR * dt; if (st.keys.ArrowRight) st.target += 900 * DPR * dt;
    st.target = Math.max(60, Math.min(W - 60, st.target));
    const d = st.target - st.px; if (Math.abs(d) > 2) st.dir = Math.sign(d);
    st.moving = Math.abs(d) > 6; st.px += d * Math.min(1, dt * 10);
    const diff = 1 + (DURATION - st.time) / 25;
    st.spawn -= dt;
    if (st.spawn <= 0) { st.items.push({ x: 40 + Math.random() * (W - 80), y: -40, vy: (180 + Math.random() * 120) * diff * DPR, rot: Math.random() * 6, it: pick() }); st.spawn = Math.max(0.16, 0.5 / diff); }
    const catchY = H - 168 * scale * 0.55, half = 52 * scale;
    st.items = st.items.filter((o) => {
      o.y += o.vy * dt; o.rot += dt * 2;
      if (o.y > catchY && o.y < H - 20 && Math.abs(o.x - st.px) < half) {
        st.score = Math.max(0, st.score + o.it[1]);
        st.pops.push({ x: o.x, y: catchY, txt: (o.it[1] > 0 ? '+' : '') + o.it[1], life: 1, bad: o.it[1] < 0 });
        if (o.it[1] < 0) { st.shake = 0.35; st.hurt = 0.8; Sound.play('beep', 0.3); } else Sound.play(o.it[1] >= 3 ? 'coin' : 'pop', 0.35);
        return false;
      }
      return o.y < H + 40;
    });
    if (st.time <= 0) end();
  }
  st.pops.forEach((p) => { p.y -= 60 * dt; p.life -= dt; }); st.pops = st.pops.filter((p) => p.life > 0);
  st.shake = Math.max(0, st.shake - dt); st.hurt = Math.max(0, (st.hurt || 0) - dt);
  draw(); raf = requestAnimationFrame(loop);
}
function draw() {
  g.clearRect(0, 0, W, H);
  g.fillStyle = 'rgba(15,17,21,.18)'; g.fillRect(0, 0, W, H);            // 살짝 어둡게: 게임 중임을 표시
  g.save(); if (st.shake) g.translate((Math.random() - 0.5) * 14, 0);
  g.font = `${Math.round(34 * DPR * 1.6)}px "Segoe UI Emoji","Apple Color Emoji",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const o of st.items) { g.save(); g.translate(o.x, o.y); g.rotate(Math.sin(o.rot) * 0.3); g.fillText(o.it[0], 0, 0); g.restore(); }
  const ch = D.character, anim = st.over ? 'cheer' : st.hurt ? (ch.rig ? 'dizzy' : 'surprised') : st.moving ? (ch.rig ? 'walk' : Math.floor(st.t * 8) % 2 ? 'walk1' : 'walk2') : 'idle';
  Render.renderPet(sprite.getContext('2d'), ch, anim, { flip: st.dir < 0, acc: D.pet.equipped, t: st.t, px: scale });
  g.drawImage(sprite, Math.round(st.px - sprite.width / 2), H - sprite.height);
  g.font = `bold ${Math.round(22 * DPR)}px sans-serif`;
  for (const p of st.pops) { g.globalAlpha = Math.max(0, p.life); g.fillStyle = p.bad ? '#e2504c' : '#ffffff'; g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 4; g.strokeText(p.txt, p.x, p.y); g.fillText(p.txt, p.x, p.y); }
  g.globalAlpha = 1; g.restore();
  $('score').textContent = `${st.score}점`; $('time').textContent = `${Math.max(0, Math.ceil(st.time))}초`;
}
async function end() {
  st.over = true;
  const r = await api.action('gameReward', st.score);
  $('endTitle').textContent = `${st.score}점!`;
  $('endText').textContent = r && r.ok ? `꿀 +${r.coins} · 경험치 +${r.xp}` : '수고했어요';
  $('end').hidden = false;
}
addEventListener('mousemove', (e) => { if (st && !st.over) st.target = e.clientX * DPR; });
addEventListener('keydown', (e) => { if (e.key === 'Escape') return api.gameClose(); if (st) st.keys[e.key] = true; });
addEventListener('keyup', (e) => { if (st) st.keys[e.key] = false; });
$('go').onclick = start; $('again').onclick = start;
$('quit1').onclick = $('quit2').onclick = () => api.gameClose();
api.getData().then((d) => { D = d; st = { score: 0, time: DURATION, items: [], pops: [], px: W / 2, target: W / 2, dir: 1, last: performance.now(), keys: {}, over: false, shake: 0, t: 0, idle: true };
  (function idleLoop(now) { if (!st.idle) return; st.t = now / 1000; draw(); requestAnimationFrame(idleLoop); })(performance.now());
  $('go').addEventListener('click', () => { st.idle = false; }, { once: true });
});
