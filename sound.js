// 8비트 효과음 (파일 없이 소리 생성)
(function (root) {
  let ac;
  const getCtx = () => (ac = ac || new (window.AudioContext || window.webkitAudioContext)());
  const SOUNDS = {
    chime: { label: '띵동', wave: 'square', notes: [[988, 0, 0.3], [784, 0.3, 0.55]] },
    beep: { label: '삐삐삐', wave: 'square', notes: [[1046, 0, 0.1], [1046, 0.18, 0.1], [1046, 0.36, 0.1], [1046, 0.54, 0.1]] },
    melody: { label: '도레미 멜로디', wave: 'square', notes: [[523, 0, 0.15], [659, 0.15, 0.15], [784, 0.3, 0.15], [1046, 0.45, 0.3], [784, 0.8, 0.15], [1046, 0.95, 0.4]] },
    bell: { label: '종소리', wave: 'triangle', notes: [[1318, 0, 0.8], [1568, 0.25, 0.8], [1318, 0.5, 0.9]] },
    coin: { label: '꿀', wave: 'square', notes: [[988, 0, 0.08], [1318, 0.08, 0.3]] },
    pop: { label: '뽁', wave: 'triangle', notes: [[660, 0, 0.07], [990, 0.06, 0.1]] },
  };
  function play(type = 'chime', vol = 0.6) {
    const a = getCtx(); if (a.state === 'suspended') a.resume();
    const s = SOUNDS[type] || SOUNDS.chime, t0 = a.currentTime + 0.02;
    let end = 0;
    for (const [fr, st, du] of s.notes) {
      const o = a.createOscillator(), g = a.createGain();
      o.type = s.wave; o.frequency.value = fr;
      g.gain.setValueAtTime(0.0001, t0 + st);
      g.gain.linearRampToValueAtTime(Math.max(0.0002, vol * 0.22), t0 + st + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + st + du);
      o.connect(g).connect(a.destination); o.start(t0 + st); o.stop(t0 + st + du + 0.05);
      end = Math.max(end, st + du);
    }
    return end;
  }
  function loop(type, vol, maxMs = 90000) {
    let stopped = false, timer;
    const run = () => { if (stopped) return; const len = play(type, vol); timer = setTimeout(run, len * 1000 + 700); };
    run();
    const kill = setTimeout(stop, maxMs);
    function stop() { stopped = true; clearTimeout(timer); clearTimeout(kill); }
    return stop;
  }
  root.Sound = { SOUNDS, play, loop };
})(window);
