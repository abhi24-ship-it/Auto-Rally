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

<!-- Add each new prompt below as "## Prompt N – short title", in order. -->
