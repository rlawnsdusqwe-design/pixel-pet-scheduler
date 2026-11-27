// 캐릭터 고르기 + 도트 편집기 + 그림 → 도트 변환
const Editor = (() => {
  const FRAMES = [['idle', '기본'], ['blink', '눈 깜빡'], ['walk1', '걷기 1'], ['walk2', '걷기 2'], ['happy', '기쁨'], ['sleep', '잠자기'], ['eat', '먹기'], ['surprised', '놀람'], ['sad', '슬픔'], ['wave', '인사']];
  const PALETTE = ['#2b2b3a', '#ffffff', '#fff4e6', '#e8d8c4', '#ffadc4', '#ff5d73', '#ffb347', '#ffe066',
    '#9be15d', '#3fae6a', '#7bc4b2', '#5bc0eb', '#3a6ea5', '#9b5de5', '#c77dff', '#8d5a3b'];
  let ch = null, cur = 'idle', tool = 'pen', color = '#2b2b3a', undo = [];
  const board = $('#board'), bctx = board.getContext('2d');
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // ---------- 갤러리 ----------
  function renderGallery() {
    const mine = App.d.myCharacters || [];
    const cards = [...App.d.builtins.map((c) => ({ c, mine: false })), ...mine.map((c) => ({ c, mine: true }))];
    $('#gallery').innerHTML = cards.map(({ c, mine }, i) => `
      <div class="gcard ${App.d.character.id && App.d.character.id === c.id ? 'cur' : ''}" data-i="${i}">
        ${mine ? '<span class="mine">MY</span><button class="del" data-del="' + c.id + '">✕</button>' : ''}
        <canvas width="128" height="168"></canvas><div class="nm">${esc(c.name)}</div>
        <button class="small" data-apply="${i}">적용</button>
      </div>`).join('');
    galleryCards = cards;
    $$('#gallery canvas').forEach((cv, i) => Render.renderPet(cv.getContext('2d'), cards[i].c, 'idle'));
  }
  let galleryCards = [];
  $('#gallery').addEventListener('click', async (e) => {
    if (e.target.dataset.del) {
      if (!confirm('이 캐릭터를 지울까요?')) return;
      App.d.myCharacters = App.d.myCharacters.filter((c) => c.id !== e.target.dataset.del);
      await api.saveMyChars(App.d.myCharacters); return renderGallery();
    }
    const card = e.target.closest('.gcard'); if (!card) return;
    const c = clone(galleryCards[card.dataset.i].c);
    if (e.target.dataset.apply !== undefined) { await api.saveCharacter(c); toast(`${c.name}(으)로 바꿨어요`); return; }
    load(c); toast(`${c.name} 편집 중`);
  });

  // ---------- 편집기 ----------
  function load(c) {
    if (c.rig) { c = { id: null, name: c.name + ' (편집본)', size: c.size, frames: Render.bakeRig(c, FRAMES.map((f) => f[0])) }; toast('릴리는 움직이는 캐릭터라, 편집하면 일반 캐릭터로 저장돼요'); }
    ch = clone(c); undo = []; cur = 'idle';
    for (const [k] of FRAMES) if (!ch.frames[k]) ch.frames[k] = (ch.frames[k === 'happy' || k === 'sleep' ? 'blink' : 'idle'] || ch.frames.idle).slice();
    $('#charName').value = ch.name || '';
    renderAll();
  }
  $('#frameTabs').innerHTML = FRAMES.map(([k, l]) => `<button data-f="${k}">${l}</button>`).join('');
  $('#frameTabs').addEventListener('click', (e) => { if (e.target.dataset.f) { cur = e.target.dataset.f; renderBoard(); } });
  $('#palette').innerHTML = PALETTE.map((c) => `<div class="sw" data-c="${c}" style="background:${c}"></div>`).join('');
  $('#palette').addEventListener('click', (e) => { if (e.target.dataset.c) setColor(e.target.dataset.c); });
  $('#color').addEventListener('input', (e) => setColor(e.target.value));
  function setColor(c) {
    color = c; $('#color').value = c; $('#colorHex').textContent = c;
    $$('.sw').forEach((s) => s.classList.toggle('on', s.dataset.c === c));
    if (tool === 'eraser' || tool === 'pick') setTool('pen');
  }
  function setTool(t) { tool = t; $$('#toolSeg button').forEach((b) => b.classList.toggle('on', b.dataset.tool === t)); }
  $('#toolSeg').addEventListener('click', (e) => { if (e.target.dataset.tool) setTool(e.target.dataset.tool); });

  function renderBoard() {
    const N0 = ch.size, dpr = window.devicePixelRatio || 1, back = N0 * Math.max(1, Math.round(512 * dpr / N0));
    if (board.width !== back) { board.width = board.height = back; board.style.width = board.style.height = (back / dpr) + 'px'; }
    const N = ch.size, g = ch.frames[cur], k = board.width / N;
    bctx.clearRect(0, 0, board.width, board.height);
    if (cur !== 'idle') { bctx.globalAlpha = 0.18; for (let i = 0; i < N * N; i++) if (ch.frames.idle[i]) { bctx.fillStyle = ch.frames.idle[i]; bctx.fillRect((i % N) * k, ((i / N) | 0) * k, k, k); } bctx.globalAlpha = 1; }
    for (let i = 0; i < N * N; i++) if (g[i]) { bctx.fillStyle = g[i]; bctx.fillRect((i % N) * k, ((i / N) | 0) * k, k, k); }
    bctx.strokeStyle = 'rgba(43,43,58,.08)';
    for (let i = 1; i < N; i++) { bctx.beginPath(); bctx.moveTo(i * k + .5, 0); bctx.lineTo(i * k + .5, board.height); bctx.moveTo(0, i * k + .5); bctx.lineTo(board.width, i * k + .5); bctx.stroke(); }
    $$('#frameTabs button').forEach((b) => b.classList.toggle('on', b.dataset.f === cur));
    $('#resText').textContent = `해상도 ${N}×${N}`;
  }
  function renderAll() { renderBoard(); renderGallery(); }
  function pushUndo() { undo.push({ f: cur, g: ch.frames[cur].slice() }); if (undo.length > 80) undo.shift(); }
  function doUndo() { const u = undo.pop(); if (u) { ch.frames[u.f] = u.g; cur = u.f; renderBoard(); } }
  $('#undoBtn').onclick = doUndo;
  window.addEventListener('keydown', (e) => { if (App.tab === 'character' && (e.ctrlKey || e.metaKey) && e.key === 'z' && !e.target.matches('input')) { e.preventDefault(); doUndo(); } });

  function cellAt(e) {
    const r = board.getBoundingClientRect(), N = ch.size;
    const x = Math.floor((e.clientX - r.left) / r.width * N), y = Math.floor((e.clientY - r.top) / r.height * N);
    return x >= 0 && y >= 0 && x < N && y < N ? y * N + x : -1;
  }
  function flood(g, start, to) {
    const N = ch.size, from = g[start]; if (from === to) return;
    const stack = [start];
    while (stack.length) {
      const i = stack.pop(); if (g[i] !== from) continue; g[i] = to;
      const x = i % N, y = (i / N) | 0;
      if (x > 0) stack.push(i - 1); if (x < N - 1) stack.push(i + 1); if (y > 0) stack.push(i - N); if (y < N - 1) stack.push(i + N);
    }
  }
  let painting = null;
  board.addEventListener('contextmenu', (e) => e.preventDefault());
  board.addEventListener('pointerdown', (e) => {
    const i = cellAt(e); if (i < 0) return;
    const g = ch.frames[cur], t = e.button === 2 ? 'eraser' : (e.button === 1 || e.altKey) ? 'pick' : tool;
    if (t === 'pick') { if (g[i]) setColor(g[i]); return; }
    pushUndo();
    if (t === 'fill') { flood(g, i, color); renderBoard(); return; }
    painting = t === 'eraser' ? '' : color; board.setPointerCapture(e.pointerId);
    g[i] = painting; renderBoard();
  });
  board.addEventListener('pointermove', (e) => { if (painting === null) return; const i = cellAt(e); if (i >= 0 && ch.frames[cur][i] !== painting) { ch.frames[cur][i] = painting; renderBoard(); } });
  board.addEventListener('pointerup', () => { painting = null; });

  $('#copyIdle').onclick = () => { if (cur === 'idle') return; pushUndo(); ch.frames[cur] = ch.frames.idle.slice(); renderBoard(); };
  $('#clearBtn').onclick = () => { pushUndo(); ch.frames[cur] = new Array(ch.size ** 2).fill(''); renderBoard(); };
  $('#flipBtn').onclick = () => {
    pushUndo(); const N = ch.size, g = ch.frames[cur], out = g.slice();
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) out[y * N + x] = g[y * N + (N - 1 - x)];
    ch.frames[cur] = out; renderBoard();
  };
  $('#charName').addEventListener('input', (e) => { ch.name = e.target.value; });
  $('#saveChar').onclick = async () => {
    await api.saveCharacter(clone(ch));
    $('#saveMsg').textContent = '바탕화면에 적용했어요'; setTimeout(() => ($('#saveMsg').textContent = ''), 3000);
  };
  $('#saveMine').onclick = async () => {
    const mine = App.d.myCharacters = App.d.myCharacters || [];
    if (!ch.id || !ch.id.startsWith('my_')) ch.id = 'my_' + S.uid();
    const i = mine.findIndex((c) => c.id === ch.id);
    if (i >= 0) mine[i] = clone(ch); else mine.push(clone(ch));
    await api.saveMyChars(mine); renderGallery(); toast('내 캐릭터에 저장했어요');
  };

  // 미리보기 애니메이션
  const SEQ = ['idle', 'idle', 'idle', 'blink', 'idle', 'walk1', 'walk2', 'walk1', 'walk2', 'happy', 'happy', 'eat', 'idle', 'eat', 'surprised', 'surprised', 'sad', 'sad', 'sleep', 'sleep'];
  petCanvases.push({ canvas: $('#preview'), fit: 128, character: () => ch, frame: (t) => SEQ[Math.floor(t / 3) % SEQ.length], acc: () => ($('#pvAcc').checked ? App.d.pet.equipped : null) });

  // ---------- 그림 → 도트 ----------
  $('#optColors').addEventListener('input', (e) => ($('#colorsN').textContent = e.target.value));
  $('#imgFile').addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const img = new Image();
    img.onload = () => { importImage(img); URL.revokeObjectURL(img.src); e.target.value = ''; };
    img.src = URL.createObjectURL(file);
  });
  const hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  function nearest(cent, p) { let best = 0, bd = Infinity; cent.forEach((c, j) => { const d = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2; if (d < bd) { bd = d; best = j; } }); return best; }

  function pixelate(img, N) {
    const SRC = 384, c = document.createElement('canvas'); c.width = c.height = SRC;
    const x = c.getContext('2d'), s = Math.min(SRC / img.width, SRC / img.height);
    x.drawImage(img, (SRC - img.width * s) / 2, (SRC - img.height * s) / 2, img.width * s, img.height * s);
    const d = x.getImageData(0, 0, SRC, SRC).data;
    if ($('#optBg').checked) { // 가장자리에서 이어진 배경색 제거
      const corner = [0, SRC - 1, SRC * (SRC - 1), SRC * SRC - 1].map((i) => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2], d[i * 4 + 3]]).filter((p) => p[3] > 200);
      if (corner.length) {
        const near = (i) => corner.some((p) => Math.abs(d[i * 4] - p[0]) + Math.abs(d[i * 4 + 1] - p[1]) + Math.abs(d[i * 4 + 2] - p[2]) < 60);
        const seen = new Uint8Array(SRC * SRC), st = [];
        for (let k = 0; k < SRC; k++) st.push(k, SRC * (SRC - 1) + k, k * SRC, k * SRC + SRC - 1);
        while (st.length) {
          const i = st.pop(); if (seen[i]) continue; seen[i] = 1;
          if (d[i * 4 + 3] < 20 || !near(i)) continue;
          d[i * 4 + 3] = 0;
          const px = i % SRC, py = (i / SRC) | 0;
          if (px > 0) st.push(i - 1); if (px < SRC - 1) st.push(i + 1); if (py > 0) st.push(i - SRC); if (py < SRC - 1) st.push(i + SRC);
        }
      }
    }
    let minX = SRC, minY = SRC, maxX = -1, maxY = -1;
    for (let i = 0; i < SRC * SRC; i++) if (d[i * 4 + 3] > 40) { const px = i % SRC, py = (i / SRC) | 0; minX = Math.min(minX, px); maxX = Math.max(maxX, px); minY = Math.min(minY, py); maxY = Math.max(maxY, py); }
    if (maxX < 0) return null;
    const inner = N - 2, side = Math.max(maxX - minX + 1, maxY - minY + 1) / inner; // 원본 px per 도트
    const ox = (minX + maxX + 1) / 2 - (N / 2) * side, oy = maxY + 1 - N * side; // 가운데 정렬 + 바닥에 붙이기
    const cells = [];
    for (let gy = 0; gy < N; gy++) for (let gx = 0; gx < N; gx++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
        const px = Math.floor(ox + (gx + (sx + .5) / 4) * side), py = Math.floor(oy + (gy + (sy + .5) / 4) * side);
        n++; if (px < 0 || py < 0 || px >= SRC || py >= SRC) continue;
        const i = (py * SRC + px) * 4, al = d[i + 3] / 255;
        r += d[i] * al; g += d[i + 1] * al; b += d[i + 2] * al; a += al;
      }
      cells.push(a / n > 0.45 ? [r / a, g / a, b / a] : null);
    }
    const K = Number($('#optColors').value), pts = cells.filter(Boolean);
    let cent = []; for (let i = 0; i < K && i < pts.length; i++) cent.push(pts[Math.floor(i * pts.length / K)].slice());
    for (let it = 0; it < 10; it++) {
      const acc = cent.map(() => [0, 0, 0, 0]);
      for (const p of pts) { const j = nearest(cent, p); acc[j][0] += p[0]; acc[j][1] += p[1]; acc[j][2] += p[2]; acc[j][3]++; }
      cent = cent.map((c0, j) => (acc[j][3] ? [acc[j][0] / acc[j][3], acc[j][1] / acc[j][3], acc[j][2] / acc[j][3]] : c0));
    }
    let grid = cells.map((p) => (p ? hex(...cent[nearest(cent, p)]) : ''));
    if ($('#optOutline').checked) {
      const out = grid.slice();
      for (let i = 0; i < N * N; i++) {
        if (grid[i]) continue; const px = i % N, py = (i / N) | 0;
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ax, ay]) => { const qx = px + ax, qy = py + ay; return qx >= 0 && qy >= 0 && qx < N && qy < N && grid[qy * N + qx]; })) out[i] = '#2b2b3a';
      }
      grid = out;
    }
    return grid;
  }
  function importImage(img) {
    const target = $('#optTarget').value;
    const N = target === 'frame' ? ch.size : Number($('#optRes').value);
    const grid = pixelate(img, N);
    if (!grid) return alert('그림에서 캐릭터를 찾지 못했어요. "단색 배경 지우기"를 끄고 다시 해보세요.');
    if (target === 'frame') { pushUndo(); ch.frames[cur] = grid; toast(`"${FRAMES.find((f) => f[0] === cur)[1]}" 프레임에 넣었어요`); }
    else {
      undo = []; ch.size = N; ch.frames = autoFrames(grid, N); cur = 'idle'; ch.id = null;
      toast('변환했어요. 프레임별로 다듬을 수 있어요');
    }
    renderBoard();
  }
  // 기본 프레임 하나로 나머지 동작 자동 생성
  function autoFrames(idle, N) {
    const lum = (c) => { const v = parseInt(c.slice(1), 16); return ((v >> 16) & 255) * .3 + ((v >> 8) & 255) * .59 + (v & 255) * .11; };
    const rows = []; for (let y = 0; y < N; y++) if (idle.slice(y * N, y * N + N).some(Boolean)) rows.push(y);
    const top = rows[0] ?? 0, bottom = rows[rows.length - 1] ?? N - 1, h = bottom - top + 1;
    // 눈 찾기: 위쪽 20~60% 구간에서 밝은 색으로 둘러싸인 어두운 점
    const eye = new Set();
    for (let y = top + Math.floor(h * 0.2); y < top + Math.floor(h * 0.6); y++) for (let x = 1; x < N - 1; x++) {
      const i = y * N + x, c = idle[i]; if (!c || lum(c) > 80) continue;
      const nb = [idle[i - 1], idle[i + 1], idle[i - N], idle[i + N]].filter((v) => v && lum(v) > 120).length;
      if (nb >= 2) eye.add(i);
    }
    const blink = idle.slice(), happy = idle.slice();
    for (const i of eye) {
      const up = !eye.has(i - N), down = !eye.has(i + N), fillC = idle[i - N] && !eye.has(i - N) ? idle[i - N] : idle[i - 1] || idle[i + 1];
      if (!down) blink[i] = fillC;          // 감은 눈: 맨 아랫줄만 남김
      if (!up) happy[i] = fillC;            // 웃는 눈: 맨 윗줄만 남김
    }
    const legY = bottom - Math.max(1, Math.floor(h * 0.15));
    const legs = (dl) => {
      const g = idle.slice();
      for (let y = legY + 1; y <= bottom; y++) {
        const row = idle.slice(y * N, y * N + N);
        for (let x = 0; x < N; x++) g[y * N + x] = '';
        for (let x = 0; x < N; x++) if (row[x]) { const nx = x + (x < N / 2 ? dl : -dl); if (nx >= 0 && nx < N) g[y * N + nx] = row[x]; }
      }
      return g;
    };
    return { idle, blink, walk1: legs(-1), walk2: legs(1), happy, sleep: blink.slice(), eat: idle.slice(), surprised: idle.slice(), sad: idle.slice() };
  }

  App.on('tab:character', () => { if (!ch) load(App.d.character); else renderAll(); });
  App.on('character', () => { if (App.tab === 'character') renderGallery(); });
  return { load, setColor };
})();
