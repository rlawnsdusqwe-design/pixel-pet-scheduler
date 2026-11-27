// 자연어(한국어) 문장 → 일정/할 일 분석 + 빈 시간 자동 배치
(function (root) {
  const S = root.Shared || (typeof require !== 'undefined' ? require('./shared.js') : null);
  const DOWS = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };
  const NUM_KO = { 한: 1, 두: 2, 세: 3, 네: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9, 열: 10, 열한: 11, 열두: 12 };
  const numOf = (s) => (s in NUM_KO ? NUM_KO[s] : Number(s));
  const NUMW = '(\\d{1,2}|열한|열두|한|두|세|네|다섯|여섯|일곱|여덟|아홉|열)';

  const CAT_RULES = [
    ['work', /회의|미팅|보고|업무|출근|퇴근|메일|발표|면접|클라이언트|고객|계약|기획|프로젝트|마감|결재|출장|PT|미팅/i],
    ['study', /공부|과제|시험|강의|수업|독서|읽기|영어|토익|자격증|복습|예습|스터디|논문|레포트|숙제/],
    ['health', /운동|헬스|러닝|달리기|요가|필라테스|산책|수영|병원|약\b|약 먹|치과|스트레칭|자전거|등산/],
    ['personal', /생일|약속|데이트|가족|친구|여행|기념일|결혼|모임|장보기|청소|빨래|쇼핑|은행|택배|이사/],
  ];
  const ALLDAY = /생일|기념일|휴가|연차|여행|공휴일|결혼식|명절/;

  // ---------- 항목 나누기 ----------
  function splitItems(text) {
    const lines = text.replace(/\r/g, '').split(/\n|;|•|·|▪|◦|■|□|☐|✓|✔/);
    const out = [];
    for (let l of lines) {
      l = l.replace(/^\s*(?:[-*–—]|\d{1,2}[.)]|[①-⑳]|\[\s?[xX ]?\s?\])\s*/, '').trim();
      if (!l) continue;
      // 쉼표/그리고 로 이어진 문장은 각각 뜻이 있으면 나눔
      const parts = l.split(/\s*(?:,|，|그리고|그다음|그 다음에?|하고 나서)\s*/).map((p) => p.trim()).filter(Boolean);
      const meaningful = parts.filter((p) => stripMeta(p).length >= 2);
      if (parts.length > 1 && meaningful.length === parts.length) out.push(...parts); else out.push(l);
    }
    return out;
  }

  // ---------- 날짜 ----------
  function nextDow(base, dow, minAdd = 0) {
    const d = new Date(base); d.setDate(d.getDate() + minAdd);
    while (d.getDay() !== dow) d.setDate(d.getDate() + 1);
    return d;
  }
  function weekStart(base) { const d = new Date(base); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return d; } // 월요일 시작

  function parseDate(s, now) {
    const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const add = (n) => { const d = new Date(t0); d.setDate(d.getDate() + n); return d; };
    let m;
    const rules = [
      [/(\d{4})[-./년]\s*(\d{1,2})[-./월]\s*(\d{1,2})일?/, (m) => new Date(+m[1], +m[2] - 1, +m[3])],
      [/(다음\s*달|담달|다음\s*월)\s*(\d{1,2})일/, (m) => new Date(now.getFullYear(), now.getMonth() + 1, +m[2])],
      [/(\d{1,2})\s*월\s*(\d{1,2})\s*일/, (m) => future(new Date(now.getFullYear(), +m[1] - 1, +m[2]), t0, 'year')],
      [/(?<![\d:])(\d{1,2})\s*[./]\s*(\d{1,2})(?![\d:]|\s*(?:시|분))/, (m) => (+m[1] <= 12 && +m[2] <= 31 ? future(new Date(now.getFullYear(), +m[1] - 1, +m[2]), t0, 'year') : null)],
      [/오늘|금일|오늘중/, () => t0],
      [/내일|낼|명일/, () => add(1)],
      [/모레/, () => add(2)],
      [/글피/, () => add(3)],
      [/(\d+|한|두|세|네|다섯)\s*일\s*(후|뒤)/, (m) => add(numOf(m[1]))],
      [/(\d+|한|두|세)\s*주\s*(후|뒤)/, (m) => add(numOf(m[1]) * 7)],
      [/(다다음\s*주|다음\s*주|담주|차주|이번\s*주|금주|이번주)\s*(월|화|수|목|금|토|일)(요일|욜)?/, (m) => {
        const k = /다다음/.test(m[1]) ? 14 : /다음|담주|차주/.test(m[1]) ? 7 : 0;
        const d = weekStart(t0); d.setDate(d.getDate() + k + ((DOWS[m[2]] + 6) % 7)); return d;
      }],
      [/(다음\s*주|담주|차주)(?!\s*(?:월|화|수|목|금|토|일))/, () => { const d = weekStart(t0); d.setDate(d.getDate() + 7); return d; }],
      [/이번\s*주말|주말/, () => nextDow(t0, 6)],
      [/(?:^|[^가-힣])(월|화|수|목|금|토|일)(요일|욜)/, (m) => nextDow(t0, DOWS[m[1]])],
      [/\((월|화|수|목|금|토|일)\)/, (m) => nextDow(t0, DOWS[m[1]])],
      [/(?<![\d월])(\d{1,2})\s*일(?!\s*(?:후|뒤|동안|간|마다))/, (m) => future(new Date(now.getFullYear(), now.getMonth(), +m[1]), t0, 'month')],
      [/다음\s*달|담달/, () => new Date(now.getFullYear(), now.getMonth() + 1, 1)],
    ];
    for (const [re, fn] of rules) if ((m = s.match(re))) { const d = fn(m); if (d && !isNaN(d)) return { date: d, match: m[0] }; }
    return null;
  }
  function future(d, t0, unit) {
    if (d >= t0) return d;
    const n = new Date(d); if (unit === 'year') n.setFullYear(n.getFullYear() + 1); else n.setMonth(n.getMonth() + 1);
    return n;
  }

  // ---------- 시간 ----------
  const PERIOD = '(오전|오후|아침|점심|저녁|밤|새벽|낮|AM|PM|am|pm)';
  function to24(h, period) {
    if (period) {
      if (/오후|저녁|밤|PM|pm|낮/.test(period)) return h < 12 ? h + 12 : h;
      if (/새벽|오전|아침|AM|am/.test(period)) return h === 12 ? 0 : h;
      if (/점심/.test(period)) return h < 6 ? h + 12 : h;
    }
    if (h >= 1 && h <= 7) return h + 12; // "3시" → 오후 3시로 추정
    return h;
  }
  function hmStr(h, m) { return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }
  function parseTime(s) {
    let m;
    // 범위: 3시~5시, 14:00-16:00, 3시부터 5시까지
    const tok = `${PERIOD}?\\s*(?:(\\d{1,2}):(\\d{2})|${NUMW}\\s*시(?!간)\\s*(반|(\\d{1,2})\\s*분)?)`;
    const range = new RegExp(`${tok}\\s*(?:~|-|–|부터|에서)\\s*${tok}\\s*(?:까지)?`);
    if ((m = s.match(range))) {
      const a = tokTime(m.slice(1, 7)), b = tokTime(m.slice(7, 13), a);
      if (a && b) { let dur = (b.h * 60 + b.m) - (a.h * 60 + a.m); if (dur <= 0) dur += 12 * 60; return { time: hmStr(a.h, a.m), dur, match: m[0] }; }
    }
    if ((m = s.match(new RegExp(tok)))) { const a = tokTime(m.slice(1, 7)); if (a) return { time: hmStr(a.h, a.m), match: m[0] }; }
    if ((m = s.match(/정오/))) return { time: '12:00', match: m[0] };
    if ((m = s.match(/자정/))) return { time: '00:00', match: m[0] };
    if ((m = s.match(/(아침|점심|저녁)\s*(에|때|시간)?/))) return { time: { 아침: '08:00', 점심: '12:30', 저녁: '19:00' }[m[1]], match: m[0], soft: true };
    return null;
  }
  function tokTime([period, hh, mm, hw, half, min], prev) {
    let h, mi = 0;
    if (hh !== undefined) { h = +hh; mi = +mm; }
    else if (hw !== undefined) { h = numOf(hw); mi = half === '반' ? 30 : min ? +min : 0; }
    else return null;
    if (h > 24 || mi > 59) return null;
    if (hh !== undefined && !period) return { h, m: mi }; // 14:00 형식은 그대로
    let H = to24(h, period);
    if (!period && prev && H < prev.h) H += 12; // "오후 3시~5시"
    return { h: H % 24, m: mi };
  }

  // ---------- 기타 ----------
  function parseDuration(s) {
    let m;
    if ((m = s.match(new RegExp(`${NUMW}\\s*시간\\s*(반|(\\d{1,2})\\s*분)?\\s*(동안|정도|짜리|간)?`)))) return { dur: numOf(m[1]) * 60 + (m[2] === '반' ? 30 : m[3] ? +m[3] : 0), match: m[0] };
    if ((m = s.match(/(\d{1,3})\s*분\s*(동안|정도|짜리|간)/))) return { dur: +m[1], match: m[0] };
    if ((m = s.match(/(?<!전\s*)(\d{2,3})\s*분(?!\s*전)/))) return { dur: +m[1], match: m[0] };
    return null;
  }
  function parseRepeat(s, now) {
    let m;
    if ((m = s.match(/매일|날마다|하루\s*한\s*번/))) return { repeat: 'daily', match: m[0] };
    if ((m = s.match(/평일(마다|에는|엔)?|주중(마다|에)?|월\s*~\s*금/))) return { repeat: 'weekdays', match: m[0] };
    if ((m = s.match(/매주\s*(월|화|수|목|금|토|일)(요일|욜)?|(월|화|수|목|금|토|일)(요일|욜)마다/))) {
      const d = nextDow(new Date(now.getFullYear(), now.getMonth(), now.getDate()), DOWS[m[1] || m[3]]);
      return { repeat: 'weekly', date: d, match: m[0] };
    }
    if ((m = s.match(/매주/))) return { repeat: 'weekly', match: m[0] };
    if ((m = s.match(/(매달|매월)\s*(\d{1,2})\s*일/))) return { repeat: 'monthly', date: future(new Date(now.getFullYear(), now.getMonth(), +m[2]), new Date(now.getFullYear(), now.getMonth(), now.getDate()), 'month'), match: m[0] };
    return null;
  }
  function parseRemind(s) {
    let m;
    if ((m = s.match(/(\d{1,3})\s*(분|시간)\s*전에?\s*(알림|알려\s*줘|알려줘|알람|리마인드)?/))) return { remind: +m[1] * (m[2] === '시간' ? 60 : 1), match: m[0] };
    return null;
  }
  // 메타 정보를 지운 순수 제목
  function stripMeta(s) {
    return s.replace(/(까지|부터|에는|에|엔|쯤|경|무렵)(?=\s|$)/g, ' ')
      .replace(/\(\s*\)/g, '').replace(/[!！]{2,}|중요|급함|긴급|\[.*?\]/g, ' ')
      .replace(/\s{2,}/g, ' ').replace(/^[\s,.:-]+|[\s,.:-]+$/g, '').trim();
  }
  function cleanTitle(s, matches) {
    let t = s;
    for (const m of matches) if (m) t = t.replace(m, ' ');
    t = t.replace(/(알림|알려\s*줘|알려줘|리마인드)\s*$/, ' ');
    t = t.replace(/^(에|에는|은|는|에서)\s+/, '');
    t = stripMeta(t).replace(/\s+(에|에서|은|는)$/, '').replace(/\s+(하기로|해야\s*함|해야\s*해|해야됨|하자|할\s*것|할것)$/, '');
    return t.trim();
  }

  // ---------- 메인 ----------
  function parseLine(line, now) {
    const deadline = /(까지|마감|데드라인|due)/i.test(line);
    const rep = parseRepeat(line, now);
    let rest = rep ? line.replace(rep.match, ' ') : line;
    const rem = parseRemind(rest); if (rem) rest = rest.replace(rem.match, ' ');
    const tm = parseTime(rest); if (tm) rest = rest.replace(tm.match, ' ');
    const dt = parseDate(rest, now); if (dt) rest = rest.replace(dt.match, ' ');
    const du = !tm || !tm.dur ? parseDuration(rest) : null; if (du) rest = rest.replace(du.match, ' ');
    const title = cleanTitle(rest, []) || line.trim();
    const important = /중요|급함|긴급|!!|！！|ASAP/i.test(line);
    let category = 'etc';
    for (const [c, re] of CAT_RULES) if (re.test(line)) { category = c; break; }
    const date = rep && rep.date ? rep.date : dt ? dt.date : null;
    const item = {
      title, raw: line, category, important,
      date: date ? S.ymd(date) : null, time: tm ? tm.time : null, dur: (tm && tm.dur) || (du && du.dur) || null,
      repeat: rep ? rep.repeat : 'none', remind: rem ? rem.remind : null, deadline: deadline && !tm,
    };
    // 종류 판단
    if (item.time || item.repeat !== 'none') item.kind = 'event';
    else if (item.dur) item.kind = 'auto';                         // 시간 미정 + 걸리는 시간 → 빈 시간에 배치
    else if (item.date && ALLDAY.test(line) && !deadline) item.kind = 'event';
    else item.kind = 'todo';
    if (item.kind === 'todo' && item.deadline && item.date) { item.due = item.date; item.date = null; }
    return item;
  }

  function parse(text, opts = {}) {
    const now = opts.now || new Date();
    return splitItems(text).map((l) => parseLine(l, now)).filter((i) => i.title);
  }

  // 빈 시간 찾기: dayStart~dayEnd 안에서 기존 일정(기본 60분)과 겹치지 않게 30분 단위로
  function autoSchedule(items, events, opts = {}) {
    const now = opts.now || new Date(), dayStart = opts.dayStart || '09:00', dayEnd = opts.dayEnd || '21:00';
    const toMin = (hm) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
    const busy = {}; // date → [[s,e]]
    const addBusy = (ds, s, e) => (busy[ds] = busy[ds] || []).push([s, e]);
    const loadDay = (ds) => {
      if (busy[ds] && busy[ds].loaded) return;
      for (const e of S.eventsOn(events, ds)) if (e.time) addBusy(ds, toMin(e.time), toMin(e.time) + (e.dur || 60));
      for (const it of items) if (it.kind === 'event' && it.time && S.occursOn({ date: it.date || S.ymd(now), repeat: it.repeat }, ds)) addBusy(ds, toMin(it.time), toMin(it.time) + (it.dur || 60));
      (busy[ds] = busy[ds] || []).loaded = true;
    };
    const today = S.ymd(now), nowMin = now.getHours() * 60 + now.getMinutes();
    // 중요한 것, 마감이 빠른 것부터
    const queue = items.filter((i) => i.kind === 'auto').sort((a, b) => (b.important - a.important) || ((a.due || a.date || '9') > (b.due || b.date || '9') ? 1 : -1));
    for (const it of queue) {
      const from = it.date && !it.deadline ? it.date : today;
      const until = it.deadline && it.date ? it.date : it.date || S.addDays(today, 6);
      let placed = false;
      for (let ds = from; ds <= until && !placed; ds = S.addDays(ds, 1)) {
        loadDay(ds);
        let start = toMin(dayStart);
        if (ds === today) start = Math.max(start, Math.ceil((nowMin + 15) / 30) * 30);
        for (let s = start; s + it.dur <= toMin(dayEnd); s += 30) {
          if (busy[ds].some(([a, b]) => s < b && s + it.dur > a)) continue;
          it.date = ds; it.time = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
          addBusy(ds, s, s + it.dur + 10); placed = true; break;
        }
      }
      if (!placed) { it.kind = 'todo'; it.note = '빈 시간이 없어 할 일로 넣었어요'; it.date = from; }
      else it.autoPlaced = true;
    }
    for (const it of items) {
      if (it.kind === 'event' && !it.date) it.date = it.time && it.time < S.hm(now) && it.repeat === 'none' ? S.addDays(today, 1) : today;
      if (it.kind === 'todo' && !it.date) it.date = today;
    }
    return items;
  }

  const api = { parse, autoSchedule, splitItems, parseLine };
  root.SmartParse = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
