# Prompts used to build Auto Rally

Prompts are listed in the order they were used. Agent: Claude Code (Claude desktop app).

## Prompt 1 – Plan and first working version

> WHO: You are an experienced software developer helping me complete a GenAI internship project.
> WHAT: I am building Project 8 — Auto Rally from the attached Week 2 Projects PDF.
> GOAL: Meet every mandatory "What to build" feature and every "Done when" condition. Do not add optional extras or overengineer the project.
> DO:
> 1. Read the relevant PDF page thoroughly.
> 2. Identify all mandatory requirements.
> 3. List external software, dependencies, permissions and test files required.
> 4. Recommend the simplest practical implementation.
> 5. Build the working project incrementally.
> 6. Give me exact installation and execution commands.
> 7. Help me test every mandatory requirement.
> 8. Create a README with installation, execution and test instructions.
> 9. Help maintain a prompts.md file documenting the prompts used.
>
> RULES:
> * Prefer free, offline functionality without paid APIs.
> * Use sample data wherever possible.
> * Keep the code simple and understandable for a beginner.
> * Avoid unnecessary frameworks, files and dependencies.
> * Do not claim a feature works without testing it.
> * Do not replace mandatory working features with mockups.
> * Ask me to perform real-device or browser tests when necessary.
> * Explain what each major component does so I can present it.
>
> First, produce a short implementation plan and the exact external requirements. Then begin with the simplest working version.

**Result:** Plain HTML + canvas + JavaScript game (`index.html`, `game.js`), service worker
and manifest for offline/install, generated icons, README. Tested on a laptop browser with
an automated 3-lap run, control/mute/collision checks, best-time-after-reload check and an
offline reload with the server stopped.

## Prompt 2 – Installing on a phone

> how do i make it like an app that can be downloaded on my phone
> Its working on the laptop

**Result:** No code change needed. The game is already an installable web app (PWA):
host it free on GitHub Pages (https), open the link on the phone once, then use
"Add to Home screen" / "Install app". Steps are in the README.

## Prompt 3 – GitHub Pages setup problem

> (Quoting the step "Go to Settings, then Pages… choose main and / (root), then click Save")
> not able to do this step

**Result:** Troubleshooting checklist for GitHub Pages (Source must be "Deploy from a
branch", repo must be public, files must be committed so the `main` branch exists).

## Prompt 4 – Screenshot of repository settings

> (Screenshot of GitHub Settings → General for the "Auto-Rally" repository)

**Result:** The screenshot showed "Upgrade or make this repository public", so the repo was
private. Fix: Settings → General → Danger Zone → Change visibility → Make public, then
Settings → Pages → Deploy from a branch → main, / (root) → Save.

## Prompt 5 – Screenshot after making the repo public

> (Screenshot of GitHub Settings → General, repository now public)

**Result:** Confirmed the repo is now public (Wiki tab and Moderation settings appeared,
upgrade banner gone). Next step: Settings → Pages → Deploy from a branch → main, / (root) → Save.

## Prompt 6 – Screenshot of the Pages settings

> (Screenshot of Settings → Pages: Deploy from a branch, main, / (root))

**Result:** Settings were correct and all files were at the repo root, but the site still
returned 404 and no "pages build and deployment" run had started. Next step: check the
Actions tab, allow Actions if disabled, and trigger a build with a small commit.

## Prompt 7 – Screenshot of an empty Actions tab

> (Screenshot of the Actions tab showing "Get started with GitHub Actions")

**Result:** No Pages build had ever run, because the files were uploaded before Pages was
switched on. Fix: make one small commit (edit README.md) to start the
"pages build and deployment" run. Do not configure any of the suggested workflows.

## Prompt 8 – Check the site after the commit

> Done, check it

**Result:** "pages build and deployment" succeeded. All 7 files load (HTTP 200) from
https://abhi24-ship-it.github.io/Auto-Rally/ and the online index.html, game.js, sw.js and
manifest.json are identical to the locally tested files. Next: install on the phone and run
the flight-mode tests.

## Prompt 9 – Phone test results

> All tests passed

**Result:** All four "Done when" items passed on a real phone: a flight-mode race, a friend
finishing with no instructions, fair crashes and laps, and the best time surviving a restart.
README test table updated with the results and the live link.

## Prompt 10 – Endless mode, harder crashes and a coin shop

> Now the game looks pretty easy
> Make sure its not only 3 laps
> Make it unlimited laps it should be an endless game
> But if i hit any cone then the game should end
> similarly if i hit the border of the track then the game should end and i should be restarting the game from 0
> Try adding some use for the coins as the collection of the coins seam pointless
> Make sure you can do something like using coins to change the color of the auto or change the design of the auto
> Make 3 new auto designs and different colors (black-green,black-red,black-black) max 3 colors

Agent's clarifying questions and my answers:
- Endless only would drop the PDF's "3 laps with a timer" requirement. → **Two modes**: 3-Lap Race + Endless.
- What should potholes do? → **Pothole slows you** (only cones and the border end the game).

**Result:** Two modes. Cone or track edge = game over and restart from 0. Endless gets
10% faster per lap (max 1.5x) with a new layout and more cones each lap. Coins are saved in
a wallet and spent in a Garage: 3 new designs (Sport 30, Cargo 60, Royal 100) and 3 colours
(Black-Green free, Black-Red 20, Black-Black 40). Separate saved bests for race and endless.
Tested on laptop: full race, 6+ endless laps, cone/edge/pothole, shop, reload persistence.

## Prompt 11 – Updating the GitHub version

> I had already put the previous versions of that inmy github
> How do i update it now ?

**Result:** Upload the changed files to the same repo (same names replace the old ones),
wait for the Pages build, then open the app online twice on the phone. `sw.js` already has
the new cache number (v5), so phones pick up the new version.

<!-- Add each new prompt below as "## Prompt N – short title", in order. -->
