# Auto Rally

A cute auto-rickshaw racing game for phones and laptops. Steer the auto down a
looping road, grab coins, dodge cones, avoid potholes and hit the ⚡ boost.
Hitting a cone or the edge of the track ends the game. Spend your coins in the
Garage on new auto designs and colours. Works offline (flight mode) once it has
been opened online one time.

Live version: https://abhi24-ship-it.github.io/Auto-Rally/

Project 8 of the GenAI Internship Week 2 projects.

## Game modes

| Mode | What happens | What is saved |
|---|---|---|
| **3-Lap Race** | Finish 3 laps as fast as you can. Same track layout every lap and every race. | Best (fastest) race time. A crashed race saves no time. |
| **Endless** | Unlimited laps. Each lap is 10% faster (up to 1.5x), has a new layout and more cones. | Longest survival time and the laps you finished. |

Rules in both modes:
- 🔺 **Cone** or the **red-white track edge** → game over. You start again from 0.
- ⚫ **Pothole** → you slow down for 1 second (not game over).
- ⚡ **Boost** → 3 seconds of extra speed.
- 🪙 **Coins** → go into your wallet and are saved straight away, even if you crash.

## Garage (what coins are for)

On the start screen, tap a design or colour. If you own it, it's selected. If not, it is
bought with your coins (if you have enough) and selected. Purchases and your choice are saved.

| Designs | Price | | Colours (roof is always black) | Price |
|---|---|---|---|---|
| Classic | free | | Black-Green | free |
| Sport (pointed nose, racing stripes, spoiler) | 🪙 30 | | Black-Red | 🪙 20 |
| Cargo (small cabin, wooden crate at the back) | 🪙 60 | | Black-Black | 🪙 40 |
| Royal (side mirrors, roof luggage rack, twin lights) | 🪙 100 | | | |

Any design can be combined with any colour (12 looks).

## Features (mapped to "What to build")

| # | Requirement | How it is done |
|---|---|---|
| 1 | Driveable auto-rickshaw on a looping road | Auto drawn on an HTML canvas. The road's curve is built from sine waves that repeat exactly every lap, so the road loops. A checkered line marks start/finish. |
| 2 | Keyboard and touch controls | Arrow keys or A / D on a keyboard. Big ◀ ▶ buttons on screen for touch (hold to steer). |
| 3 | Coins, obstacles, at least one power-up | 🪙 coins (spent in the Garage), cones (game over), potholes (slow down), track edge (game over), ⚡ boost power-up. |
| 4 | 3 laps with a timer | "3-Lap Race" mode: lap counter and timer at the top, lap times shown at the end. Endless mode also shows laps and the timer. |
| 5 | Best time that stays saved | Best race time and best endless time are saved in the browser's `localStorage`, so they survive closing the app or restarting the phone. |
| 6 | Sound with a mute button | Sounds are generated with the Web Audio API (engine, coin, bump, crash, boost, lap, finish, buy). 🔊 / 🔇 button at the top right (or press M). Mute choice is also saved. |

Offline: `sw.js` (a service worker) stores all game files on the device the first time
the game is opened, and serves them from there afterwards.

## Files

| File | What it does |
|---|---|
| `index.html` | Page layout, styles, the top bar (coins / lap / timer / mute), touch buttons, start/game-over screen with the two mode buttons and the Garage. Registers the service worker. |
| `game.js` | The whole game: road, auto designs, items, controls, collisions, laps, timer, sound, Garage, saving. Split into numbered sections with comments. |
| `sw.js` | Service worker that caches the files so the game runs in flight mode. |
| `manifest.json` | Lets the phone install the game as an app (name, icon, full screen). |
| `icon-192.png`, `icon-512.png` | App icons. |
| `prompts.md` | The prompts used to build this project. |

## Requirements

- A modern browser: Chrome / Edge on a laptop, Chrome on Android, or Safari on iPhone.
- To run it locally on a laptop: **Python 3** (only used as a simple local web server).
- To play on a phone offline: the folder must be hosted on an **https://** address once
  (free with GitHub Pages, see below). Service workers only work on https or localhost.

No npm, no libraries, no paid APIs, no login, no internet needed while playing.

## Run on your laptop

Open PowerShell in the `Week_2_projects` folder and run:

```bash
python -m http.server 8000 --directory auto-rally
```

Then open http://localhost:8000 in Chrome. Stop the server with `Ctrl + C`.

## Put it on your phone (free, permanent)

Using GitHub Pages (no git install needed, everything in the browser):

1. Sign in at github.com and create a new **public** repository (free accounts can't use
   Pages on private repos).
2. Click **Add file → Upload files** and drag in every file from inside the `auto-rally`
   folder (the files, not the folder). Click **Commit changes**.
3. Go to **Settings → Pages**. Source: **Deploy from a branch**. Branch: `main`, `/ (root)`. **Save**.
4. If no build starts (Actions tab is empty), make any small commit, e.g. edit README.md.
5. After the green ✓ in Actions, the game is at `https://<your-username>.github.io/<repo-name>/`.
6. On the phone, open that link **while online** and install it:
   Chrome ⋮ → **Install app** (iPhone Safari: Share → **Add to Home Screen**).
7. Open it once from the icon, then turn on flight mode — it still works.

### Updating the game later

1. Change `CACHE = 'auto-rally-v5'` in `sw.js` to the next number (`v6`, `v7`…).
2. Upload the changed files to the repo (**Add file → Upload files**, same names replace the old ones).
3. Wait for the green ✓ in Actions, then open the game on the phone **while online**, close it
   fully and open it again. The second open uses the new version.

## How to test every "Done when" item

| Done when | How to test | Result |
|---|---|---|
| A full race plays on a real phone in flight mode | Install from the https link, turn on flight mode, close the app, open it from the home screen, play a full 3-Lap Race. | Version 1: passed on laptop and phone. Version 2: passed on laptop (automated 3-lap race finished in 1:13.4). **Phone: re-test after uploading.** |
| A friend finishes a race with no instructions from you | Hand the phone to a friend and say nothing. The start screen explains the rules. | Version 1: passed on the phone. **Version 2: re-test (new rules are harder).** |
| Crashes and lap counts feel fair | Lap counter changes exactly at the checkered line. Cone/edge = game over only when the auto actually touches it. Potholes can't be hit twice. Race mode layout is identical every lap. | Laptop: tested (edge game over at 71 units from centre, limit 70; cone and pothole hit boxes checked). **Phone: judge the feel.** |
| The best time survives a restart | Finish a race and an endless run. Close the app fully (or restart the phone), open again: both bests are still shown. A worse run does not replace them. | Laptop: tested (bests, wallet, bought items and chosen auto all survived a reload; a crashed race and a shorter endless run didn't replace the bests). **Phone restart: re-test.** |

Extra checks for version 2:
- Endless: you can pass lap 3 and keep going; the lap counter shows "Lap 4", "Lap 5"…
- Hold ◀ from the start: the auto hits the edge and the game ends.
- Garage: try to buy Sport with fewer than 30 coins → "You need … more coins". With enough
  coins it is bought, the wallet goes down, and it stays bought after closing the app.
- Keyboard: arrow keys and A / D steer. M toggles mute.
- Reset everything saved (for testing): in the browser console run `localStorage.clear()`.

## How the game works (for presenting)

- **Game loop** – `loop()` runs about 60 times a second: `update()` moves everything,
  `draw()` paints the frame, `updateHud()` refreshes the top bar.
- **Road** – The auto stays at a fixed spot on screen and the road scrolls past it.
  `roadCenter(distance)` gives the road's centre for any distance travelled. It repeats
  every `LAP_LENGTH`, which is what makes the track loop.
- **Items** – `lapItems(lap)` creates one lap of coins, cones, potholes and boosts with a
  seeded random generator. Race mode always uses the same seed (fair times). Endless uses a
  new seed each lap and a higher cone chance. The next lap is added when you start a lap,
  and items far behind you are removed, so endless mode never runs out of track.
- **Collisions and game over** – Each frame, items near the auto are checked by distance.
  If the auto is further than `EDGE_LIMIT` from the road centre, it has hit the border.
  `gameOver()` stops the run, saves the endless record, and shows the menu.
- **Difficulty** – `cruiseSpeed()` raises the speed 10% per lap in endless mode (max 1.5x).
  Steering gets a little quicker at high speed so the curves stay possible.
- **Laps and timer** – `lap = floor(distance / LAP_LENGTH)`. In race mode, lap 3 done = finish.
- **Garage** – `wallet`, `owned`, `myDesign` and `myColor` are saved in `localStorage`.
  `chooseItem()` buys or selects. `drawAuto()` draws the chosen design in the chosen colour,
  both in the game and in the Garage preview.
- **Sound** – Web Audio oscillators create beeps and an engine hum, so there are no sound
  files. Browsers only allow sound after a tap, so audio starts when you press a mode button.
- **Offline** – `sw.js` caches the files on first visit and serves them when there is no network.
