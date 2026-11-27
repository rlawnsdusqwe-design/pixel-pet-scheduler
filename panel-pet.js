// 돌보기: 상태, 돌봐주기, 가방, 상점, 미니게임
(() => {
  petCanvases.push({ canvas: $('#petBig'), fit: 128, frame: (t) => (t % 40 < 2 ? 'blink' : t % 60 > 50 ? 'happy' : S.needsOf(App.d.pet).length && t % 30 > 15 ? 'sad' : 'idle'), bob: (t) => (t % 60 > 50 ? 2 : 0) });
  const CD = { free: ['lastFreeMeal', 60], wash: ['lastWash', 20], play: ['lastPlay', 5] };

  function cdText(key) {
    const [f, min] = CD[key], left = App.d.pet[f] + min * 60000 - Date.now();
    return left > 0 ? `${Math.ceil(left / 60000)}분 뒤` : '지금 가능';
  }
  function render() {
    if (App.tab !== 'pet') return;
    const p = App.d.pet, L = S.levelInfo(p.xp);
    $('#petTitle').textContent = App.d.character.name || '도트 펫';
    $('#petLevelText').textContent = `Lv.${L.level} · 경험치 ${L.cur} / ${L.need}`;
    $('#petXp').style.width = (L.cur / L.need * 100) + '%';
    $('#petCoins').textContent = `🍯 꿀 ${p.coins}개`;
    $('#petStats').innerHTML = statBars(p);
    renderCooldowns();
    const bag = S.FOODS.filter((f) => p.food[f.id] > 0);
    $('#bag').innerHTML = bag.length ? bag.map((f) => `
      <div class="item"><div class="ic">${f.icon}</div><div class="nm">${f.name} ×${p.food[f.id]}</div>
      <div class="pr">배부름+${f.hunger}${f.fun ? ' 기분+' + f.fun : ''}${f.energy ? ' 기운+' + f.energy : ''}</div>
      <button class="primary" data-feed="${f.id}">먹이기</button></div>`).join('') : '<div class="empty">가방이 비어 있어요</div>';
    $('#shopFood').innerHTML = S.FOODS.map((f) => `
      <div class="item"><div class="ic">${f.icon}</div><div class="nm">${f.name}</div>
      <div class="pr">배부름+${f.hunger}${f.fun ? ' 기분+' + f.fun : ''}${f.energy ? ' 기운+' + f.energy : ''}</div>
      <button data-buy="${f.id}" ${p.coins < f.price ? 'disabled' : ''}>꿀 ${f.price}</button></div>`).join('');
    $('#shopAcc').innerHTML = S.ACCESSORIES.map((a) => {
      const owned = p.owned.includes(a.id), on = p.equipped === a.id;
      const btn = owned ? `<button class="${on ? '' : 'primary'}" data-equip="${on ? '' : a.id}">${on ? '벗기' : '착용'}</button>`
        : `<button data-buy="${a.id}" ${p.coins < a.price ? 'disabled' : ''}>꿀 ${a.price}</button>`;
      return `<div class="item ${owned ? 'owned' : ''}"><canvas data-acc="${a.id}" width="128" height="168"></canvas><div class="nm">${a.name}</div>${btn}</div>`;
    }).join('');
    $$('#shopAcc canvas').forEach((c) => Render.renderPet(c.getContext('2d'), App.d.character, 'idle', { acc: c.dataset.acc }));
  }
  function renderCooldowns() {
    if (App.tab !== 'pet') return;
    $('#cdFree').textContent = cdText('free'); $('#cdWash').textContent = cdText('wash'); $('#cdPlay').textContent = cdText('play');
  }
  setInterval(renderCooldowns, 5000);

  async function act(type, arg) {
    const r = await api.action(type, arg);
    if (r && r.msg) toast(r.msg); else if (r && r.ok && type === 'buy') toast('구매했어요');
  }
  $('.care').addEventListener('click', (e) => {
    const b = e.target.closest('[data-care]'); if (!b) return;
    const k = b.dataset.care;
    if (k === 'game') return Game.open();
    act(k === 'free' ? 'feed' : k, k === 'free' ? 'free' : undefined);
  });
  $('#pet').addEventListener('click', (e) => {
    const t = e.target;
    if (t.dataset.feed) act('feed', t.dataset.feed);
    if (t.dataset.buy) act('buy', t.dataset.buy);
    if (t.dataset.equip !== undefined) act('equip', t.dataset.equip || null);
  });
  ['pet', 'character', 'tab:pet'].forEach((n) => App.on(n, render));
})();

// ---------- 미니게임: 간식 받기 ----------
const Game = (() => {
  const cv = $('#game'), g = cv.getContext('2d'), W = cv.width, H = cv.height;
  const petC = document.createElement('canvas'); petC.width = 128; petC.height = 168;
  const ITEMS = [['🍙', 1, 30], ['🍓', 1, 25], ['🍪', 1, 25], ['🐟', 2, 14], ['⭐', 5, 4], ['💣', -5, 14]];
  const totalW = ITEMS.reduce((s, i) => s + i[2], 0);
  let st = null, raf = 0;
  function pick() { let r = Math.random() * totalW; for (const it of ITEMS) { if ((r -= it[2]) < 0) return it; } return ITEMS[0]; }
  function open() { $('#gameModal').hidden = false; start(); }
  function close() { cancelAnimationFrame(raf); st = null; $('#gameModal').hidden = true; }
  function start() {
    st = { score: 0, time: 30, items: [], px: W / 2, target: W / 2, last: performance.now(), spawn: 0, pops: [], over: false, dir: 1, t: 0, shake: 0, keys: {} };
    raf = requestAnimationFrame(loop);
  }
  function loop(now) {
    if (!st) return;
    const dt = Math.min(0.05, (now - st.last) / 1000); st.last = now; st.t += dt;
    if (!st.over) {
      st.time -= dt;
      if (st.keys.ArrowLeft) st.target -= 420 * dt; if (st.keys.ArrowRight) st.target += 420 * dt;
      st.target = Math.max(40, Math.min(W - 40, st.target));
      const d = st.target - st.px; if (Math.abs(d) > 1) st.dir = Math.sign(d);
      st.px += d * Math.min(1, dt * 12);
      const diff = 1 + (30 - st.time) / 18;
      st.spawn -= dt;
      if (st.spawn <= 0) { const it = pick(); st.items.push({ x: 20 + Math.random() * (W - 40), y: -20, vy: (110 + Math.random() * 70) * diff, it }); st.spawn = 0.55 / diff; }
      for (const o of st.items) o.y += o.vy * dt;
      const top = H - 100;
      st.items = st.items.filter((o) => {
        if (o.y > top && o.y < H - 20 && Math.abs(o.x - st.px) < 46) {
          st.score = Math.max(0, st.score + o.it[1]);
          st.pops.push({ x: o.x, y: top, txt: (o.it[1] > 0 ? '+' : '') + o.it[1], life: 1, bad: o.it[1] < 0 });
          if (o.it[1] < 0) { st.shake = 0.3; Sound.play('beep', 0.3); } else Sound.play(o.it[1] >= 5 ? 'coin' : 'pop', 0.35);
          return false;
        }
        return o.y < H + 30;
      });
      if (st.time <= 0) end();
    }
    st.pops.forEach((p) => { p.y -= 40 * dt; p.life -= dt; }); st.pops = st.pops.filter((p) => p.life > 0);
    st.shake = Math.max(0, st.shake - dt);
    draw(); raf = requestAnimationFrame(loop);
  }
  async function end() {
    st.over = true;
    const r = await api.action('gameReward', st.score);
    st.result = r && r.ok ? `꿀 +${r.coins} · 경험치 +${r.xp}` : '';
  }
  function draw() {
    g.save();
    if (st.shake) g.translate((Math.random() - 0.5) * 10, 0);
    g.fillStyle = '#dff3ff'; g.fillRect(-10, 0, W + 20, H);
    g.fillStyle = '#ffffff'; [[80, 60], [300, 40], [520, 80]].forEach(([x, y], i) => { const ox = (x + st.t * (8 + i * 4)) % (W + 120) - 60; g.fillRect(ox, y, 70, 18); g.fillRect(ox + 12, y - 10, 40, 12); });
    g.fillStyle = '#8fd17c'; g.fillRect(-10, H - 24, W + 20, 24); g.fillStyle = '#6fb35e'; g.fillRect(-10, H - 24, W + 20, 4);
    g.font = '30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const o of st.items) g.fillText(o.it[0], o.x, o.y);
    const fr = st.over ? 'happy' : App.d.character.rig ? 'walk' : Math.floor(st.t * 8) % 2 ? 'walk1' : 'walk2';
    Render.renderPet(petC.getContext('2d'), App.d.character, fr, { flip: st.dir < 0, acc: App.d.pet.equipped });
    g.imageSmoothingEnabled = false; g.drawImage(petC, st.px - 48, H - 24 - 126 + 4, 96, 126);
    g.font = 'bold 18px sans-serif';
    for (const p of st.pops) { g.globalAlpha = Math.max(0, p.life); g.fillStyle = p.bad ? '#e2504c' : '#2b2b3a'; g.fillText(p.txt, p.x, p.y); }
    g.globalAlpha = 1; g.restore();
    $('#gameHud').textContent = `점수 ${st.score} · 남은 시간 ${Math.max(0, Math.ceil(st.time))}초`;
    if (st.over) {
      g.fillStyle = 'rgba(43,43,58,.55)'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#fff'; g.font = 'bold 34px sans-serif'; g.fillText(`끝! ${st.score}점`, W / 2, H / 2 - 30);
      g.font = '18px sans-serif'; g.fillText(st.result || '보상 받는 중…', W / 2, H / 2 + 10);
      g.fillText('클릭하면 다시 하기', W / 2, H / 2 + 44);
    }
  }
  cv.addEventListener('mousemove', (e) => { if (!st) return; const r = cv.getBoundingClientRect(); st.target = (e.clientX - r.left) / r.width * W; });
  cv.addEventListener('click', () => { if (st && st.over && st.result !== undefined) start(); });
  window.addEventListener('keydown', (e) => { if (st) { st.keys[e.key] = true; if (e.key === 'Escape') close(); } });
  window.addEventListener('keyup', (e) => { if (st) st.keys[e.key] = false; });
  $('#gameClose').onclick = close;
  return { open, close };
})();
