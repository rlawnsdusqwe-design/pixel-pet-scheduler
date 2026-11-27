const $ = (s) => document.getElementById(s);
const ctx = $('cv').getContext('2d');
let character, equipped, settings, stopSound = null, t = 0;

function show({ alarm, more }) {
  if (!alarm) return;
  const cat = Shared.catOf(alarm.category);
  $('cat').style.background = cat.color;
  $('label').textContent = `${alarm.snoozed ? '다시 알림 · ' : ''}${alarm.category ? cat.label : '알람'}`;
  $('time').textContent = alarm.time || Shared.hm(new Date());
  $('title').textContent = alarm.title;
  $('more').textContent = more > 0 ? `대기 중인 알람 ${more}개` : '';
  if (stopSound) stopSound();
  stopSound = Sound.loop(settings.sound, settings.volume, 90000);
}
setInterval(() => {
  if (!character) return; t++;
  const bob = Math.round(Math.abs(Math.sin(t / 3)) * 8);
  Render.fit($('cv'), 128, character.size);
  Render.renderPet(ctx, character, character.rig ? 'alarm' : t % 6 < 3 ? 'surprised' : 'happy', { bob: character.rig ? 0 : bob, acc: equipped });
}, 70);
const done = (fn) => () => { if (stopSound) stopSound(); stopSound = null; fn(); };
$('ok').onclick = done(() => api.alarmDismiss());
$('s5').onclick = done(() => api.alarmSnooze(5));
$('s10').onclick = done(() => api.alarmSnooze(10));
window.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === 'Escape') $('ok').click(); });
api.onAlarm(show);
api.alarmCurrent().then((d) => { character = d.character; equipped = d.equipped; settings = d.settings; show(d); });
