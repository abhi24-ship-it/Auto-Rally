// =====================================================================
// Auto Rally - a small auto-rickshaw racing game on an HTML canvas.
// Everything runs in the browser. No libraries, no internet needed.
// Two modes: "3-Lap Race" and "Endless". Coins buy autos in the Garage.
// =====================================================================

// ---------- 1. Settings ----------
const W = 360;              // game world is always 360 units wide
const LAP_LENGTH = 8000;    // how far one lap is
const RACE_LAPS = 3;        // laps in "3-Lap Race" mode
const ROAD_HALF = 85;       // half of the road width
const EDGE_LIMIT = ROAD_HALF - 15; // further than this from the road centre = the auto hits the border
const CRUISE_SPEED = 330;   // normal top speed (units per second)
const BOOST_EXTRA = 170;    // extra speed while the ⚡ power-up is active
const MAX_ENDLESS_FACTOR = 1.5; // endless mode gets 10% faster each lap, up to 1.5x

// Everything saved on the device (localStorage) uses these names
const SAVE = {
  bestRace: 'autoRallyBestRaceMs',
  bestEndless: 'autoRallyBestEndlessMs',
  bestEndlessLaps: 'autoRallyBestEndlessLaps',
  wallet: 'autoRallyWallet',
  owned: 'autoRallyOwned',
  design: 'autoRallyDesign',
  color: 'autoRallyColor',
  muted: 'autoRallyMuted'
};

// The Garage: 1 free design + 3 new ones, and 3 colours (roof is always black)
const DESIGNS = [
  { id: 'classic', name: 'Classic', price: 0 },
  { id: 'sport',   name: 'Sport',   price: 30 },
  { id: 'cargo',   name: 'Cargo',   price: 60 },
  { id: 'royal',   name: 'Royal',   price: 100 }
];
const COLORS = [
  { id: 'green', name: 'Black-Green', price: 0,  body: '#2e7d32' },
  { id: 'red',   name: 'Black-Red',   price: 20, body: '#c62828' },
  { id: 'black', name: 'Black-Black', price: 40, body: '#3a3a3a' }
];

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
const raceBtn = document.getElementById('raceBtn');
const endlessBtn = document.getElementById('endlessBtn');
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');
const walletEl = document.getElementById('wallet');
const previewCanvas = document.getElementById('preview');
const previewCtx = previewCanvas.getContext('2d');
const designChoices = document.getElementById('designChoices');
const colorChoices = document.getElementById('colorChoices');
const shopMsg = document.getElementById('shopMsg');

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
function loadNumber(key) {
  const n = parseInt(load(key), 10);
  return isNaN(n) ? null : n;
}

// ---------- 4. The looping road ----------
// The road's centre is made from sine waves whose length fits exactly
// into one lap, so after LAP_LENGTH the road repeats: it loops.
function roadCenter(d) {
  const t = (d / LAP_LENGTH) * Math.PI * 2;
  return W / 2 + 70 * Math.sin(t * 2) + 35 * Math.sin(t * 5 + 1);
}

// ---------- 5. Coins, obstacles and power-ups ----------
// A tiny random number generator with a seed: the same seed always gives
// the same numbers, so a track layout can be repeated exactly.
function makeRandom(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Make the items for one lap.
// Race mode: the same layout every lap (fair for comparing times).
// Endless mode: a new layout every lap, with more obstacles as laps go up.
function lapItems(lap) {
  const rand = makeRandom(mode === 'race' ? 42 : 1000 + lap);
  const obstacleChance = mode === 'race' ? 0.45 : Math.min(0.7, 0.45 + 0.05 * lap);
  const list = [];
  let n = 0;
  for (let d = 600; d < LAP_LENGTH - 300; d += 280) {
    const off = (rand() * 1.4 - 0.7) * ROAD_HALF;   // left/right position on the road
    const at = d + lap * LAP_LENGTH;
    if (n % 9 === 4) {
      list.push({ type: 'boost', d: at, off: off });
    } else if (rand() < obstacleChance) {
      list.push({ type: rand() < 0.6 ? 'cone' : 'pothole', d: at, off: off });
    } else {
      for (let i = 0; i < 3; i++) list.push({ type: 'coin', d: at + i * 40, off: off }); // line of 3 coins
    }
    n++;
  }
  return list;
}

// ---------- 6. Game state ----------
let state = 'menu';   // 'menu' | 'racing' | 'over' | 'finished'
let mode = 'race';    // 'race' | 'endless'
let player, items, raceTime, coins, lapIndex, lapTimes, lapStart;
let flash = '', flashTimer = 0;   // big on-screen message and how long it stays
const keys = { left: false, right: false };
const touch = { left: false, right: false };

// Garage data
let wallet = loadNumber(SAVE.wallet) || 0;
let owned = [];
try { owned = JSON.parse(load(SAVE.owned)) || []; } catch (e) { owned = []; }
let myDesign = load(SAVE.design) || 'classic';
let myColor = load(SAVE.color) || 'green';

function showFlash(text, seconds) { flash = text; flashTimer = seconds || 1; }

function resetRun() {
  player = { x: roadCenter(0), dist: 0, speed: 0, slow: 0, boost: 0, steer: 0, crashed: false };
  items = lapItems(0).concat(lapItems(1));   // this lap and the next one
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
let muted = load(SAVE.muted) === '1';

function initAudio() {
  // Browsers only allow sound after the player taps something,
  // so this runs when a mode button is pressed.
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
  bump:   function () { beep(120, 0.2, 'sawtooth', 0.25, 60); },
  crash:  function () { beep(200, 0.7, 'sawtooth', 0.35, 30); },
  boost:  function () { beep(300, 0.4, 'triangle', 0.25, 1200); },
  lap:    function () { beep(660, 0.15, 'square', 0.15); setTimeout(function () { beep(880, 0.2, 'square', 0.15); }, 150); },
  buy:    function () { beep(523, 0.1, 'square', 0.15); setTimeout(function () { beep(784, 0.15, 'square', 0.15); }, 90); },
  finish: function () { [523, 659, 784, 1047].forEach(function (f, i) { setTimeout(function () { beep(f, 0.25, 'square', 0.15); }, i * 140); }); }
};

function setMuted(m) {
  muted = m;
  save(SAVE.muted, m ? '1' : '0');
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
raceBtn.addEventListener('click', function () { startRun('race'); });
endlessBtn.addEventListener('click', function () { startRun('endless'); });

function startRun(newMode) {
  mode = newMode;
  initAudio();
  resetRun();
  state = 'racing';
  menu.classList.add('hidden');
  raceBtn.blur();
  endlessBtn.blur();
}

// ---------- 9. Game update (runs every frame) ----------
function cruiseSpeed() {
  if (mode === 'race') return CRUISE_SPEED;
  return CRUISE_SPEED * Math.min(MAX_ENDLESS_FACTOR, 1 + 0.1 * lapIndex);
}

function update(dt) {
  if (state !== 'racing') return;
  const p = player;

  // Steering (a bit quicker at high speed so curves stay fair)
  p.steer = (keys.left || touch.left ? -1 : 0) + (keys.right || touch.right ? 1 : 0);
  p.x += p.steer * (200 + p.speed * 0.15) * dt;

  // Hitting the border of the track ends the game
  if (Math.abs(p.x - roadCenter(p.dist)) > EDGE_LIMIT) {
    gameOver('You hit the edge of the track!');
    return;
  }

  // Speed: the auto speeds up on its own. Potholes slow it down.
  let target = cruiseSpeed() + (p.boost > 0 ? BOOST_EXTRA : 0);
  if (p.slow > 0) target *= 0.35;
  p.speed += (target - p.speed) * Math.min(1, dt * 1.8);
  p.dist += p.speed * dt;

  p.slow = Math.max(0, p.slow - dt);
  p.boost = Math.max(0, p.boost - dt);
  raceTime += dt;

  // Hitting things: compare the auto's position with each item nearby.
  for (const it of items) {
    if (it.taken || Math.abs(it.d - p.dist) > 26) continue;
    const dx = Math.abs(roadCenter(it.d) + it.off - p.x);
    const dd = Math.abs(it.d - p.dist);

    if (it.type === 'coin' && dx < 24) {
      it.taken = true;
      coins++;
      wallet++;
      save(SAVE.wallet, String(wallet));   // saved straight away, so coins are never lost
      sounds.coin();
    } else if (it.type === 'boost' && dx < 24) {
      it.taken = true;
      p.boost = 3;            // 3 seconds of extra speed
      showFlash('BOOST!');
      sounds.boost();
    } else if (it.type === 'cone' && dx < 20 && dd < 22) {
      gameOver('You hit a cone!');
      return;
    } else if (it.type === 'pothole' && dx < 22 && dd < 20 && p.slow === 0) {
      it.taken = true;         // can't hit the same pothole twice
      p.slow = 1;              // slow for 1 second
      p.speed *= 0.4;
      showFlash('BUMP!');
      sounds.bump();
    }
  }

  // Laps
  const newLap = Math.floor(p.dist / LAP_LENGTH);
  if (newLap > lapIndex) {
    lapTimes.push(raceTime - lapStart);
    lapStart = raceTime;
    lapIndex = newLap;
    if (mode === 'race' && lapIndex >= RACE_LAPS) {
      finishRace();
      return;
    }
    showFlash('LAP ' + (lapIndex + 1) + '!');
    sounds.lap();
    // Add the lap after this one, and forget items far behind us
    if (mode === 'endless' || lapIndex + 1 < RACE_LAPS) items = items.concat(lapItems(lapIndex + 1));
    items = items.filter(function (it) { return it.d > p.dist - 500; });
  }

  // Engine sound follows the speed
  if (engineOsc) {
    engineOsc.frequency.value = 55 + p.speed * 0.22;
    engineGain.gain.value = 0.08;
  }
}

// Crash: the run ends. Pressing a mode button starts again from 0.
function gameOver(reason) {
  state = 'over';
  player.crashed = true;
  sounds.crash();
  if (engineGain) engineGain.gain.value = 0;
  showFlash('CRASH!', 5);

  let html = '<b>Game over!</b> ' + reason + '<br>';
  if (mode === 'endless') {
    const ms = Math.round(raceTime * 1000);
    html += 'You lasted ' + formatTime(raceTime) + ' and finished ' + lapIndex + ' lap' + (lapIndex === 1 ? '' : 's') + '.<br>';
    const old = loadNumber(SAVE.bestEndless);
    if (old === null || ms > old) {
      save(SAVE.bestEndless, String(ms));
      save(SAVE.bestEndlessLaps, String(lapIndex));
      html += '<b style="color:#ffd23f">New endless record!</b><br>';
    }
  } else {
    html += 'Race not finished (lap ' + (lapIndex + 1) + '/' + RACE_LAPS + '), so no time is saved.<br>';
  }
  html += 'Coins this run: 🪙 ' + coins;
  setTimeout(function () { showMenu(html); }, 900);   // short pause so you see the crash
}

function finishRace() {
  state = 'finished';
  sounds.finish();
  if (engineGain) engineGain.gain.value = 0;

  const ms = Math.round(raceTime * 1000);
  const old = loadNumber(SAVE.bestRace);
  const isNewBest = old === null || ms < old;
  if (isNewBest) save(SAVE.bestRace, String(ms));

  let html = '<b>Finished!</b> Time: ' + formatTime(raceTime) + '<br>';
  html += lapTimes.map(function (t, i) { return 'Lap ' + (i + 1) + ': ' + formatTime(t); }).join(' · ') + '<br>';
  if (isNewBest) html += '<b style="color:#ffd23f">New best time!</b><br>';
  html += 'Coins this run: 🪙 ' + coins;
  showMenu(html);
}

function showMenu(html) {
  menuText.innerHTML = html;
  showBest();
  renderGarage();
  shopMsg.textContent = '';
  menu.classList.remove('hidden');
}

function showBest() {
  const race = loadNumber(SAVE.bestRace);
  const endless = loadNumber(SAVE.bestEndless);
  const laps = loadNumber(SAVE.bestEndlessLaps) || 0;
  bestText.innerHTML =
    'Best 3-lap race: ' + (race === null ? 'none yet' : formatTime(race / 1000)) + '<br>' +
    'Best endless: ' + (endless === null ? 'none yet' : formatTime(endless / 1000) + ' (' + laps + ' laps)');
}

function formatTime(sec) {
  // Round to tenths first, so 9.96 becomes 10.0 and 59.96 becomes 1:00.0.
  const tenths = Math.round(sec * 10);
  const m = Math.floor(tenths / 600);
  const s = (tenths % 600) / 10;
  return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
}

// ---------- 10. Garage (spend coins on designs and colours) ----------
function isOwned(kind, item) {
  return item.price === 0 || owned.indexOf(kind + ':' + item.id) !== -1;
}

// Make one row of buttons for designs or colours
function makeChoices(container, kind, list, selectedId) {
  container.innerHTML = '';
  list.forEach(function (item) {
    const btn = document.createElement('button');
    btn.className = 'choice';
    const have = isOwned(kind, item);
    btn.textContent = item.name + (have ? '' : ' · 🪙' + item.price) + (item.id === selectedId ? ' ✓' : '');
    if (!have) btn.classList.add('locked');
    if (item.id === selectedId) btn.classList.add('selected');
    btn.addEventListener('click', function () { chooseItem(kind, item); });
    container.appendChild(btn);
  });
}

// Tap an item: use it if you own it, otherwise buy it if you have enough coins
function chooseItem(kind, item) {
  if (!isOwned(kind, item)) {
    if (wallet < item.price) {
      shopMsg.textContent = 'You need ' + (item.price - wallet) + ' more coins for ' + item.name + '.';
      return;
    }
    wallet -= item.price;
    owned.push(kind + ':' + item.id);
    save(SAVE.wallet, String(wallet));
    save(SAVE.owned, JSON.stringify(owned));
    shopMsg.textContent = 'Bought ' + item.name + '!';
    initAudio();
    sounds.buy();
  } else {
    shopMsg.textContent = '';
  }
  if (kind === 'design') { myDesign = item.id; save(SAVE.design, item.id); }
  else { myColor = item.id; save(SAVE.color, item.id); }
  renderGarage();
}

function renderGarage() {
  walletEl.textContent = '🪙 ' + wallet;
  makeChoices(designChoices, 'design', DESIGNS, myDesign);
  makeChoices(colorChoices, 'color', COLORS, myColor);
  // Draw the chosen auto big in the preview box
  previewCtx.setTransform(1, 0, 0, 1, 0, 0);
  previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  previewCtx.setTransform(3.2, 0, 0, 3.2, 100, 105);
  drawAuto(previewCtx, 0, 0, 0, 0, myDesign, myColor);
}

// ---------- 11. Drawing ----------
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
    ctx.fillStyle = stripe ? '#e63946' : '#ffffff';               // kerbs (the border)
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
    drawItem(it.type, roadCenter(it.d) + it.off, y);
  }

  // The auto (blinks after a pothole, flame while boosting)
  if (!(p.slow > 0 && Math.floor(p.slow * 10) % 2 === 0)) {
    drawAuto(ctx, p.x, playerY, p.steer, p.boost, myDesign, myColor);
  }
  if (p.crashed) {                                                // crash burst
    ctx.strokeStyle = '#ffeb3b';
    ctx.lineWidth = 4;
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(a) * 22, playerY + Math.sin(a) * 22);
      ctx.lineTo(p.x + Math.cos(a) * 36, playerY + Math.sin(a) * 36);
      ctx.stroke();
    }
  }

  // Big message (LAP 2!, BUMP!, BOOST!, CRASH!) shown briefly
  if (flash && state !== 'menu') {
    ctx.font = 'bold 36px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#000';
    ctx.strokeText(flash, W / 2, H * 0.3);
    ctx.fillStyle = flash === 'CRASH!' ? '#ff5252' : '#ffd23f';
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

// An auto-rickshaw seen from above. c = which canvas to draw on.
// design: classic / sport / cargo / royal. color: green / red / black body.
function drawAuto(c, x, y, steer, boost, design, color) {
  const body = (COLORS.find(function (k) { return k.id === color; }) || COLORS[0]).body;
  const ROOF = '#141414', YELLOW = '#ffd23f', LIGHT = '#fff8c4';

  c.save();
  c.translate(x, y);
  c.rotate(steer * 0.15);

  if (boost > 0) {                                               // boost flame
    c.fillStyle = Math.random() < 0.5 ? '#ff9800' : '#ffeb3b';
    c.beginPath(); c.moveTo(-7, 24); c.lineTo(7, 24); c.lineTo(0, 40 + Math.random() * 8); c.closePath(); c.fill();
  }

  c.fillStyle = '#111';                                          // 3 wheels
  c.fillRect(-3, -26, 6, 9);
  c.fillRect(-19, 8, 6, 12);
  c.fillRect(13, 8, 6, 12);

  if (design === 'sport') {
    // Low racer: pointed nose, two racing stripes, rear spoiler
    c.fillStyle = body;   rr(c, -15, -12, 30, 33, 6); c.fill();
    c.fillStyle = YELLOW; c.beginPath(); c.moveTo(0, -28); c.lineTo(11, -10); c.lineTo(-11, -10); c.closePath(); c.fill();
    c.fillStyle = ROOF;   rr(c, -10, -5, 20, 22, 5); c.fill();
    c.fillStyle = '#ffffff'; c.fillRect(-5, -5, 3, 22); c.fillRect(2, -5, 3, 22);
    c.fillStyle = ROOF;   c.fillRect(-18, 21, 36, 5);             // spoiler
    c.fillStyle = LIGHT;  c.beginPath(); c.arc(-5, -15, 2.5, 0, 7); c.arc(5, -15, 2.5, 0, 7); c.fill();
  } else if (design === 'cargo') {
    // Small cabin in front, wooden crate box at the back
    c.fillStyle = body;   rr(c, -16, -13, 32, 37, 5); c.fill();
    c.fillStyle = YELLOW; rr(c, -11, -25, 22, 16, 8); c.fill();
    c.fillStyle = ROOF;   rr(c, -11, -9, 22, 13, 5); c.fill();
    c.fillStyle = '#a1693f'; c.fillRect(-12, 6, 24, 17);          // crate
    c.strokeStyle = '#6d4426'; c.lineWidth = 1.5;
    c.strokeRect(-12, 6, 24, 17);
    c.beginPath(); c.moveTo(0, 6); c.lineTo(0, 23); c.moveTo(-12, 14.5); c.lineTo(12, 14.5); c.stroke();
    c.fillStyle = LIGHT;  c.beginPath(); c.arc(0, -23, 3, 0, 7); c.fill();
  } else if (design === 'royal') {
    // Classic shape plus side mirrors, roof luggage rack and two headlights
    c.fillStyle = body;   rr(c, -16, -13, 32, 36, 7); c.fill();
    c.fillStyle = YELLOW; rr(c, -11, -25, 22, 16, 8); c.fill();
    c.fillStyle = '#cfd8dc'; c.beginPath(); c.arc(-18, -10, 3, 0, 7); c.arc(18, -10, 3, 0, 7); c.fill();
    c.fillStyle = ROOF;   rr(c, -11, -6, 22, 24, 5); c.fill();
    c.strokeStyle = YELLOW; c.lineWidth = 1.5;                    // luggage rack
    c.strokeRect(-7, -2, 14, 16);
    c.beginPath(); c.moveTo(-2.5, -2); c.lineTo(-2.5, 14); c.moveTo(2.5, -2); c.lineTo(2.5, 14); c.stroke();
    c.fillStyle = LIGHT;  c.beginPath(); c.arc(-5, -22, 2.5, 0, 7); c.arc(5, -22, 2.5, 0, 7); c.fill();
  } else {
    // Classic
    c.fillStyle = body;   rr(c, -16, -13, 32, 36, 7); c.fill();
    c.fillStyle = YELLOW; rr(c, -11, -25, 22, 16, 8); c.fill();
    c.fillStyle = ROOF;   rr(c, -11, -6, 22, 24, 5); c.fill();
    c.fillStyle = YELLOW; c.fillRect(-11, 4, 22, 4);
    c.fillStyle = LIGHT;  c.beginPath(); c.arc(0, -23, 3, 0, 7); c.fill();
  }

  c.restore();
}

// Rounded rectangle path
function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function updateHud() {
  coinsEl.textContent = '🪙 ' + coins;
  lapEl.textContent = mode === 'race'
    ? 'Lap ' + Math.min(lapIndex + 1, RACE_LAPS) + '/' + RACE_LAPS
    : 'Lap ' + (lapIndex + 1);
  timerEl.textContent = formatTime(raceTime);
}

// ---------- 12. Screen size ----------
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

// ---------- 13. Main loop ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);   // cap so a pause can't cause a huge jump
  last = now;

  update(dt);

  // Clear the flash message when its time is up
  flashTimer -= dt;
  if (flashTimer <= 0) flash = '';

  draw();
  updateHud();
  requestAnimationFrame(loop);
}

// ---------- Start ----------
resetRun();
setMuted(muted);
showBest();
renderGarage();
resize();
requestAnimationFrame(loop);
