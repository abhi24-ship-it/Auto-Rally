# Auto Rally

A cute auto-rickshaw racing game for phones and laptops. Steer the auto down a
looping road, grab coins, dodge cones and potholes, hit the ⚡ boost, and finish
3 laps as fast as you can. Works offline (flight mode) once it has been opened
online one time.

Project 8 of the GenAI Internship Week 2 projects.

## Features (mapped to "What to build")

| # | Requirement | How it is done |
|---|---|---|
| 1 | Driveable auto-rickshaw on a looping road | Auto drawn on an HTML canvas. The road's curve is built from sine waves that repeat exactly every lap, so the road loops. A checkered line marks start/finish. |
| 2 | Keyboard and touch controls | Arrow keys or A / D on a keyboard. Big ◀ ▶ buttons on screen for touch (hold to steer). |
| 3 | Coins, obstacles, at least one power-up | 🪙 coins (counted), cones and potholes (crash = 1 second slowdown), ⚡ boost (3 seconds of extra speed). Driving on the grass also slows you down. |
| 4 | 3 laps with a timer | Lap counter and race timer at the top. Lap times shown at the end. |
| 5 | Best time that stays saved | Saved in the browser's `localStorage`, so it survives closing the app or restarting the phone. |
| 6 | Sound with a mute button | Sounds are generated with the Web Audio API (engine, coin, crash, boost, lap, finish). 🔊 / 🔇 button at the top right (or press M). Mute choice is also saved. |

Offline: `sw.js` (a service worker) stores all game files on the device the first time
the game is opened, and serves them from there afterwards.

## Files

| File | What it does |
|---|---|
| `index.html` | Page layout, styles, the top bar (coins / lap / timer / mute), touch buttons and the start/finish screen. Registers the service worker. |
| `game.js` | The whole game: road, auto, items, controls, collisions, laps, timer, sound, saving the best time. Split into numbered sections with comments. |
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

(Opening `index.html` by double-clicking also plays the game, but offline caching
needs the server.)

## Put it on your phone (free, permanent)

Using GitHub Pages (no git install needed, everything in the browser):

1. Sign in at github.com and create a new **public** repository, e.g. `auto-rally`.
2. Click **Add file → Upload files** and drag in every file from the `auto-rally` folder.
   Click **Commit changes**.
3. Go to **Settings → Pages**. Under *Branch* choose `main` and `/ (root)`, click **Save**.
4. After a minute your game is at `https://<your-username>.github.io/auto-rally/`.
5. On the phone, open that link in Chrome (Android) or Safari (iPhone) **while online**.
6. Install it: Chrome menu ⋮ → **Add to Home screen / Install app**
   (Safari: Share → **Add to Home Screen**).
7. Turn on flight mode and open the game from the home-screen icon.

If you change any file later, also change `CACHE = 'auto-rally-v3'` in `sw.js` to a new
number (`v4`, `v5`…), upload again, then open the game online once so phones get the new version.

## How to test every "Done when" item

| Done when | How to test | Result |
|---|---|---|
| A full race plays on a real phone in flight mode | Install from the https link (steps above), turn on flight mode, close the browser, open the game from the home screen, play all 3 laps. | Laptop: tested (server stopped, page reloaded from cache, race ran). **Phone: you need to test.** |
| A friend finishes a race with no instructions from you | Hand the phone to a friend and say nothing. The start screen explains the controls. Note anything that confused them. | **You need to test.** |
| Crashes and lap counts feel fair | Watch the lap counter change exactly when you cross the checkered line. Hit a cone: you slow for 1 second, then speed back up; the same cone can't hit you twice. Track layout is the same every lap and every race. | Laps and crash logic tested on laptop with an automated 3-lap run. **Feel: you need to judge on the phone.** |
| The best time survives a restart | Finish a race, note the best time. Close the app fully (or restart the phone), open again: "Best time" on the start screen is the same. A slower race does not replace it. | Laptop: tested (reload kept 1:26.3; a slower 2:15.9 race did not replace it). **Phone restart: you need to test.** |

Extra checks:
- Keyboard: arrow keys and A / D steer. M toggles mute.
- Touch: hold ◀ / ▶ to steer; both can be used with two thumbs.
- Mute: tap 🔊 → becomes 🔇 and all sound stops; reload → it stays muted.
- Reset the saved best time (for testing): in the browser console run
  `localStorage.removeItem('autoRallyBestMs')`.

## How the game works (for presenting)

- **Game loop** – `loop()` runs about 60 times a second: `update()` moves everything,
  `draw()` paints the frame, `updateHud()` refreshes the top bar.
- **Road** – The auto stays at a fixed spot on screen and the road scrolls past it.
  `roadCenter(distance)` gives the road's centre for any distance travelled. It repeats
  every `LAP_LENGTH`, which is what makes the track loop.
- **Items** – `buildItems()` creates one lap of coins, obstacles and boosts using a
  fixed-seed random generator (same layout every race, so times are comparable) and
  copies it for all 3 laps.
- **Collisions** – Each frame, items near the auto are checked: if the distance between
  them is small enough, it is a hit.
- **Laps and timer** – `lap = floor(distance / LAP_LENGTH)`. When it reaches 3 the race ends.
- **Best time** – compared and stored in `localStorage` in `finishRace()`.
- **Sound** – Web Audio oscillators create beeps and an engine hum, so there are no sound
  files. Browsers only allow sound after a tap, so audio starts on "Start race".
- **Offline** – `sw.js` caches the files on first visit and serves them when there is no network.
