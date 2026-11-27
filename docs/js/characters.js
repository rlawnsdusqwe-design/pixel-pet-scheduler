// 기본 제공 캐릭터 (16x16 도트 → 32x32로 2배 확대)
// 글자 규칙: k=테두리, b=몸, s=그림자, p=볼/포인트, c=보조색, w=흰색, e=눈(2x2), m=입, .=투명
(function (root) {
  const DEFS = [
    { id: 'mochi', name: '모찌 (고양이)', colors: { k: '#2b2b3a', b: '#fff4e6', s: '#e8d8c4', p: '#ff9fb2', e: '#2b2b3a', m: '#2b2b3a' },
      rows: ['................', '..kk........kk..', '.kbbk......kbbk.', '.kbpbk....kbpbk.', '.kbbbbkkkkbbbbk.', 'kbbbbbbbbbbbbbbk',
        'kbbbbbbbbbbbbbbk', 'kbbeebbbbbbeebbk', 'kbbeebbbbbbeebbk', 'kbpbbbbmmbbbbpbk', 'kbbbbbbbbbbbbbbk', '.ksbbbbbbbbbbsk.',
        '.kssbbbbbbbbssk.', '..kssssssssssk..', '...kbk....kbk...', '...kk......kk...'] },
    { id: 'kong', name: '콩이 (강아지)', colors: { k: '#2b2b3a', b: '#f6d9a8', s: '#ddb67e', c: '#a8683a', p: '#ff9fb2', e: '#2b2b3a', m: '#e0566a' },
      rows: ['................', '...kkkkkkkkkk...', '..kbbbbbbbbbbk..', '.kcckbbbbbbkcck.', 'kcckbbbbbbbbkcck', 'kcckbeebbeebkcck',
        'kcckbeebbeebkcck', 'kcckbbbkkbbbkcck', '.kckbbbmmbbbkck.', '..kkbpbbbbpbkk..', '..kbbbbbbbbbbk..', '.kbsbbbbbbbbsbk.',
        '.kbssbbbbbbssbk.', '..kssssssssssk..', '...kbk....kbk...', '...kk......kk...'] },
    { id: 'toto', name: '토토 (토끼)', colors: { k: '#2b2b3a', b: '#ffffff', s: '#e3e3ee', p: '#ffadc4', e: '#d6405e', m: '#2b2b3a' },
      rows: ['...kk......kk...', '..kbbk....kbbk..', '..kbpk....kpbk..', '..kbpk....kpbk..', '..kbbk....kbbk..', '..kbbkkkkkkbbk..',
        '.kbbbbbbbbbbbbk.', 'kbbbeebbbbeebbbk', 'kbbbeebbbbeebbbk', 'kbpbbbbmmbbbbpbk', 'kbbbbbbbbbbbbbbk', '.kbbbbbbbbbbbbk.',
        '.ksbbbbbbbbbbsk.', '..kssssssssssk..', '...kbk....kbk...', '...kk......kk...'] },
    { id: 'dotori', name: '도토리 (햄스터)', colors: { k: '#2b2b3a', c: '#f0a85a', w: '#fff6e8', p: '#ffb0b8', e: '#2b2b3a', m: '#2b2b3a', b: '#f0a85a' },
      rows: ['................', '................', '...kk......kk...', '..kpck....kcpk..', '..kcckkkkkkcck..', '.kcccccccccccck.',
        'kccceecccceeccck', 'kccceecccceeccck', 'kppwwwwmmwwwwppk', 'kcwwwwwwwwwwwwck', 'kcwwwwwwwwwwwwck', '.kcwwwwwwwwwwck.',
        '.kccwwwwwwwwcck.', '..kcccccccccck..', '...kpk....kpk...', '...kk......kk...'] },
    { id: 'piyo', name: '삐약 (병아리)', colors: { k: '#2b2b3a', b: '#ffe066', s: '#f2c63c', c: '#ff9a3c', p: '#ffb0a0', e: '#2b2b3a', m: '#ff9a3c' },
      rows: ['................', '.......kk.......', '......kbbk......', '....kkkbbkkk....', '...kbbbbbbbbk...', '..kbbbbbbbbbbk..',
        '.kbbbeebbeebbbk.', '.kbbbeebbeebbbk.', '.kbpbbbmmbbbpbk.', 'kbbbbbbbbbbbbbbk', 'kbsbbbbbbbbbbsbk', 'kbssbbbbbbbbssbk',
        '.kbbbbbbbbbbbbk.', '..kkbbbbbbbbkk..', '...kcck..kcck...', '...kkkk..kkkk...'] },
    { id: 'gaegul', name: '개굴 (개구리)', colors: { k: '#2b2b3a', b: '#7ccf6a', s: '#5aa84c', w: '#ffffff', p: '#ff9fb2', e: '#2b2b3a', m: '#2b2b3a' },
      rows: ['................', '..kkkk....kkkk..', '.kwwwwk..kwwwwk.', '.kweewkkkkweewk.', '.kweewbbbbweewk.', 'kbbkkbbbbbbkkbbk',
        'kbbbbbbbbbbbbbbk', 'kbpbbbbbbbbbbpbk', 'kbbbmbbbbbbmbbbk', 'kbbbbmmmmmmbbbbk', '.kbbbbbbbbbbbbk.', '.kssbbbbbbbbssk.',
        '..kssbbbbbbssk..', '..kkkssssssskk..', '..kbbk....kbbk..', '..kkkk....kkkk..'] },
  ];

  const H = 16;
  // 발 부분(아래 2줄)을 좌우로 엇갈리게
  function legs(rows, dl, dr) {
    return rows.map((r, y) => {
      if (y < H - 2) return r;
      const out = new Array(H).fill('.');
      for (let x = 0; x < H; x++) if (r[x] !== '.') { const nx = x + (x < H / 2 ? dl : dr); if (nx >= 0 && nx < H) out[nx] = r[x]; }
      return out.join('');
    });
  }
  const isEye = (rows, x, y) => rows[y] && rows[y][x] === 'e';
  function eyes(rows, kind) {
    const g = rows.map((r) => r.split(''));
    for (let y = 0; y < H; y++) for (let x = 0; x < H; x++) {
      if (rows[y][x] !== 'e') continue;
      const topRow = !isEye(rows, x, y - 1);
      const above = rows[y - 1] ? rows[y - 1][x] : 'b', below = rows[y + 1] ? rows[y + 1][x] : 'b';
      if (kind === 'closed' && topRow) g[y][x] = above;            // 위 줄 지움 → 감은 눈 선
      if (kind === 'happy' && !topRow) g[y][x] = isEye(rows, x, y + 1) ? 'b' : below; // 아래 줄 지움 → 웃는 눈
    }
    return g.map((r) => r.join(''));
  }
  const mouth = (rows, ch) => rows.map((r) => r.replace(/m/g, ch));

  function toGrid(rows, colors) {
    const N = 32, g = new Array(N * N).fill('');
    rows.forEach((row, y) => {
      for (let x = 0; x < H; x++) {
        const c = colors[row[x]] || '';
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) g[(y * 2 + dy) * N + x * 2 + dx] = c;
      }
    });
    return g;
  }
  function build(def) {
    const r = def.rows, cl = { ...def.colors, M: '#c2405a' };
    const f = {
      idle: r, blink: eyes(r, 'closed'), walk1: legs(r, -1, 1), walk2: legs(r, 1, -1),
      happy: mouth(eyes(r, 'happy'), 'M'), sleep: eyes(r, 'closed'), eat: mouth(r, 'M'),
    };
    const frames = {};
    for (const k in f) frames[k] = toGrid(f[k], cl);
    return { id: def.id, name: def.name, size: 32, frames };
  }
  // ---------- 벌꿀오소리 (32x32 직접 설계) ----------
  function buildBadger() {
    const N = 32;
    const COL = { k: '#2a1712', b: '#6e3b2b', d: '#55291d', c: '#efcfac', C: '#d9ad84', w: '#fffaf2', e: '#3a1d14', n: '#1a0f0c',
      f: '#fffaf2', t: '#e8707a', x: '#f6e2c8', h: '#b88e72', y: '#f5b83a', Y: '#c98418', q: '#7cc4f0' };
    const inE = (x, y, cx, cy, rx, ry) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
    const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    function make(o) {
      const g = Array.from({ length: N }, () => new Array(N).fill('.'));
      const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < N && y < N) g[y][x] = c; };
      // 도형 하나를 칠하고 가장자리는 테두리색으로
      const part = (test, fill, outline = 'k') => {
        const pts = [];
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (test(x, y)) pts.push([x, y]);
        const has = new Set(pts.map(([x, y]) => y * N + x));
        for (const [x, y] of pts) {
          const edge = D4.some(([dx, dy]) => { const X = x + dx, Y = y + dy; return X < 0 || Y < 0 || X >= N || Y >= N || !has.has(Y * N + X); });
          g[y][x] = edge && outline ? outline : (typeof fill === 'function' ? fill(x, y) : fill);
        }
        return pts;
      };
      const claws = (pts, n = 3) => { // 아랫줄 가운데에 크림색 발톱
        const maxY = Math.max(...pts.map((p) => p[1])), bottom = pts.filter((p) => p[1] === maxY).map((p) => p[0]).sort((a, b) => a - b);
        const mid = bottom[Math.floor(bottom.length / 2)];
        const xs = n === 3 ? [mid - 2, mid, mid + 2] : [mid - 1, mid + 1];
        xs.forEach((x) => { if (bottom.includes(x)) set(x, maxY, 'x'); });
      };
      // 꼬리
      const tail = [[22, 27], [24.5, 27.6], [26.6, 26.6], [28, 24.6], [28.5, 22.5], [28, 20.6], [26.8, 19.6]];
      part((x, y) => tail.some(([cx, cy]) => (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= 3.6), 'b');
      // 몸통
      part((x, y) => inE(x, y, 15.8, 22.8, 8.8, 7.6), (x, y) => (inE(x, y, 17.2, 21.6, 8.8, 7.6) ? 'b' : 'd'));
      // 발
      const [ly, ry] = o.legs || [29.6, 29.6];
      claws(part((x, y) => inE(x, y, 11, ly, 3.3, 2.2), 'b'));
      claws(part((x, y) => inE(x, y, 20.6, ry, 3.3, 2.2), 'b'));
      // 귀
      for (const ex of [7.6, 24.4]) {
        part((x, y) => inE(x, y, ex, 5.6, 3.5, 3.5), 'b');
        part((x, y) => inE(x, y, ex, 5.8, 1.6, 1.6), 'd', null);
      }
      // 머리: 크림색 털모자 + 갈색 얼굴(이마에 V자)
      const face = (x, y) => inE(x, y, 16, 13.8, 7.5, 5.8) || (y >= 7 && y <= 9 && Math.abs(x + 0.5 - 16) <= (y - 6.4) * 1.25);
      part((x, y) => inE(x, y, 16, 11.3, 10.2, 8), (x, y) => (face(x, y) ? 'b' : y > 12 ? 'C' : 'c'));
      // ---- 표정 ----
      const L = [10, 11, 12, 13], R = [18, 19, 20, 21];
      const eyes = o.eyes || 'smug';
      if (eyes === 'smug') { // 반쯤 감긴 시큰둥한 눈, 옆을 흘겨봄
        [9, ...L].forEach((x) => set(x, 10, 'k')); [...R, 22].forEach((x) => set(x, 10, 'k'));
        for (const y of [11, 12]) { L.forEach((x) => set(x, y, x >= 12 ? 'n' : 'w')); R.forEach((x) => set(x, y, x >= 20 ? 'n' : 'w')); }
        set(12, 11, 'e'); set(20, 11, 'e'); // 눈동자 윗부분은 갈색 홍채
        [10, 11, 12].forEach((x) => set(x, 13, 'k')); [19, 20, 21].forEach((x) => set(x, 13, 'k'));
      } else if (eyes === 'closed') {
        [...L, ...R].forEach((x) => set(x, 12, 'k'));
      } else if (eyes === 'sleepy') { // ∪
        [10, 13, 18, 21].forEach((x) => set(x, 11, 'k')); [11, 12, 19, 20].forEach((x) => set(x, 12, 'k'));
      } else if (eyes === 'happy') { // ∧
        [11, 12, 19, 20].forEach((x) => set(x, 11, 'k')); [10, 13, 18, 21].forEach((x) => set(x, 12, 'k'));
      } else if (eyes === 'wide') { // 동그랗게 뜬 눈
        for (let y = 9; y <= 13; y++) for (const xs of [L, R]) xs.forEach((x, i) => {
          const corner = (y === 9 || y === 13) && (i === 0 || i === 3);
          set(x, y, corner ? 'b' : (y === 11 || y === 12) && (i === 1 || i === 2) ? 'n' : 'w');
        });
      } else if (eyes === 'sad') {
        set(12, 9, 'k'); set(13, 9, 'k'); set(10, 10, 'k'); set(11, 10, 'k');
        set(18, 9, 'k'); set(19, 9, 'k'); set(20, 10, 'k'); set(21, 10, 'k');
        for (const xs of [L, R]) xs.forEach((x, i) => { set(x, 11, 'w'); set(x, 12, i === 1 || i === 2 ? 'e' : 'w'); });
        set(10, 13, 'q'); set(10, 14, 'q'); set(21, 13, 'q');
      }
      // 코
      [14, 15, 16, 17].forEach((x) => set(x, 13, 'n')); set(15, 14, 'n'); set(16, 14, 'n');
      // 입
      const mouth = o.mouth || 'smirk';
      if (mouth === 'smirk') { set(13, 15, 'k'); set(18, 15, 'k'); [14, 15, 16, 17].forEach((x) => set(x, 16, 'k')); set(14, 17, 'f'); set(17, 17, 'f'); }
      else if (mouth === 'open') {
        [13, 14, 15, 16, 17, 18].forEach((x) => set(x, 15, 'k'));
        set(13, 16, 'k'); set(14, 16, 'f'); set(15, 16, 't'); set(16, 16, 't'); set(17, 16, 'f'); set(18, 16, 'k');
        set(14, 17, 'k'); set(15, 17, 't'); set(16, 17, 't'); set(17, 17, 'k'); set(15, 18, 'k'); set(16, 18, 'k');
      } else if (mouth === 'frown') { [14, 15, 16, 17].forEach((x) => set(x, 16, 'k')); set(13, 17, 'k'); set(18, 17, 'k'); }
      else if (mouth === 'small') { set(15, 16, 'k'); set(16, 16, 'k'); }
      // 앞발 / 꿀단지
      if (o.hold) {
        part((x, y) => inE(x, y, 16, 22, 3.4, 3.2) || (y === 18 && x >= 14 && x <= 17), (x, y) => (y <= 19 ? 'Y' : 'y'));
        set(15, 21, 'Y'); set(16, 21, 'Y'); set(19, 17, 'y'); // 라벨, 꿀 방울
        claws(part((x, y) => inE(x, y, 12.2, 22, 2.2, 2.4), 'b'), 2);
        claws(part((x, y) => inE(x, y, 19.8, 22, 2.2, 2.4), 'b'), 2);
      } else {
        const [ay, ax] = o.armsUp ? [17.6, 2.2] : [21.4, 0];
        claws(part((x, y) => inE(x, y, 10.2 - ax, ay, 2.4, 2.6), 'b'));
        claws(part((x, y) => inE(x, y, 21.8 + ax, ay, 2.4, 2.6), 'b'));
      }
      // 수염 (테두리 없이)
      for (const [y1, y2] of [[13, 13], [15, 16]]) {
        for (let x = 2; x <= 5; x++) if (g[x < 4 ? y2 : y1][x] === '.') set(x, x < 4 ? y2 : y1, 'h');
        for (let x = 26; x <= 29; x++) if (g[x > 27 ? y2 : y1][x] === '.') set(x, x > 27 ? y2 : y1, 'h');
      }
      const out = new Array(N * N);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) out[y * N + x] = COL[g[y][x]] || '';
      return out;
    }
    return {
      id: 'badger', name: '벌꿀오소리', size: 32,
      frames: {
        idle: make({}), blink: make({ eyes: 'closed' }),
        walk1: make({ legs: [28.7, 29.6] }), walk2: make({ legs: [29.6, 28.7] }),
        happy: make({ eyes: 'happy', mouth: 'open', armsUp: true }), sleep: make({ eyes: 'sleepy', mouth: 'small' }),
        eat: make({ mouth: 'open', hold: true }), surprised: make({ eyes: 'wide', mouth: 'open' }), sad: make({ eyes: 'sad', mouth: 'frown' }),
      },
    };
  }
  const LILY = root.LilyRig || (typeof require !== 'undefined' ? require('./lily.js') : null);
  const mark1 = Object.assign(buildBadger(), { id: 'badger32', name: '벌꿀오소리 릴리 (마크 1)' });
  const list = [...(LILY ? [LILY.build()] : []), mark1, ...DEFS.map(build)];
  const api = { list, DEFS, H };
  root.BuiltinCharacters = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
