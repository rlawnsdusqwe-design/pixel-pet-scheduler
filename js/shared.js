// 메인 프로세스와 화면(렌더러)에서 같이 쓰는 날짜/일정/게임 데이터
(function (root) {
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
  const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // ---------- 일정 ----------
  function occursOn(ev, dateStr) {
    if (dateStr < ev.date) return false;
    if (ev.repeat === 'daily') return true;
    if (ev.repeat === 'weekly') return parseYmd(dateStr).getDay() === parseYmd(ev.date).getDay();
    if (ev.repeat === 'weekdays') { const w = parseYmd(dateStr).getDay(); return w > 0 && w < 6; }
    if (ev.repeat === 'monthly') return parseYmd(dateStr).getDate() === parseYmd(ev.date).getDate();
    return ev.date === dateStr;
  }
  function eventsOn(events, dateStr) {
    return events.filter((e) => occursOn(e, dateStr))
      .map((e) => ({ ...e, occDate: dateStr, isDone: (e.doneDates || []).includes(dateStr) }))
      .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  }
  function upcoming(events, now = new Date(), days = 7, limit = 5) {
    const out = [], nowHM = hm(now);
    for (let i = 0; i < days && out.length < limit; i++) {
      const ds = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + i));
      for (const e of eventsOn(events, ds)) {
        if (e.isDone || (i === 0 && e.time && e.time < nowHM)) continue;
        out.push(e); if (out.length >= limit) break;
      }
    }
    return out;
  }
  const REPEAT_LABEL = { none: '', daily: '매일', weekdays: '평일', weekly: '매주', monthly: '매월' };
  const CATEGORIES = [
    { id: 'work', label: '업무', color: '#5b8def' },
    { id: 'personal', label: '개인', color: '#ff7a90' },
    { id: 'study', label: '공부', color: '#9b5de5' },
    { id: 'health', label: '운동', color: '#3fae6a' },
    { id: 'etc', label: '기타', color: '#f0a030' },
  ];
  const catOf = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[4];

  // ---------- 성장 ----------
  const needFor = (lv) => 40 + lv * 20; // lv → lv+1 에 필요한 경험치
  function levelInfo(xp) {
    let lv = 1, rest = xp;
    while (rest >= needFor(lv)) { rest -= needFor(lv); lv++; }
    return { level: lv, cur: rest, need: needFor(lv) };
  }

  // ---------- 상점 ----------
  const FOODS = [
    { id: 'rice', name: '주먹밥', icon: '🍙', price: 10, hunger: 30, fun: 0, energy: 0 },
    { id: 'milk', name: '우유', icon: '🥛', price: 8, hunger: 15, fun: 0, energy: 12 },
    { id: 'cookie', name: '쿠키', icon: '🍪', price: 12, hunger: 10, fun: 15, energy: 0 },
    { id: 'fish', name: '생선구이', icon: '🐟', price: 20, hunger: 45, fun: 5, energy: 5 },
    { id: 'cake', name: '딸기케이크', icon: '🍰', price: 30, hunger: 20, fun: 35, energy: 5 },
  ];
  // 액세서리 도트 (32칸 기준 1칸 단위). slot: top=머리 위, side=머리 옆, face=눈 높이
  const ACCESSORIES = [
    { id: 'sprout', name: '새싹', price: 30, slot: 'top', colors: { k: '#2b2b3a', g: '#5cc46a', d: '#3a9a4a' },
      rows: ['kk...kk', 'kgk.kgk', 'kggkggk', '.kkdkk.', '..kdk..', '..kdk..'] },
    { id: 'flower', name: '꽃핀', price: 40, slot: 'side', colors: { k: '#2b2b3a', p: '#ff8fb1', y: '#ffd84a' },
      rows: ['..kkk..', '.kpppk.', 'kppyppk', 'kpyyypk', 'kppyppk', '.kpppk.', '..kkk..'] },
    { id: 'ribbon', name: '리본', price: 50, slot: 'side', colors: { k: '#2b2b3a', r: '#ff4f6d', w: '#ff98a9' },
      rows: ['.kk....kk.', 'kwrk..kwrk', 'krrrkkrrrk', 'krrk..krrk', '.kk....kk.'] },
    { id: 'party', name: '파티 모자', price: 70, slot: 'top', colors: { k: '#2b2b3a', b: '#5bc0eb', p: '#ff7a90', y: '#ffd84a' },
      rows: ['....y....', '...yyy...', '...kbk...', '...kpk...', '..kbbbk..', '..kpppk..', '.kbbbbbk.', '.kpppppk.', 'kkkkkkkkk'] },
    { id: 'straw', name: '밀짚모자', price: 90, slot: 'top', colors: { k: '#2b2b3a', s: '#f2d27a', r: '#e2504c' },
      rows: ['....kkkkkk....', '...kssssssk...', '...krrrrrrk...', 'kkksssssssskkk', 'kssssssssssssk', '.kkkkkkkkkkkk.'] },
    { id: 'glasses', name: '선글라스', price: 100, slot: 'face', colors: { k: '#2b2b3a', d: '#3a3a55', w: '#9aa0c8' },
      rows: ['kkkkkkkk......kkkkkkkk', 'kdddwddkkkkkkkkdddwddk', 'kddddddk......kddddddk', '.kkkkkk........kkkkkk.'] },
    { id: 'crown', name: '왕관', price: 200, slot: 'top', colors: { k: '#2b2b3a', y: '#ffcc33', r: '#ff4f6d', b: '#5bc0eb' },
      rows: ['.k...k...k.', 'kyk.kyk.kyk', 'kyykyyykyyk', 'kyryybyyryk', 'kyyyyyyyyyk', 'kkkkkkkkkkk'] },
  ];

  // 펫 상태 문구
  function needsOf(p) {
    const out = [];
    if (p.hunger < 30) out.push({ key: 'hunger', text: '배고파… 밥 줘 🍙', emoji: '🍙' });
    if (p.fun < 30) out.push({ key: 'fun', text: '심심해~ 놀아줘! 🎾', emoji: '💭' });
    if (p.clean < 30) out.push({ key: 'clean', text: '몸이 근질근질해… 🫧', emoji: '💦' });
    if (p.energy < 25) out.push({ key: 'energy', text: '졸려… 💤', emoji: '💤' });
    return out;
  }

  root.Shared = { pad, ymd, hm, parseYmd, addDays, clamp, uid, occursOn, eventsOn, upcoming, REPEAT_LABEL,
    CATEGORIES, catOf, levelInfo, FOODS, ACCESSORIES, needsOf };
  if (typeof module !== 'undefined') module.exports = root.Shared;
})(typeof window !== 'undefined' ? window : globalThis);
