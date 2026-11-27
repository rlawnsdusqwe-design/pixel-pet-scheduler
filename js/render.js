// 캐릭터를 128x168 캔버스에 그리는 공용 렌더러
// - 일반 캐릭터: 프레임(격자) 방식 (32/64/128칸)
// - 리그 캐릭터(릴리): 부위(머리·몸·팔·다리·꼬리)를 따로 움직이는 애니메이션
(function (root) {
  const CW = 128, CH = 168, HEAD = 40;
  const FALLBACK = {
    blink: ['idle'], happy: ['blink', 'idle'], sleep: ['blink', 'idle'], eat: ['idle'], walk1: ['idle'], walk2: ['idle'],
    surprised: ['idle'], sad: ['idle'], wave: ['happy', 'idle'],
    // 리그용 동작 이름 → 일반 캐릭터는 가까운 프레임으로
    walk: ['walk1'], cheer: ['happy'], wash: ['happy'], play: ['happy'], stroke: ['happy'], proud: ['happy'], gift: ['happy'],
    idea: ['happy'], drag: ['surprised'], fall: ['surprised'], dizzy: ['surprised'], alarm: ['surprised'], focus: ['idle'],
    needy: ['sad'], angry: ['sad'], question: ['idle'], cool: ['happy'],
  };
  function frameOf(ch, name) {
    const f = ch.frames;
    if (f[name]) return f[name];
    for (const alt of FALLBACK[name] || []) { if (f[alt]) return f[alt]; for (const a2 of FALLBACK[alt] || []) if (f[a2]) return f[a2]; }
    return f.idle;
  }
  // ---------- 액세서리 ----------
  const cache = new WeakMap();
  function analyze(ch) {
    const g = ch.frames.idle; if (cache.has(g)) return cache.get(g);
    const N = ch.size, k = CW / N;
    let top = N, bottom = 0;
    for (let i = 0; i < N * N; i++) if (g[i]) { const y = (i / N) | 0; top = Math.min(top, y); bottom = Math.max(bottom, y); }
    if (top > bottom) { top = 0; bottom = N - 1; }
    const h = bottom - top + 1, band = Math.max(2, Math.round(h * 0.3));
    let minX = N, maxX = 0;
    for (let y = top + Math.round(band * 0.3); y < top + band; y++) for (let x = 0; x < N; x++) if (g[y * N + x]) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
    const r = { top: HEAD + top * k, bottom: HEAD + (bottom + 1) * k, h: h * k, cx: ((minX + maxX + 1) / 2) * k, half: ((maxX - minX + 1) / 2) * k };
    cache.set(g, r); return r;
  }
  function drawAcc(ctx, acc, a, cell = CW / 32) {
    const w = acc.rows[0].length * cell, h = acc.rows.length * cell;
    let x, y;
    if (acc.slot === 'top') { x = a.cx - w / 2; y = a.top - h + cell * 2.5; }
    else if (acc.slot === 'side') { x = a.cx + a.half * 0.35; y = a.top + cell; }
    else { x = a.cx - w / 2; y = a.top + a.h * 0.42 - h / 2; }
    x = Math.round(x); y = Math.max(0, Math.round(y));
    acc.rows.forEach((row, ry) => { for (let rx = 0; rx < row.length; rx++) {
      const c = acc.colors[row[rx]]; if (!c) continue; ctx.fillStyle = c; ctx.fillRect(x + rx * cell, y + ry * cell, cell, cell);
    } });
  }
  const findAcc = (id) => id && root.Shared && root.Shared.ACCESSORIES.find((x) => x.id === id);

  // ---------- 리그 ----------
  const rigCache = new WeakMap();
  function layerCanvas(L, pal) {
    const c = document.createElement('canvas'); c.width = L.w; c.height = L.h;
    const x = c.getContext('2d'), img = x.createImageData(L.w, L.h);
    for (let i = 0; i < L.data.length; i++) {
      const ch = L.data[i]; if (ch === '.') continue;
      const hex = pal[ch.charCodeAt(0) - 48], v = parseInt(hex.slice(1), 16);
      img.data[i * 4] = v >> 16; img.data[i * 4 + 1] = (v >> 8) & 255; img.data[i * 4 + 2] = v & 255; img.data[i * 4 + 3] = 255;
    }
    x.putImageData(img, 0, 0); return c;
  }
  function rigAssets(rig) {
    let a = rigCache.get(rig); if (a) return a;
    a = { parts: {}, heads: {}, props: {} };
    for (const k in rig.parts) a.parts[k] = layerCanvas(rig.parts[k], rig.palette);
    for (const k in rig.heads) a.heads[k] = layerCanvas(rig.heads[k], rig.palette);
    for (const k in rig.props) a.props[k] = layerCanvas(rig.props[k], rig.palette);
    rigCache.set(rig, a); return a;
  }
  const S = Math.sin, C = Math.cos, ab = Math.abs;
  // 동작 정의: t(초) → 부위별 자세. rot=라디안(시계방향+), dx/dy=칸
  const ANIMS = {
    idle(t) {
      const br = S(t * 2.2);
      return { body: { dy: br > 0.3 ? -1 : 0 }, head: { dy: br > 0.1 ? -1 : 0, rot: S(t * 0.6) * 0.03 },
        tail: { rot: S(t * 2.6) * 0.16 }, armL: { rot: S(t * 2.2) * 0.03 }, armR: { rot: -S(t * 2.2) * 0.03 },
        expr: (t % 3.7) < 0.14 ? 'closed' : null };
    },
    walk(t) {
      const p = t * 9, l = S(p), b = -ab(S(p)) * 2;
      return { body: { dy: Math.round(b) }, head: { dy: Math.round(b), rot: S(p) * 0.04 },
        legL: { dy: -Math.max(0, l) * 4, dx: C(p) * 1.5 }, legR: { dy: -Math.max(0, -l) * 4, dx: -C(p) * 1.5 },
        armL: { rot: l * 0.22 }, armR: { rot: l * 0.22 }, tail: { rot: S(p * 0.5) * 0.3 } };
    },
    cheer(t) {
      const b = -ab(S(t * 7)) * 3;
      return { body: { dy: b }, head: { dy: b, rot: S(t * 7) * 0.05 }, armL: { rot: 2.45 + S(t * 14) * 0.18, dy: b }, armR: { rot: -2.45 - S(t * 14) * 0.18, dy: b },
        tail: { rot: S(t * 10) * 0.35 }, expr: 'happy' };
    },
    wave(t) {
      return { body: { dy: S(t * 4) > 0.5 ? -1 : 0 }, head: { rot: S(t * 4) * 0.05 }, armR: { rot: -2.3 + S(t * 11) * 0.4 },
        tail: { rot: S(t * 6) * 0.25 }, expr: 'happy' };
    },
    eat(t) {
      const n = ab(S(t * 9));
      return { head: { dy: Math.round(n * 2), rot: 0.03 }, armL: { rot: -0.55, dx: 1, dy: -3 }, armR: { rot: 0.55, dx: -1, dy: -3 },
        tail: { rot: S(t * 4) * 0.2 }, prop: { k: 'honey', x: 64, y: 70 + Math.round(n), front: true }, expr: (t % 1.2) < 0.6 ? 'delight' : 'closed' };
    },
    sleep(t) {
      const br = S(t * 1.3);
      return { body: { dy: br > 0 ? -1 : 0 }, head: { dy: 3, rot: 0.14 + br * 0.02 }, armL: { rot: -0.1 }, armR: { rot: 0.1 }, tail: { rot: 0.1 }, expr: 'sleep' };
    },
    surprised(t) {
      const j = S(t * 40) * 0.6;
      return { body: { dy: -2 }, head: { dy: -3, dx: j }, armL: { rot: 1.5, dy: -2 }, armR: { rot: -1.5, dy: -2 }, tail: { rot: -0.35 }, expr: 'surprised' };
    },
    sad(t) {
      return { head: { dy: 3, rot: -0.06 + S(t * 1.5) * 0.02 }, body: { dy: 1 }, armL: { rot: -0.15 }, armR: { rot: 0.15 }, tail: { rot: 0.25 }, expr: 'cry' };
    },
    needy(t) { return { ...ANIMS.idle(t), head: { dy: 1, rot: S(t * 1.2) * 0.04 }, expr: 'sweat' }; },
    angry(t) { return { body: { dy: S(t * 18) > 0 ? -1 : 0 }, head: { rot: S(t * 18) * 0.03 }, armL: { rot: 0.5 }, armR: { rot: -0.5 }, tail: { rot: -0.4 }, expr: 'angry' }; },
    drag(t) {
      const f = S(t * 16);
      return { head: { rot: f * 0.08 }, armL: { rot: 1.2 + f * 0.7 }, armR: { rot: -1.2 + f * 0.7 }, legL: { rot: f * 0.35, dy: -1 }, legR: { rot: -f * 0.35, dy: -1 },
        tail: { rot: f * 0.5 }, expr: 'surprised' };
    },
    fall(t) { return { armL: { rot: 2.3 }, armR: { rot: -2.3 }, legL: { rot: 0.3 }, legR: { rot: -0.3 }, tail: { rot: -0.6 }, head: { dy: -2 }, expr: 'surprised' }; },
    dizzy(t) { return { head: { rot: S(t * 7) * 0.14, dx: S(t * 7) * 2 }, body: { dx: S(t * 7) }, armL: { rot: -0.2 }, armR: { rot: 0.2 }, expr: 'dizzy' }; },
    focus(t) {
      const r = (t % 4) < 0.12;
      return { head: { dy: 2, rot: S(t * 0.8) * 0.03 }, armL: { rot: -0.75, dx: 3, dy: -4 }, armR: { rot: 0.75, dx: -3, dy: -4 },
        prop: { k: 'book', x: 64, y: 78, front: true, flip: Math.floor(t / 6) % 2 }, tail: { rot: S(t * 1.5) * 0.12 }, expr: r ? 'closed' : null };
    },
    wash(t) {
      const s = S(t * 34);
      return { body: { dx: s * 2 }, head: { dx: s * 3, rot: s * 0.12 }, armL: { rot: s * 0.4 }, armR: { rot: s * 0.4 }, tail: { rot: s * 0.6 }, expr: 'closed' };
    },
    play(t) {
      const b = -ab(S(t * 6)) * 4;
      return { body: { dy: b }, head: { dy: b, rot: S(t * 3) * 0.08 }, armL: { rot: 1.0 + S(t * 6) * 0.5, dy: b }, armR: { rot: -1.0 + S(t * 6) * 0.5, dy: b },
        tail: { rot: S(t * 12) * 0.4 }, prop: { k: 'ball', x: 64 + S(t * 3) * 34, y: 112 - ab(S(t * 6)) * 30, front: true }, expr: 'delight' };
    },
    stroke(t) {
      return { head: { rot: 0.16 + S(t * 3) * 0.04, dx: 2 }, body: { dx: S(t * 3) }, armL: { rot: -0.25 }, armR: { rot: 0.25 }, tail: { rot: S(t * 8) * 0.45 }, expr: 'blush' };
    },
    proud(t) { return { body: { dy: -1 }, head: { dy: -2, rot: -0.05 }, armL: { rot: -0.6, dx: 2 }, armR: { rot: 0.6, dx: -2 }, tail: { rot: S(t * 5) * 0.3 }, expr: 'cool' }; },
    gift(t) {
      const b = -ab(S(t * 5)) * 2;
      return { body: { dy: b }, head: { dy: b }, armL: { rot: 2.6, dx: 4, dy: b }, armR: { rot: -2.6, dx: -4, dy: b }, prop: { k: 'gift', x: 64, y: 22 + b, front: true }, expr: 'idea' };
    },
    idea(t) { return { ...ANIMS.idle(t), armR: { rot: -1.9 + S(t * 8) * 0.1 }, expr: 'idea' }; },
    question(t) { return { ...ANIMS.idle(t), head: { rot: 0.12 }, expr: 'question' }; },
    alarm(t) {
      const b = -ab(S(t * 9)) * 3;
      return { body: { dy: b }, head: { dy: b }, armL: { rot: 2.3 + S(t * 16) * 0.4, dy: b }, armR: { rot: -2.3 - S(t * 16) * 0.4, dy: b }, tail: { rot: S(t * 14) * 0.4 }, expr: (t % 0.8) < 0.4 ? 'surprised' : 'happy' };
    },
  };
  // 예전 프레임 이름 → 리그 동작
  const ALIAS = { walk1: 'walk', walk2: 'walk', happy: 'cheer', blink: 'idle', eat: 'eat', surprised: 'surprised' };
  function drawProp(ctx, k, a, pose) {
    const p = pose.prop;
    if (k === 'honey' && a.props.honey) { const c = a.props.honey; ctx.drawImage(c, Math.round(p.x - c.width / 2), Math.round(HEAD + p.y - c.height / 2)); return; }
    const px = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(p.x + x), Math.round(HEAD + p.y + y), w, h); };
    if (k === 'book') { // 펼친 책
      px(-15, -7, 30, 15, '#21110c'); px(-14, -6, 13, 13, p.flip ? '#f3ead8' : '#fffaf0'); px(1, -6, 13, 13, p.flip ? '#fffaf0' : '#f3ead8');
      for (let i = 0; i < 4; i++) { px(-12, -3 + i * 3, 9, 1, '#b7a98f'); px(3, -3 + i * 3, 9, 1, '#b7a98f'); }
      px(-1, -7, 2, 15, '#7a432e');
    } else if (k === 'ball') {
      for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) { const d = x * x + y * y; if (d > 30) continue; px(x, y, 1, 1, d > 22 ? '#21110c' : y < 0 ? '#e2504c' : y === 0 ? '#21110c' : '#fffaf0'); }
      px(-2, -3, 2, 1, '#ffb0a8');
    } else if (k === 'gift') {
      px(-9, -7, 18, 15, '#21110c'); px(-8, -6, 16, 13, '#4f5bd5'); px(-1, -6, 2, 13, '#ffd84a'); px(-8, -1, 16, 2, '#ffd84a');
      px(-4, -10, 3, 3, '#ffd84a'); px(1, -10, 3, 3, '#ffd84a');
    }
  }
  function renderRig(ctx, ch, anim, opts) {
    const rig = ch.rig, a = rigAssets(rig), t = opts.t != null ? opts.t : performance.now() / 1000;
    const fn = ANIMS[anim] || ANIMS[ALIAS[anim]] || ANIMS.idle;
    const pose = fn(t);
    if (anim === 'blink') pose.expr = 'closed';
    ctx.save();
    if (opts.flip) { ctx.translate(CW, 0); ctx.scale(-1, 1); }
    ctx.translate(0, -(opts.bob || 0));
    ctx.imageSmoothingEnabled = !!opts.smooth;
    const bodyP = pose.body || {};
    const draw = (k, img, extra = {}) => {
      const L = rig.parts[k], q = pose[k] || {}, inherit = k === 'legL' || k === 'legR' || k === 'body' ? {} : bodyP;
      const dx = (q.dx || 0) + (inherit.dx || 0) + (extra.dx || 0), dy = (q.dy || 0) + (inherit.dy || 0) + (extra.dy || 0), rot = q.rot || 0;
      const [px, py] = L.pivot;
      ctx.save();
      ctx.translate(Math.round(px + dx), Math.round(HEAD + py + dy));
      if (rot) ctx.rotate(rot);
      ctx.drawImage(img || a.parts[k], Math.round(L.x - px), Math.round(L.y - py));
      if (extra.after) extra.after();
      ctx.restore();
    };
    draw('tail'); draw('legL'); draw('legR'); draw('body');
    const acc = findAcc(opts.acc);
    draw('head', pose.expr && a.heads[pose.expr] ? a.heads[pose.expr] : null, {
      after: acc ? () => { const L = rig.parts.head; const an = analyze(ch); ctx.translate(-L.pivot[0], -(HEAD + L.pivot[1])); drawAcc(ctx, acc, an); } : null,
    });
    draw('armL'); draw('armR');
    if (pose.prop) drawProp(ctx, pose.prop.k, a, pose); // 소품은 앞발 위에 (손에 든 모습)
    ctx.restore();
  }

  function renderPet(ctx, ch, frameName = 'idle', opts = {}) {
    const px = opts.px || ctx.canvas._px || 1, smooth = opts.smooth != null ? opts.smooth : !!ctx.canvas._smooth;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (opts.clear !== false) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.setTransform(px, 0, 0, px, 0, 0);   // 128x168 논리 좌표를 실제 해상도로
    try { renderBody(ctx, ch, frameName, { ...opts, smooth }); } finally { ctx.restore(); }
  }
  // 캔버스를 화면 배율에 맞춰 선명하게: 원하는 CSS 폭 기준
  function fit(canvas, cssW, size) {
    const dpr = window.devicePixelRatio || 1, key = cssW + '|' + size + '|' + dpr;
    if (canvas._fitKey === key) return; canvas._fitKey = key;
    const d = root.Shared.petDisplay(cssW / 32, size, dpr);
    canvas.width = d.backW; canvas.height = d.backH; canvas._px = d.px; canvas._smooth = d.smooth;
    canvas.style.width = d.cssW + 'px'; canvas.style.height = d.cssH + 'px';
    canvas.style.imageRendering = d.smooth ? 'auto' : 'pixelated';
  }
  function renderBody(ctx, ch, frameName, opts) {
    const { flip = false, bob = 0, acc = null } = opts;
    ctx.imageSmoothingEnabled = !!opts.smooth;
    if (ch.rig) return renderRig(ctx, ch, frameName, opts);
    const N = ch.size, k = CW / N, g = frameOf(ch, frameName);
    ctx.save();
    if (flip) { ctx.translate(CW, 0); ctx.scale(-1, 1); }
    ctx.translate(0, -bob * (CW / 64));
    for (let i = 0; i < N * N; i++) { const c = g[i]; if (!c) continue; ctx.fillStyle = c; ctx.fillRect((i % N) * k, HEAD + ((i / N) | 0) * k, k, k); }
    const A = findAcc(acc);
    if (A) drawAcc(ctx, A, analyze(ch));
    ctx.restore();
  }
  // 리그 캐릭터를 일반 프레임 캐릭터로 굳히기(편집기용)
  function bakeRig(ch, names) {
    const c = document.createElement('canvas'); c.width = CW; c.height = CH; const x = c.getContext('2d');
    const frames = {}, N = CW;
    const T = { walk1: 0.17, walk2: 0.52, cheer: 0.11, wave: 0.14, eat: 0.18 };
    for (const n of names) {
      renderRig(x, ch, n, { t: T[n] != null ? T[n] : 0.3 });
      const d = x.getImageData(0, HEAD, N, N).data, g = new Array(N * N);
      for (let i = 0; i < N * N; i++) g[i] = d[i * 4 + 3] > 127 ? '#' + ((1 << 24) | (d[i * 4] << 16) | (d[i * 4 + 1] << 8) | d[i * 4 + 2]).toString(16).slice(1) : '';
      frames[n] = g; x.clearRect(0, 0, CW, CH);
    }
    return frames;
  }
  function drawGrid(canvas, grid, N) {
    const c = canvas.getContext('2d'); c.clearRect(0, 0, canvas.width, canvas.height);
    const k = canvas.width / N;
    for (let i = 0; i < N * N; i++) if (grid[i]) { c.fillStyle = grid[i]; c.fillRect((i % N) * k, ((i / N) | 0) * k, Math.ceil(k), Math.ceil(k)); }
  }
  root.Render = { CW, CH, HEAD, frameOf, renderPet, drawGrid, bakeRig, ANIMS, fit };
})(window);
