// 설정 탭
(() => {
  $('#sSound').innerHTML = Object.entries(Sound.SOUNDS).filter(([k]) => !['coin', 'pop'].includes(k)).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
  function render() {
    const s = App.d.settings;
    $('#sScale').value = s.scale; $('#scaleV').textContent = `${32 * s.scale}px`;
    $('#sSpeed').value = s.speed; $('#speedV').textContent = `${s.speed}× (기본 1.5)`;
    $('#sWalk').checked = s.walking; $('#sFollow').checked = s.followCursor; $('#sChat').checked = s.chatter;
    $('#sSleep').checked = s.sleepEnabled; $('#sSleepStart').value = s.sleepStart; $('#sSleepEnd').value = s.sleepEnd;
    $('#sSound').value = s.sound; $('#sVolume').value = s.volume; $('#sDefAlarm').value = s.defaultAlarm;
    $('#sDayStart').value = s.dayStart; $('#sDayEnd').value = s.dayEnd;
    $('#sCarry').checked = s.carryOver; $('#sAutoBreak').checked = s.autoBreak; $('#sLogin').checked = s.openAtLogin;
  }
  const save = (patch) => api.saveSettings(patch).then((s) => { App.d.settings = s; App.emit('settings'); });
  const bind = (id, key, ev = 'change', conv = (el) => el.value) => $(id).addEventListener(ev, (e) => save({ [key]: conv(e.target) }));
  const num = (el) => Number(el.value), chk = (el) => el.checked;
  bind('#sScale', 'scale', 'input', num); bind('#sSpeed', 'speed', 'input', num);
  bind('#sWalk', 'walking', 'change', chk); bind('#sFollow', 'followCursor', 'change', chk); bind('#sChat', 'chatter', 'change', chk);
  bind('#sSleep', 'sleepEnabled', 'change', chk); bind('#sSleepStart', 'sleepStart'); bind('#sSleepEnd', 'sleepEnd');
  bind('#sSound', 'sound'); bind('#sVolume', 'volume', 'change', num); bind('#sDefAlarm', 'defaultAlarm');
  bind('#sDayStart', 'dayStart'); bind('#sDayEnd', 'dayEnd');
  bind('#sCarry', 'carryOver', 'change', chk); bind('#sAutoBreak', 'autoBreak', 'change', chk); bind('#sLogin', 'openAtLogin', 'change', chk);
  $('#sSoundTest').onclick = () => Sound.play($('#sSound').value, Number($('#sVolume').value));
  $('#sAlarmTest').onclick = () => api.alarmTest();
  ['settings', 'tab:settings'].forEach((n) => App.on(n, () => App.tab === 'settings' && render()));
})();
