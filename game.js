// =====================================================================
// Auto Rally - a small auto-rickshaw racing game on an HTML canvas.
// Everything runs in the browser. No libraries, no internet needed.
// =====================================================================

// ---------- 1. Settings ----------
const W = 360;              // game world is always 360 units wide
const LAP_LENGTH = 8000;    // how far one lap is
const LAPS = 3;
const ROAD_HALF = 85;       // half of the road width
const CRUISE_SPEED = 330;   // normal top speed (units per second)
const BOOST_SPEED = 520;    // top speed while the power-up is active
const OFFROAD_SPEED = 170;  // top speed on the grass
const STEER_SPEED = 230;    // how fast the auto moves sideways
const BEST_KEY = 'autoRallyBestMs';
const MUTE_KEY = 'autoRallyMuted';

// ---------- 2. Page elements ----------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const coinsEl = document.getElementById('coins');
const lapEl = document.getElementById('lap');
const timerEl = document.getElementById('timer');
const muteBtn = document.getElementById('muteBtn');
const menu = document.getElementById('menu');
const menuText = document.getElementById('menuText');
const bestText = document.getElementById('bestText');
const startBtn = document.getElementById('startBtn');
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');

let H = 640;          // world height, changes with the screen shape
let playerY = 450;    // where the auto is drawn on screen (it stays still, the road moves)

// ---------- 3. Saving (localStorage) ----------
// Wrapped in try/catch because some private browsers block storage.
function load(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function save(key, value) {
  try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
}

// ---------- 4. The looping road ----------
// The road's centre is made from sine waves whose length fits exactly
// into one lap, so after LAP_LENGTH the road repeats: it loops.
function roadCenter(d) {
  const t = (d / LAP_LENGTH) * Math.PI * 2;
  return W / 2 + 70 * Math.sin(t * 2) + 35 * Math.sin(t * 5 + 1);
}

// ---------- 5. Coins, obstacles and power-ups ----------
// A tiny random number generator with a fixed seed, so the track
// layout is the same every race (fair for comparing times).
function makeRandom(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Build the layout for ONE lap, then copy it for every lap.
function buildItems() {
  const rand = makeRandom(42);
  const lapLayout = [];
  let n = 0;
  for (let d = 600; d < LAP_LENGTH - 300; d += 280) {
    const off = (rand() * 1.4 - 0.7) * ROAD_HALF; // left/right position on road
    if (n % 9 === 4) {
      lapLayout.push({ type: 'boost', d: d, off: off });
    } else if (rand() < 0.55) {
      // a short line of 3 coins
      for (let i = 0; i < 3; i++) lapLayout.push({ type: 'coin', d: d + i * 40, off: off });
    } else {
      lapLayout.push({ type: rand() < 0.5 ? 'cone' : 'pothole', d: d, off: off });
    }
    n++;
  }
  const all = [];
  for (let lap = 0; lap < LAPS; lap++) {
    for (const it of lapLayout) {
      all.push({ type: it.type, d: it.d + lap * LAP_LENGTH, off: it.off, taken: false });
    }
  }
  return all;
}

// ---------- 6. Game state ----------
let state = 'menu';   // 'menu' | 'racing' | 'finished'
let player, items, raceTime, coins, lapIndex, lapTimes, lapStart;
let flash = '', flashTimer = 0;   // big on-screen message and how long it stays

function showFlash(text) { flash = text; flashTimer = 1; }
const keys = { left: false, right: false };
const touch = { left: false, right: false };

function resetRace() {
  player = { x: roadCenter(0), dist: 0, speed: 0, crash: 0, boost: 0, steer: 0 };
  items = buildItems();
  raceTime = 0;
  coins = 0;
  lapIndex = 0;
  lapTimes = [];
  lapStart = 0;
  flash = '';
  flashTimer = 0;
}

// ---------- 7. Sound (made with the Web Audio API, no sound files) ----------
let audioCtx = null, master = null, engineOsc = null, engineGain = null;
let muted = load(MUTE_KEY) === '1';

function initAudio() {
  // Browsers only allow sound after the player taps something,
  // so this runs when "Start race" is pressed.
  if (audioCtx) { audioCtx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  audioCtx = new AC();
  master = audioCtx.createGain();
  master.gain.value = muted ? 0 : 0.5;
  master.connect(audioCtx.destination);

  // Engine: a low buzzing tone whose pitch follows the speed.
  engineOsc = audioCtx.createOscillator();
  engineOsc.type = 'sawtooth';
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 500;
  engineGain = audioCtx.createGain();
  engineGain.gain.value = 0;
  engineOsc.connect(filter);
  filter.connect(engineGain);
  engineGain.connect(master);
  engineOsc.start();
}

// Play one short tone. slideTo makes the pitch slide (e.g. for the boost).
function beep(freq, duration, type, volume, slideTo) {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type || 'square';
  osc.frequency.setValueAtTime(freq, now);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
  g.gain.setValueAtTime(volume || 0.15, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(g);
  g.connect(master);
  osc.start(now);
  osc.stop(now + duration);
}

const sounds = {
  coin:   function () { beep(988, 0.08, 'square', 0.12); setTimeout(function () { beep(1319, 0.12, 'square', 0.12); }, 70); },
  crash:  function () { beep(160, 0.35, 'sawtooth', 0.3, 40); },
  boost:  function () { beep(300, 0.4, 'triangle', 0.25, 1200); },
  lap:    function () { beep(660, 0.15, 'square', 0.15); setTimeout(function () { beep(880, 0.2, 'square', 0.15); }, 150); },
  finish: function () { [523, 659, 784, 1047].forEach(function (f, i) { setTimeout(function () { beep(f, 0.25, 'square', 0.15); }, i * 140); }); }
};

function setMuted(m) {
  muted = m;
  save(MUTE_KEY, m ? '1' : '0');
  muteBtn.textContent = m ? '🔇' : '🔊';
  if (master) master.gain.value = m ? 0 : 0.5;
}

// ---------- 8. Controls: keyboard + touch ----------
document.addEventListener('keydown', function (e) {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { keys.left = true; e.preventDefault(); }
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { keys.right = true; e.preventDefault(); }
  if (e.key === 'm' || e.key === 'M') setMuted(!muted);
});
document.addEventListener('keyup', function (e) {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
});

// Touch buttons: hold to steer. Pointer events work for both finger and mouse.
function holdButton(btn, side) {
  function down(e) { e.preventDefault(); touch[side] = true; btn.classList.add('on'); }
  function up() { touch[side] = false; btn.classList.remove('on'); }
  btn.addEventListener('pointerdown', down);
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointercancel', up);
  btn.addEventListener('pointerleave', up);
  btn.addEventListener('contextmenu', function (e) { e.preventDefault(); }); // stop long-press menu
}
holdButton(leftBtn, 'left');
holdButton(rightBtn, 'right');

muteBtn.addEventListener('click', function () { setMuted(!muted); });
startBtn.addEventListener('click', startRace);

function startRace() {
  initAudio();
  resetRace();
  state = 'racing';
  menu.classList.add('hidden');
  startBtn.blur();
}

// ---------- 9. Game update (runs every frame) ----------
function update(dt) {
  if (state !== 'racing') return;
  const p = player;

  // Steering
  p.steer = (keys.left || touch.left ? -1 : 0) + (keys.right || touch.right ? 1 : 0);
  p.x += p.steer * STEER_SPEED * dt;
  p.x = Math.max(14, Math.min(W - 14, p.x));

  // Speed: the auto speeds up on its own. Grass and crashes slow it down.
  const offRoad = Math.abs(p.x - roadCenter(p.dist)) > ROAD_HALF - 8;
  let target = p.boost > 0 ? BOOST_SPEED : CRUISE_SPEED;
  if (offRoad) target = Math.min(target, OFFROAD_SPEED);
  if (p.crash > 0) target = CRUISE_SPEED * 0.35;
  p.speed += (target - p.speed) * Math.min(1, dt * 1.8);
  p.dist += p.speed * dt;

  p.crash = Math.max(0, p.crash - dt);
  p.boost = Math.max(0, p.boost - dt);
  raceTime += dt;

  // Hitting things: compare the auto's position with each item nearby.
  for (const it of items) {
    if (it.taken || Math.abs(it.d - p.dist) > 26) continue;
    const ix = roadCenter(it.d) + it.off;
    if (Math.abs(ix - p.x) > 22) continue;

    if (it.type === 'coin') {
      it.taken = true;
      coins++;
      sounds.coin();
    } else if (it.type === 'boost') {
      it.taken = true;
      p.boost = 3;            // 3 seconds of extra speed
      showFlash('BOOST!');
      sounds.boost();
    } else if (p.crash === 0) {
      // Cone or pothole: slow down for 1 second. The obstacle is removed so
      // you can't hit the same one twice (keeps crashes fair).
      it.taken = true;
      p.crash = 1;
      p.speed *= 0.3;
      showFlash('CRASH!');
      sounds.crash();
    }
  }

  // Laps
  const newLap = Math.floor(p.dist / LAP_LENGTH);
  if (newLap > lapIndex) {
    lapTimes.push(raceTime - lapStart);
    lapStart = raceTime;
    lapIndex = newLap;
    if (lapIndex >= LAPS) {
      finishRace();
    } else {
      showFlash('LAP ' + (lapIndex + 1) + '!');
      sounds.lap();
    }
  }

  // Engine sound follows the speed
  if (engineOsc) {
    engineOsc.frequency.value = 55 + p.speed * 0.22;
    engineGain.gain.value = 0.08;
  }
}

function finishRace() {
  state = 'finished';
  sounds.finish();
  if (engineGain) engineGain.gain.value = 0;

  const ms = Math.round(raceTime * 1000);
  const oldBest = parseInt(load(BEST_KEY), 10);
  const isNewBest = isNaN(oldBest) || ms < oldBest;
  if (isNewBest) save(BEST_KEY, String(ms));

  let html = '<b>Finished!</b><br>Time: ' + formatTime(raceTime) + '<br>Coins: 🪙 ' + coins + '<br>';
  html += lapTimes.map(function (t, i) { return 'Lap ' + (i + 1) + ': ' + formatTime(t); }).join('<br>');
  if (isNewBest) html += '<br><b style="color:#ffd23f">New best time!</b>';
  menuText.innerHTML = html;
  showBest();
  startBtn.textContent = 'Race again';
  menu.classList.remove('hidden');
}

function showBest() {
  const best = parseInt(load(BEST_KEY), 10);
  bestText.textContent = isNaN(best) ? 'Best time: none yet' : 'Best time: ' + formatTime(best / 1000);
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
}

// ---------- 10. Drawing ----------
function draw() {
  const p = player;

  // Grass with moving stripes so you can feel the speed
  for (let y = 0; y < H; y += 8) {
    const d = p.dist + (playerY - y);
    ctx.fillStyle = Math.floor(d / 60) % 2 === 0 ? '#3f9b4f' : '#379046';
    ctx.fillRect(0, y, W, 9);
  }

  // Road: drawn as thin horizontal strips, each at its own centre
  for (let y = 0; y < H; y += 4) {
    const d = p.dist + (playerY - y);
    const c = roadCenter(d);
    const stripe = Math.floor(d / 40) % 2 === 0;

    // strips are 5 tall (1 overlap) so no thin gaps show between them
    ctx.fillStyle = stripe ? '#e63946' : '#ffffff';               // kerbs (left and right edge)
    ctx.fillRect(c - ROAD_HALF - 8, y, 8, 5);
    ctx.fillRect(c + ROAD_HALF, y, 8, 5);
    ctx.fillStyle = '#555b63';                                    // tarmac
    ctx.fillRect(c - ROAD_HALF, y, ROAD_HALF * 2, 5);
    if (Math.floor(d / 50) % 2 === 0) {                           // centre line
      ctx.fillStyle = '#f1f1f1';
      ctx.fillRect(c - 2, y, 4, 4);
    }
    const inLap = ((d % LAP_LENGTH) + LAP_LENGTH) % LAP_LENGTH;
    if (d > 0 && inLap < 24) {                                    // start/finish line
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = (i + Math.floor(inLap / 8)) % 2 === 0 ? '#111' : '#fff';
        ctx.fillRect(c - ROAD_HALF + i * (ROAD_HALF / 5), y, ROAD_HALF / 5, 4);
      }
    }
  }

  // Items
  for (const it of items) {
    if (it.taken) continue;
    const y = playerY - (it.d - p.dist);
    if (y < -30 || y > H + 30) continue;
    const x = roadCenter(it.d) + it.off;
    drawItem(it.type, x, y);
  }

  drawAuto(p.x, playerY, p.steer, p.crash, p.boost);

  // Big message (LAP 2!, CRASH!, BOOST!) shown briefly
  if (flash && state === 'racing') {
    ctx.font = 'bold 36px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#000';
    ctx.strokeText(flash, W / 2, H * 0.3);
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(flash, W / 2, H * 0.3);
  }
}

function drawItem(type, x, y) {
  if (type === 'coin') {
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#c99700'; ctx.lineWidth = 3; ctx.stroke();
  } else if (type === 'cone') {
    ctx.fillStyle = '#ff7b00';
    ctx.beginPath(); ctx.moveTo(x, y - 14); ctx.lineTo(x + 11, y + 11); ctx.lineTo(x - 11, y + 11); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - 6, y - 1, 12, 4);
  } else if (type === 'pothole') {
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath(); ctx.ellipse(x, y, 16, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3d3d3d'; ctx.lineWidth = 3; ctx.stroke();
  } else if (type === 'boost') {
    ctx.fillStyle = '#1e88e5';
    ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffeb3b';                                   // lightning bolt
    ctx.beginPath();
    ctx.moveTo(x + 2, y - 10); ctx.lineTo(x - 6, y + 2); ctx.lineTo(x, y + 2);
    ctx.lineTo(x - 2, y + 10); ctx.lineTo(x + 6, y - 2); ctx.lineTo(x, y - 2);
    ctx.closePath(); ctx.fill();
  }
}

// A cute auto-rickshaw seen from above: 3 wheels, yellow nose, black roof.
function drawAuto(x, y, steer, crash, boost) {
  // Blink while crashed
  if (crash > 0 && Math.floor(crash * 10) % 2 === 0) return;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(steer * 0.15);

  if (boost > 0) {                                               // boost flame
    ctx.fillStyle = Math.random() < 0.5 ? '#ff9800' : '#ffeb3b';
    ctx.beginPath(); ctx.moveTo(-7, 22); ctx.lineTo(7, 22); ctx.lineTo(0, 38 + Math.random() * 8); ctx.closePath(); ctx.fill();
  }

  ctx.fillStyle = '#111';                                        // wheels
  ctx.fillRect(-3, -26, 6, 9);                                   // front wheel
  ctx.fillRect(-19, 8, 6, 12);                                   // rear left
  ctx.fillRect(13, 8, 6, 12);                                    // rear right

  ctx.fillStyle = '#2e7d32';                                     // green body
  roundRect(-15, -12, 30, 34, 7); ctx.fill();
  ctx.fillStyle = '#ffd23f';                                     // yellow nose
  roundRect(-11, -24, 22, 16, 8); ctx.fill();
  ctx.fillStyle = '#1b1b1b';                                     // black canopy roof
  roundRect(-14, -8, 28, 28, 6); ctx.fill();
  ctx.fillStyle = '#ffd23f';                                     // yellow roof stripe
  ctx.fillRect(-14, 4, 28, 4);
  ctx.fillStyle = '#fff8c4';                                     // headlight
  ctx.beginPath(); ctx.arc(0, -23, 3, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function updateHud() {
  coinsEl.textContent = '🪙 ' + coins;
  lapEl.textContent = 'Lap ' + Math.min(lapIndex + 1, LAPS) + '/' + LAPS;
  timerEl.textContent = formatTime(raceTime);
}

// ---------- 11. Screen size ----------
// The world is 360 wide; its height follows the phone's screen shape.
function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const scale = canvas.width / W;
  H = canvas.height / scale;
  playerY = H - 170;                // above the touch buttons
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}
window.addEventListener('resize', resize);

// ---------- 12. Main loop ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);   // cap so a pause can't cause a huge jump
  last = now;

  update(dt);

  // Clear the flash message after 1 second
  flashTimer -= dt;
  if (flashTimer <= 0) flash = '';

  draw();
  updateHud();
  requestAnimationFrame(loop);
}

// ---------- Start ----------
resetRace();
setMuted(muted);
showBest();
resize();
requestAnimationFrame(loop);
