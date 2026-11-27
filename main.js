const { app, BrowserWindow, ipcMain, screen, Notification, Tray, Menu, nativeImage, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const S = require('./shared.js');
const CHARS = require('./characters.js');

// =============== 데이터 ===============
const DATA_FILE = () => path.join(app.getPath('userData'), 'pet-data.json');
const DEFAULT_SETTINGS = {
  scale: 4, speed: 1.5, walking: true, chatter: true, openAtLogin: false, followCursor: false,
  sound: 'chime', volume: 0.6, sleepEnabled: true, sleepStart: '23:30', sleepEnd: '07:00',
  focusMin: 25, breakMin: 5, autoBreak: true, carryOver: true, defaultAlarm: 'strong', dayStart: '09:00', dayEnd: '21:00',
  widgets: { calendar: { on: false, onTop: false, opacity: 1, locked: false }, daily: { on: false, onTop: false, opacity: 1, locked: false } },
};
const DEFAULT_PET = {
  hunger: 80, fun: 80, clean: 90, energy: 90, xp: 0, coins: 50, owned: [], equipped: null,
  food: { rice: 2, cookie: 1 }, lastSeen: Date.now(), lastFreeMeal: 0, lastWash: 0, lastPlay: 0, strokes: [],
};
const WEB = { preload: path.join(__dirname, 'preload.js'), autoplayPolicy: 'no-user-gesture-required' };

function fillFrames(ch) {
  const f = ch.frames;
  f.blink = f.blink || f.idle.slice(); f.walk1 = f.walk1 || f.idle.slice(); f.walk2 = f.walk2 || f.idle.slice();
  f.happy = f.happy || f.blink.slice(); f.sleep = f.sleep || f.blink.slice(); f.eat = f.eat || f.idle.slice();
  return ch;
}
let data;
function loadData() {
  let d = {};
  try { d = JSON.parse(fs.readFileSync(DATA_FILE(), 'utf8')); } catch {}
  const pet = { ...DEFAULT_PET, ...(d.pet || {}) };
  pet.food = { ...(d.pet ? {} : DEFAULT_PET.food), ...(pet.food || {}) };
  // 릴리(최신)·예전 오소리 버전은 모두 최신 릴리로. 마크 1(badger32)은 그대로
  const upgrade = !d.character || d.character.ref || ['badger', 'lily'].includes(d.character.id);
  if (d.character && d.character.id === 'badger32') d.character.name = '벌꿀오소리 릴리 (마크 1)';
  const settings = { ...DEFAULT_SETTINGS, ...(d.settings || {}) };
  settings.widgets = { calendar: { ...DEFAULT_SETTINGS.widgets.calendar, ...((d.settings || {}).widgets || {}).calendar }, daily: { ...DEFAULT_SETTINGS.widgets.daily, ...((d.settings || {}).widgets || {}).daily } };
  if (upgrade && settings.scale < 4) settings.scale = 4; // 고해상도 오소리로 바뀔 때 한 번만 크기 조정
  return {
    events: d.events || [], todos: d.todos || [],
    character: fillFrames(upgrade ? JSON.parse(JSON.stringify(CHARS.list[0])) : d.character),
    myCharacters: d.myCharacters || [],
    settings,
    pet, focusLog: d.focusLog || {}, snoozes: d.snoozes || [],
  };
}
let saveTimer = null;
const serialize = () => JSON.stringify({ ...data, character: data.character.rig ? { id: data.character.id, ref: true } : data.character });
function saveData() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { fs.writeFileSync(DATA_FILE(), serialize()); } catch (e) { console.error(e); } }, 300);
}

// =============== 창 ===============
let pet = null, panel = null, alarmWin = null, tray = null, gameWin = null;
const widgetWins = {};
function petSize() {
  const dpr = pet && !pet.isDestroyed() ? screen.getDisplayMatching(pet.getBounds()).scaleFactor : screen.getPrimaryDisplay().scaleFactor;
  const d = S.petDisplay(data.settings.scale, data.character.size, dpr), cssW = Math.ceil(d.cssW), cssH = Math.ceil(d.cssH);
  return { w: Math.max(260, cssW + 60), h: cssH + 140, cssW, cssH };
}
const st = { x: 0, y: 0, vy: 0, dir: 1, mode: 'idle', timer: 60, jumpT: 0, sent: '', targetX: null, wokeUntil: 0, alarmActive: false };

function createPet() {
  const { w, h } = petSize(), wa = screen.getPrimaryDisplay().workArea;
  st.x = wa.x + Math.round(wa.width * 0.7); st.y = wa.y + wa.height - h;
  pet = new BrowserWindow({
    width: w, height: h, x: st.x, y: st.y, transparent: true, frame: false, resizable: false, hasShadow: false,
    alwaysOnTop: true, skipTaskbar: true, backgroundColor: '#00000000', webPreferences: WEB,
  });
  pet.setAlwaysOnTop(true, 'screen-saver');
  pet.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  pet.setIgnoreMouseEvents(true, { forward: true });
  pet.loadFile('pet.html');
  pet.on('closed', () => { pet = null; });
}
function openPanel(tab = 'today') {
  if (panel) { if (panel.isMinimized()) panel.restore(); panel.show(); panel.focus(); panel.webContents.send('panel:tab', tab); return; }
  panel = new BrowserWindow({
    width: 1200, height: 800, minWidth: 980, minHeight: 640, title: 'Pixel Pet Scheduler',
    autoHideMenuBar: true, backgroundColor: nativeTheme.shouldUseDarkColors ? '#0f1115' : '#f5f6f8', webPreferences: WEB,
  });
  panel.loadFile('panel.html', { query: { tab } });
  panel.on('closed', () => { panel = null; });
}
// =============== 바탕화면 위젯 ===============
const WIDGET_SIZE = { calendar: { width: 420, height: 470 }, daily: { width: 340, height: 560 } };
function widgetCfg(kind) { return data.settings.widgets[kind]; }
function openWidget(kind) {
  if (widgetWins[kind]) return;
  const c = widgetCfg(kind), wa = screen.getPrimaryDisplay().workArea, sz = WIDGET_SIZE[kind];
  const b = c.bounds || { width: sz.width, height: sz.height, x: wa.x + wa.width - sz.width - 24 - (kind === 'calendar' ? sz.width + 16 : 0), y: wa.y + 24 };
  const w = new BrowserWindow({
    ...b, minWidth: 260, minHeight: 300, frame: false, resizable: true, skipTaskbar: true, minimizable: false, maximizable: false, fullscreenable: false,
    alwaysOnTop: !!c.onTop, backgroundColor: nativeTheme.shouldUseDarkColors ? '#171a20' : '#ffffff', title: kind === 'calendar' ? '달력 위젯' : '데일리 위젯', webPreferences: WEB,
  });
  w.setOpacity(c.opacity || 1);
  w.loadFile('widget.html', { query: { kind } });
  let t = null;
  const saveBounds = () => { clearTimeout(t); t = setTimeout(() => { if (!w.isDestroyed()) { widgetCfg(kind).bounds = w.getBounds(); saveData(); } }, 400); };
  w.on('moved', saveBounds); w.on('resized', saveBounds);
  w.webContents.once('did-finish-load', () => applyWidget(kind));
  w.on('closed', () => { delete widgetWins[kind]; });
  widgetWins[kind] = w;
}
function applyWidget(kind) {
  const w = widgetWins[kind], c = widgetCfg(kind); if (!w) return;
  w.setAlwaysOnTop(!!c.onTop, 'floating'); w.setOpacity(c.opacity || 1);
  w.setIgnoreMouseEvents(!!c.locked, { forward: true });
  w.webContents.send('widget:cfg', { kind, cfg: c });
}
function toggleWidget(kind, force) {
  const on = force != null ? force : !widgetWins[kind];
  widgetCfg(kind).on = on; saveData();
  if (on) openWidget(kind); else if (widgetWins[kind]) widgetWins[kind].close();
  setTimeout(() => { broadcast('widgets:changed', widgetState()); refreshTray(); }, 60);
  return widgetState();
}
const widgetState = () => ({ calendar: !!widgetWins.calendar || widgetCfg('calendar').on, daily: !!widgetWins.daily || widgetCfg('daily').on });

// =============== 바탕화면 미니게임 ===============
function openGame() {
  if (gameWin) { gameWin.focus(); return; }
  const wa = screen.getPrimaryDisplay().workArea;
  gameWin = new BrowserWindow({ x: wa.x, y: wa.y, width: wa.width, height: wa.height, frame: false, transparent: true, resizable: false, hasShadow: false,
    alwaysOnTop: true, skipTaskbar: true, backgroundColor: '#00000000', webPreferences: WEB });
  gameWin.setAlwaysOnTop(true, 'screen-saver');
  gameWin.loadFile('game.html');
  if (pet) pet.hide();
  gameWin.on('closed', () => { gameWin = null; if (pet) pet.show(); say('재밌었다! 또 하자 🎮', 3000); });
}

function resizePet() {
  if (!pet) return;
  const { w, h } = petSize();
  const wa = screen.getDisplayNearestPoint({ x: Math.round(st.x), y: Math.round(st.y) }).workArea;
  st.y = wa.y + wa.height - h;
  pet.setBounds({ x: Math.round(st.x), y: Math.round(st.y), width: w, height: h });
}
function broadcast(ch, payload) {
  for (const win of [pet, panel, alarmWin, gameWin, ...Object.values(widgetWins)]) if (win && !win.isDestroyed()) win.webContents.send(ch, payload);
}
const toPet = (ch, p) => { if (pet && !pet.isDestroyed()) pet.webContents.send(ch, p); };
const say = (text, ms = 5000) => toPet('pet:bubble', { text, ms });
const emote = (emoji, count = 3) => toPet('pet:emote', { emoji, count });
const act = (anim, ms = 2000) => toPet('pet:act', { anim, ms }); // 리그 캐릭터 전용 모션
const playSound = (type) => toPet('pet:sound', { type: type || data.settings.sound, volume: data.settings.volume });
function notify(title, body) { try { if (Notification.isSupported()) new Notification({ title, body, silent: true }).show(); } catch {} }
const busy = () => ['drag', 'fall', 'goto', 'alert'].includes(st.mode);

// =============== 움직임 ===============
function isNight() {
  if (!data.settings.sleepEnabled) return false;
  const t = S.hm(new Date()), a = data.settings.sleepStart, b = data.settings.sleepEnd;
  return a > b ? (t >= a || t < b) : (t >= a && t < b);
}
const shouldSleep = () => focus.state !== 'focus' && Date.now() > st.wokeUntil && (isNight() || data.pet.energy < 12);

function pickNext() {
  if (focus.state === 'focus') { st.mode = 'focus'; return; }
  if (shouldSleep()) { st.mode = 'sleep'; say('졸려… 잘 자 💤', 2500); return; }
  const r = Math.random();
  if (!data.settings.walking) { st.mode = 'idle'; st.timer = 90; return; }
  if (r < 0.55) { st.mode = 'walk'; st.timer = 60 + Math.random() * 200; if (Math.random() < 0.4) st.dir *= -1; }
  else if (r < 0.92) { st.mode = 'idle'; st.timer = 60 + Math.random() * 150; }
  else { st.mode = 'hop'; st.jumpT = 0; }
}
function jump(mode = 'hop') { if (!busy() || mode === 'alert') { st.mode = mode; st.jumpT = 0; } }

function tick() {
  if (!pet || pet.isDestroyed()) return;
  const { w, h } = petSize();
  const wa = screen.getDisplayNearestPoint({ x: Math.round(st.x + w / 2), y: Math.round(st.y + h / 2) }).workArea;
  const floor = wa.y + wa.height - h, minX = wa.x - w * 0.2, maxX = wa.x + wa.width - w * 0.8;
  const speed = data.settings.speed;

  switch (st.mode) {
    case 'drag': break;
    case 'fall':
      st.vy += 1.4; st.y += st.vy;
      if (st.y >= floor) { st.y = floor; st.vy = 0; st.mode = 'idle'; st.timer = 45; say('으앗! 착지!', 1500); act('dizzy', 1400); }
      break;
    case 'hop': case 'alert': case 'happy': {
      st.jumpT++;
      const period = st.mode === 'alert' ? 16 : 20, height = st.mode === 'alert' ? 34 : st.mode === 'happy' ? 14 : 22;
      st.y = floor - Math.abs(Math.sin((st.jumpT / period) * Math.PI)) * height;
      const limit = st.mode === 'alert' ? (st.alarmActive ? Infinity : period * 8) : st.mode === 'happy' ? period * 3 : period;
      if (st.jumpT >= limit) { st.y = floor; pickNext(); }
      break;
    }
    case 'goto': {
      st.y = floor; const d = st.targetX - st.x;
      if (Math.abs(d) < 6) { jump('alert'); break; }
      st.dir = Math.sign(d); st.x += st.dir * Math.max(4, speed * 3);
      break;
    }
    case 'eat':
      st.y = floor; if (--st.timer <= 0) jump('happy');
      break;
    case 'sleep':
      st.y = floor;
      if (!shouldSleep()) { st.mode = 'idle'; st.timer = 60; say('잘 잤다~ 🌞', 3000); }
      break;
    case 'focus':
      st.y = floor; if (focus.state !== 'focus') pickNext();
      break;
    default: {
      st.y = floor;
      if (focus.state === 'focus' || shouldSleep()) { pickNext(); break; }
      if (data.settings.followCursor) {
        const c = screen.getCursorScreenPoint(), tx = Math.max(minX, Math.min(maxX, c.x - w / 2)), d = tx - st.x;
        if (Math.abs(d) > 40) { st.mode = 'walk'; st.dir = Math.sign(d); st.x += st.dir * Math.max(2, speed * 1.8); }
        else if (st.mode === 'walk') { st.mode = 'idle'; }
        break;
      }
      if (st.mode === 'walk') {
        st.x += st.dir * speed;
        if (st.x < minX) { st.x = minX; st.dir = 1; }
        if (st.x > maxX) { st.x = maxX; st.dir = -1; }
      }
      if (--st.timer <= 0) pickNext();
    }
  }
  if (st.mode !== 'drag') pet.setPosition(Math.round(st.x), Math.round(st.y));
  const sig = st.mode + st.dir;
  if (sig !== st.sent) { st.sent = sig; toPet('pet:state', { mode: st.mode, dir: st.dir }); }
}

// =============== 펫 상태 / 보상 ===============
function decay(minutes, rate = 1) {
  const p = data.pet, sleeping = st.mode === 'sleep';
  p.hunger = S.clamp(p.hunger - 0.3 * minutes * rate);
  p.fun = S.clamp(p.fun - (sleeping ? 0.08 : 0.35) * minutes * rate);
  p.clean = S.clamp(p.clean - 0.12 * minutes * rate);
  p.energy = S.clamp(p.energy + (sleeping ? 1.2 : -0.2) * minutes * rate);
}
function pushPet() { saveData(); broadcast('pet:data', data.pet); }
function grant(xp, coins) {
  const before = S.levelInfo(data.pet.xp).level;
  data.pet.xp += xp; data.pet.coins += coins;
  const after = S.levelInfo(data.pet.xp).level;
  if (after > before) {
    const bonus = after * 10; data.pet.coins += bonus;
    setTimeout(() => { say(`🎉 레벨 업! Lv.${after}\n보너스 꿀 ${bonus}개! 🍯`, 6000); emote('🎉', 6); jump('hop'); act('proud', 3500); playSound('melody'); }, 1500);
  }
  pushPet();
}
const COOLDOWN = { free: 60, wash: 20, play: 5 }; // 분
function cooldownLeft(key, last) { return Math.max(0, last + COOLDOWN[key] * 60000 - Date.now()); }

function petAction(type, arg) {
  const p = data.pet, now = Date.now();
  const fail = (msg) => { say(msg, 2500); return { ok: false, msg }; };
  if (st.mode === 'sleep' && !['wake', 'buy', 'equip', 'gameReward'].includes(type)) { st.wokeUntil = now + 10 * 60000; st.mode = 'idle'; st.timer = 60; }
  switch (type) {
    case 'feed': {
      let food;
      if (arg === 'free') {
        const left = cooldownLeft('free', p.lastFreeMeal);
        if (left) return fail(`기본 밥은 ${Math.ceil(left / 60000)}분 뒤에 또 먹을 수 있어`);
        if (p.hunger >= 95) return fail('배불러~ 이따 먹을래');
        p.lastFreeMeal = now; food = { icon: '🥣', hunger: 25, fun: 0, energy: 0 };
      } else {
        food = S.FOODS.find((f) => f.id === arg);
        if (!food || !(p.food[arg] > 0)) return fail('그 음식은 없어…');
        if (p.hunger >= 95) return fail('배불러~ 이따 먹을래');
        p.food[arg]--;
      }
      p.hunger = S.clamp(p.hunger + food.hunger); p.fun = S.clamp(p.fun + food.fun); p.energy = S.clamp(p.energy + food.energy);
      st.mode = 'eat'; st.timer = 70; emote(food.icon, 1); setTimeout(() => emote('💕', 3), 2300);
      say(['냠냠! 맛있다 😋', '와 최고야!', '얌얌… 행복해'][Math.floor(Math.random() * 3)], 3000);
      grant(2, 0); return { ok: true };
    }
    case 'wash': {
      const left = cooldownLeft('wash', p.lastWash);
      if (left) return fail(`방금 씻었어! ${Math.ceil(left / 60000)}분 뒤에~`);
      p.lastWash = now; p.clean = 100; p.fun = S.clamp(p.fun + 5);
      emote('🫧', 8); act('wash', 2400); say('뽀득뽀득 개운해! ✨', 3000); grant(2, 0); return { ok: true };
    }
    case 'play': {
      const left = cooldownLeft('play', p.lastPlay);
      if (left) return fail('조금만 쉬었다 놀자! 헥헥');
      if (p.energy < 15) return fail('너무 졸려서 못 놀겠어… 💤');
      p.lastPlay = now; p.fun = S.clamp(p.fun + 20); p.energy = S.clamp(p.energy - 8); p.hunger = S.clamp(p.hunger - 5);
      emote('🎵', 4); act('play', 3200);
      say('신난다~! 🎾', 3000); grant(3, 1); return { ok: true };
    }
    case 'stroke': {
      p.strokes = (p.strokes || []).filter((t) => now - t < 60000);
      emote('❤️', 3); act('stroke', 2400);
      if (p.strokes.length < 4) { p.strokes.push(now); p.fun = S.clamp(p.fun + 4); }
      say(['헤헤 간지러워~', '기분 좋아 ❤️', '더 쓰다듬어줘!', '골골골…'][Math.floor(Math.random() * 4)], 2000);
      pushPet(); return { ok: true };
    }
    case 'wake':
      st.wokeUntil = now + 10 * 60000; st.mode = 'idle'; st.timer = 60; say('으음… 깼어 🥱', 2500); act('dizzy', 1500); return { ok: true };
    case 'gift': {
      if (!gift) return { ok: false };
      gift = null; toPet('pet:gift', false);
      const c = 5 + Math.floor(Math.random() * 16);
      emote('🍯', 4); playSound('coin'); say(`선물 상자에서 꿀 ${c}개 발견! 개꿀 🍯`, 3500); act('gift', 2600);
      grant(3, c); return { ok: true, coins: c };
    }
    case 'buy': {
      const f = S.FOODS.find((x) => x.id === arg), a = S.ACCESSORIES.find((x) => x.id === arg), item = f || a;
      if (!item) return { ok: false, msg: '없는 상품' };
      if (a && p.owned.includes(a.id)) return { ok: false, msg: '이미 가지고 있어요' };
      if (p.coins < item.price) return { ok: false, msg: '꿀이 부족해요' };
      p.coins -= item.price;
      if (f) p.food[f.id] = (p.food[f.id] || 0) + 1; else { p.owned.push(a.id); p.equipped = a.id; say(`${a.name} 어때? 잘 어울려? ✨`, 3500); jump('happy'); }
      pushPet(); return { ok: true };
    }
    case 'equip':
      p.equipped = arg && p.owned.includes(arg) ? arg : null; pushPet();
      if (arg) { say('새 아이템 장착! 😎', 2500); act('proud', 2500); }
      return { ok: true };
    case 'gameReward': {
      const score = Math.max(0, Number(arg) || 0), coins = Math.min(40, Math.floor(score / 3)), xp = Math.min(30, score);
      p.fun = S.clamp(p.fun + 15); p.energy = S.clamp(p.energy - 6);
      say(`게임 재밌었다! 꿀 +${coins} 🍯`, 3500); jump('hop'); grant(xp, coins);
      return { ok: true, coins, xp };
    }
  }
  return { ok: false };
}

// 선물 이벤트
let gift = null;
function maybeGift() {
  if (gift && Date.now() > gift.until) { gift = null; toPet('pet:gift', false); }
  if (gift || st.mode === 'sleep' || focus.state === 'focus' || Math.random() > 1 / 35) return;
  gift = { until: Date.now() + 3 * 60000 };
  toPet('pet:gift', true); say('어? 뭔가 찾았어! 나 눌러봐 🎁', 6000); act('question', 2500);
}

// =============== 할 일 ===============
function carryOverTodos() {
  if (!data.settings.carryOver) return 0;
  const today = S.ymd(new Date()); let n = 0;
  for (const t of data.todos) if (!t.done && t.date < today) { t.date = today; t.carried = true; n++; }
  if (n) { saveData(); broadcast('data:todos', data.todos); }
  return n;
}
let lastDay = null;
function dayCheck() {
  const today = S.ymd(new Date());
  if (today === lastDay) return; lastDay = today;
  const n = carryOverTodos();
  const cnt = data.todos.filter((t) => t.date === today && !t.done).length;
  setTimeout(() => say(n ? `어제 못 한 일 ${n}개를 오늘로 옮겨놨어!\n오늘 할 일은 ${cnt}개야 💪` : cnt ? `오늘 할 일 ${cnt}개! 같이 해보자 💪` : '좋은 하루! 클릭하면 일정을 알려줄게', 6000), 2500);
}

// =============== 알람 ===============
const alarmQueue = [];
function strongAlarm(a) {
  alarmQueue.push(a);
  notify(`⏰ ${a.title}`, a.time ? `${a.time} 일정이에요` : '알람');
  if (alarmWin) { alarmWin.webContents.send('alarm:update', alarmPayload()); return; }
  const wa = screen.getPrimaryDisplay().workArea, W = 380, H = 400;
  alarmWin = new BrowserWindow({
    width: W, height: H, x: Math.round(wa.x + (wa.width - W) / 2), y: Math.round(wa.y + (wa.height - H) / 2 - 60),
    frame: false, resizable: false, alwaysOnTop: true, transparent: true, backgroundColor: '#00000000', hasShadow: false, webPreferences: WEB,
  });
  alarmWin.setAlwaysOnTop(true, 'screen-saver');
  alarmWin.loadFile('alarm.html');
  alarmWin.on('closed', () => { alarmWin = null; });
  // 캐릭터가 화면 가운데로 달려와서 방방 뛴다
  st.alarmActive = true;
  if (st.mode !== 'drag') { const { w } = petSize(); st.targetX = wa.x + (wa.width - w) / 2; st.mode = 'goto'; }
  say(`⏰ ${a.title}!!`, 15000);
}
function alarmPayload() { return { alarm: alarmQueue[0], more: alarmQueue.length - 1 }; }
function nextAlarm() {
  if (alarmQueue.length && alarmWin) { alarmWin.webContents.send('alarm:update', alarmPayload()); return; }
  if (alarmWin) alarmWin.close();
  st.alarmActive = false; if (st.mode === 'alert' || st.mode === 'goto') { st.mode = 'idle'; st.timer = 60; }
}
function lightAlarm(title, body) { notify(title, body); say(`🔔 ${title}`, 10000); playSound(); jump('alert'); }

function checkReminders() {
  const now = new Date(), today = S.ymd(now);
  let changed = false;
  for (const e of S.eventsOn(data.events, today)) {
    if (!e.time || e.isDone) continue;
    const [hh, mm] = e.time.split(':').map(Number);
    const due = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm).getTime();
    const key = `${today} ${e.time}`, ev = data.events.find((x) => x.id === e.id), remind = Number(e.remind || 0) * 60000;
    if (remind > 0 && now >= due - remind && now < due && ev.lastReminded !== key) {
      ev.lastReminded = key; changed = true;
      lightAlarm(`${e.remind >= 60 ? e.remind / 60 + '시간' : e.remind + '분'} 뒤: ${e.title}`, `${e.time} 일정이 곧 시작돼요`);
    }
    if (now >= due && now - due < 10 * 60000 && ev.lastNotified !== key) {
      ev.lastNotified = key; changed = true;
      if ((e.alarm || data.settings.defaultAlarm) === 'strong') strongAlarm({ title: e.title, time: e.time, category: e.category });
      else lightAlarm(`지금: ${e.title}`, `${e.time} 일정 시간이에요!`);
    }
  }
  const due = data.snoozes.filter((s) => Date.now() >= s.at);
  if (due.length) { data.snoozes = data.snoozes.filter((s) => Date.now() < s.at); changed = true; due.forEach((s) => strongAlarm({ title: s.title, time: s.time, category: s.category, snoozed: true })); }
  if (changed) { saveData(); broadcast('data:events', data.events); }
}

// =============== 뽀모도로 ===============
const focus = { state: 'idle', endsAt: 0, total: 0, paused: false, left: 0 };
function focusPublic() {
  return { ...focus, now: Date.now(), todayCount: data.focusLog[S.ymd(new Date())] || 0, focusMin: data.settings.focusMin, breakMin: data.settings.breakMin };
}
function focusCmd(cmd) {
  const now = Date.now();
  if (cmd === 'focus' || cmd === 'break') {
    const min = cmd === 'break' ? data.settings.breakMin : data.settings.focusMin;
    Object.assign(focus, { state: cmd, endsAt: now + min * 60000, total: min * 60000, paused: false, left: 0 });
    if (cmd === 'focus') { st.wokeUntil = now + 2 * 3600000; if (!busy()) st.mode = 'focus'; say(`${min}분 집중 시작! 나도 옆에서 같이 할게 📖`, 4000); }
    else say(`${min}분 쉬는 시간~ 기지개 쭉! 🙆`, 4000);
  } else if (cmd === 'pause' && focus.state !== 'idle' && !focus.paused) { focus.paused = true; focus.left = focus.endsAt - now; }
  else if (cmd === 'resume' && focus.paused) { focus.paused = false; focus.endsAt = now + focus.left; }
  else if (cmd === 'stop') { focus.state = 'idle'; focus.paused = false; if (st.mode === 'focus') pickNext(); say('타이머를 멈췄어', 2000); }
  broadcast('focus:update', focusPublic()); refreshTray();
  return focusPublic();
}
function focusTick() {
  if (focus.state === 'idle' || focus.paused || Date.now() < focus.endsAt) return;
  if (focus.state === 'focus') {
    const d = S.ymd(new Date()); data.focusLog[d] = (data.focusLog[d] || 0) + 1;
    focus.state = 'idle'; st.mode = 'idle'; grant(25, 10);
    playSound('melody'); notify('집중 완료! 🍅', '+25 경험치 · 꿀 +10'); emote('🍅', 4);
    say(`집중 끝! 정말 대단해 🍅 (꿀 +10 🍯)${data.settings.autoBreak ? '\n잠깐 쉬자~' : ''}`, 7000); jump('hop');
    if (data.settings.autoBreak) setTimeout(() => focusCmd('break'), 1200); else focusCmd('noop');
  } else {
    focus.state = 'idle'; playSound('chime'); notify('쉬는 시간 끝!', '다시 집중해 볼까요?');
    say('쉬는 시간 끝! 다시 해볼까? 💪', 7000); act('idea', 2500); focusCmd('noop');
  }
}

// =============== 혼잣말 ===============
const IDLE_TALK = ['오늘도 화이팅!', '물 한 잔 마셨어?', '스트레칭 할 시간~', '나 여기 있어!', '흥얼흥얼♪', '쓰다듬어 줄래? (마우스로 문질문질)'];
function chatter() {
  if (!data.settings.chatter || !pet || st.mode === 'sleep' || focus.state === 'focus') return;
  const needs = S.needsOf(data.pet);
  if (needs.length && Math.random() < 0.7) { const n = needs[Math.floor(Math.random() * needs.length)]; say(n.text, 4500); emote(n.emoji, 2); return; }
  const today = S.ymd(new Date()), left = data.todos.filter((t) => t.date === today && !t.done);
  const up = S.upcoming(data.events, new Date(), 1, 3);
  const opts = [...IDLE_TALK];
  if (left.length) opts.push(`할 일 "${left[0].text}" 잊지 마! (${left.length}개 남음)`);
  if (up.length) opts.push(`다음 일정은 ${up[0].time || ''} ${up[0].title}!`);
  say(opts[Math.floor(Math.random() * opts.length)], 4500);
}

// =============== 메뉴 / 트레이 ===============
function buildMenu() {
  const p = data.pet;
  const foods = S.FOODS.filter((f) => p.food[f.id] > 0).map((f) => ({ label: `${f.icon} ${f.name} (${p.food[f.id]})`, click: () => petAction('feed', f.id) }));
  return Menu.buildFromTemplate([
    { label: '✨ 문장으로 일정 추가', click: () => openPanel('smart') },
    { label: '📝 오늘 할 일', click: () => openPanel('today') },
    { label: '📅 달력', click: () => openPanel('calendar') },
    { label: focus.state === 'idle' ? '🍅 집중 시작' : '⏹ 집중 타이머 멈추기', click: () => focusCmd(focus.state === 'idle' ? 'focus' : 'stop') },
    { type: 'separator' },
    { label: '🍚 밥 주기', submenu: [{ label: '🥣 기본 밥 (무료)', click: () => petAction('feed', 'free') }, ...foods] },
    { label: '🛁 씻기기', click: () => petAction('wash') },
    { label: '🎾 놀아주기', click: () => petAction('play') },
    { label: '🐾 돌보기 · 상점', click: () => openPanel('pet') },
    { label: '🎮 바탕화면 미니게임', click: () => openGame() },
    { type: 'separator' },
    { label: '📅 바탕화면 달력', type: 'checkbox', checked: !!widgetWins.calendar, click: () => toggleWidget('calendar') },
    { label: '📊 데일리 위젯', type: 'checkbox', checked: !!widgetWins.daily, click: () => toggleWidget('daily') },
    { label: '🔓 위젯 잠금 모두 해제', click: () => ['calendar', 'daily'].forEach((k) => { widgetCfg(k).locked = false; applyWidget(k); saveData(); }) },
    { type: 'separator' },
    { label: '🎨 캐릭터 꾸미기', click: () => openPanel('character') },
    { label: '⚙️ 설정', click: () => openPanel('settings') },
    { label: data.settings.followCursor ? '🖱 따라다니기 끄기' : '🖱 마우스 따라오기', click: () => setSettings({ followCursor: !data.settings.followCursor }) },
    { label: data.settings.walking ? '⏸ 제자리에 있기' : '▶ 돌아다니기', click: () => setSettings({ walking: !data.settings.walking }) },
    { label: pet && pet.isVisible() ? '🙈 숨기기' : '👀 보이기', click: () => { if (pet.isVisible()) { userHidden = true; pet.hide(); } else { userHidden = false; pet.show(); } refreshTray(); } },
    { type: 'separator' },
    { label: '종료', click: () => app.quit() },
  ]);
}
function refreshTray() { if (tray) tray.setContextMenu(buildMenu()); }
function makeTrayIcon() {
  const f = data.character.frames.idle, N = data.character.size, SZ = 16, buf = Buffer.alloc(SZ * SZ * 4);
  for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) {
    const c = f[Math.floor(y * N / SZ) * N + Math.floor(x * N / SZ)], i = (y * SZ + x) * 4;
    if (c && /^#[0-9a-f]{6}$/i.test(c)) { buf[i] = parseInt(c.slice(5, 7), 16); buf[i + 1] = parseInt(c.slice(3, 5), 16); buf[i + 2] = parseInt(c.slice(1, 3), 16); buf[i + 3] = 255; }
  }
  return nativeImage.createFromBitmap(buf, { width: SZ, height: SZ });
}
function setSettings(patch) {
  data.settings = { ...data.settings, ...patch };
  if ('openAtLogin' in patch) { try { app.setLoginItemSettings({ openAtLogin: !!patch.openAtLogin, path: process.env.PORTABLE_EXECUTABLE_FILE || process.execPath }); } catch {} }
  if ('scale' in patch) resizePet();
  if ('walking' in patch && !patch.walking && st.mode === 'walk') st.mode = 'idle';
  if ('focusMin' in patch || 'breakMin' in patch) broadcast('focus:update', focusPublic());
  saveData(); broadcast('data:settings', data.settings); refreshTray();
}

// =============== IPC ===============
ipcMain.handle('data:get', () => ({ ...data, focus: focusPublic(), builtins: CHARS.list }));
ipcMain.handle('events:save', (_e, events) => {
  let n = 0;
  const added = events.length - data.events.length;
  if (added >= 2) { act('idea', 2500); say(`일정 ${added}개 정리 완료! 💡`, 3000); }
  for (const ev of events) {
    ev.rewardedDates = ev.rewardedDates || [];
    for (const d of ev.doneDates || []) if (!ev.rewardedDates.includes(d)) { ev.rewardedDates.push(d); n++; }
  }
  data.events = events; saveData(); broadcast('data:events', data.events);
  if (n) { grant(10 * n, 3 * n); emote('✨', 4); jump('happy'); say('일정 완료! 꿀 +3 🍯', 3000); }
  return data.events;
});
ipcMain.handle('todos:save', (_e, todos) => {
  let n = 0;
  for (const t of todos) if (t.done && !t.rewarded) { t.rewarded = true; n++; }
  data.todos = todos; saveData(); broadcast('data:todos', data.todos);
  if (n) {
    const today = S.ymd(new Date()), left = todos.filter((t) => t.date === today && !t.done).length;
    grant(10 * n, 3 * n); emote('✨', 4); jump('happy');
    say(left ? `잘했어! 꿀 +3 🍯\n남은 할 일 ${left}개` : '오늘 할 일 끝! 최고야 🎉', 4000);
  }
  return data.todos;
});
ipcMain.handle('character:save', (_e, character) => {
  data.character = fillFrames(character);
  if (character.size >= 64 && data.settings.scale < 4) setSettings({ scale: 4 }); // 고해상도는 디테일이 보이게
  saveData(); resizePet(); broadcast('data:character', data.character);
  if (tray) tray.setImage(makeTrayIcon());
  say('새 모습 어때? ✨', 3000); jump('happy'); return true;
});
ipcMain.handle('mychars:save', (_e, list) => { data.myCharacters = list; saveData(); return true; });
ipcMain.handle('settings:save', (_e, patch) => { setSettings(patch); return data.settings; });
ipcMain.handle('pet:action', (_e, type, arg) => petAction(type, arg));
ipcMain.handle('focus:cmd', (_e, cmd) => focusCmd(cmd));
ipcMain.handle('pet:summary', () => {
  const today = S.ymd(new Date()), todos = data.todos.filter((t) => t.date === today);
  return { todos, upcoming: S.upcoming(data.events, new Date(), 2, 3), needs: S.needsOf(data.pet), gift: !!gift, sleeping: st.mode === 'sleep' };
});
ipcMain.handle('alarm:current', () => ({ ...alarmPayload(), character: data.character, equipped: data.pet.equipped, settings: data.settings }));
ipcMain.on('alarm:dismiss', () => { alarmQueue.shift(); say('좋아, 힘내! 💪', 2500); nextAlarm(); });
ipcMain.on('alarm:snooze', (_e, min) => {
  const a = alarmQueue.shift();
  if (a) { data.snoozes.push({ title: a.title, time: a.time, category: a.category, at: Date.now() + min * 60000 }); saveData(); say(`${min}분 뒤에 다시 알려줄게!`, 3000); }
  nextAlarm();
});
ipcMain.on('alarm:test', () => strongAlarm({ title: '테스트 알람', time: S.hm(new Date()) }));
ipcMain.on('pet:ignore', (_e, ignore) => { if (pet) pet.setIgnoreMouseEvents(ignore, { forward: true }); });
ipcMain.on('pet:dragStart', () => { st.mode = 'drag'; });
ipcMain.on('pet:dragMove', (_e, { x, y }) => { if (!pet) return; st.x = x; st.y = y; pet.setPosition(Math.round(x), Math.round(y)); });
ipcMain.on('pet:dragEnd', () => { st.mode = 'fall'; st.vy = 0; });
ipcMain.on('pet:openPanel', (_e, tab) => openPanel(tab));
ipcMain.on('pet:menu', () => { if (pet) buildMenu().popup({ window: pet }); });
ipcMain.on('pet:hop', () => jump('hop'));
ipcMain.handle('widget:toggle', (_e, kind) => toggleWidget(kind));
ipcMain.handle('widget:state', () => widgetState());
ipcMain.handle('widget:set', (_e, kind, patch) => { Object.assign(widgetCfg(kind), patch); saveData(); applyWidget(kind); return widgetCfg(kind); });
ipcMain.on('widget:ignore', (e, ignore) => { const w = BrowserWindow.fromWebContents(e.sender); if (w) w.setIgnoreMouseEvents(ignore, { forward: true }); });
ipcMain.on('game:open', () => openGame());
ipcMain.on('game:close', () => { if (gameWin) gameWin.close(); });

// =============== 시작 ===============
// 일부 그래픽 드라이버에서 투명 창이 검게 나오거나 사라지는 문제 방지
app.disableHardwareAcceleration();
let userHidden = false;
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => openPanel());
app.whenReady().then(() => {
  data = loadData();
  // 꺼져 있던 동안의 변화 (최대 12시간, 절반 속도)
  const away = Math.min(12 * 60, (Date.now() - (data.pet.lastSeen || Date.now())) / 60000);
  if (away > 1) { decay(away, 0.5); data.pet.hunger = Math.max(data.pet.hunger, 10); data.pet.fun = Math.max(data.pet.fun, 10); }
  data.pet.lastSeen = Date.now();
  if (process.platform === 'darwin' && app.dock) app.dock.hide();
  createPet();
  for (const k of ['calendar', 'daily']) if (widgetCfg(k).on) openWidget(k);
  tray = new Tray(makeTrayIcon()); tray.setToolTip('도트 펫 스케줄러'); tray.on('click', () => openPanel()); refreshTray();
  setInterval(tick, 33);
  // 감시: Win+D·화면 잠금·모니터 변경 뒤 캐릭터 창이 숨겨진 채 남지 않도록
  setInterval(() => {
    if (!pet || pet.isDestroyed()) { createPet(); return; }
    if (userHidden || gameWin) return;
    if (!pet.isVisible() || pet.isMinimized()) { pet.showInactive(); pet.setAlwaysOnTop(true, 'screen-saver'); }
    const b = pet.getBounds(), on = screen.getAllDisplays().some((d) => b.x + b.width > d.bounds.x && b.x < d.bounds.x + d.bounds.width && b.y < d.bounds.y + d.bounds.height && b.y + b.height > d.bounds.y);
    if (!on) { const wa = screen.getPrimaryDisplay().workArea; st.x = wa.x + wa.width * 0.6; st.mode = 'fall'; st.y = wa.y; }
  }, 3000);
  screen.on('display-metrics-changed', () => { resizePet(); if (pet) pet.webContents.send('data:settings', data.settings); });
  screen.on('display-removed', () => { const wa = screen.getPrimaryDisplay().workArea; st.x = wa.x + wa.width * 0.6; resizePet(); });
  setInterval(focusTick, 1000);
  setInterval(checkReminders, 10000);
  setInterval(() => { decay(1); data.pet.lastSeen = Date.now(); pushPet(); maybeGift(); dayCheck(); }, 60000);
  setInterval(chatter, 4 * 60 * 1000);
  setTimeout(() => { checkReminders(); dayCheck(); }, 2000);
});
app.on('window-all-closed', () => { /* 트레이에 남아 계속 실행 */ });
app.on('before-quit', () => { data.pet.lastSeen = Date.now(); try { fs.writeFileSync(DATA_FILE(), serialize()); } catch {} });
