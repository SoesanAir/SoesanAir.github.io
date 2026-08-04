# Castaway — Web Edition

A no-engine (plain HTML/CSS/JS) landscape-mobile port of the Castaway Unity simulation.
Every mechanic is ported from the Unity C# source: relationship math, trust, grudges,
vote weights, the four-gate voting algorithm, alliances (player-anchored + NPC pairs),
the lying/belief system, challenges (all 28), weather, medivacs/quits, tribe swap (day 8),
merge (day 14), jury of 7, final 2, and the aftershow.

## Run it

Any static server works — from this folder:

```
py -3.14 -m http.server 8080
```

then open http://localhost:8080 — on a phone, use your PC's LAN IP and rotate to landscape.
(Double-clicking index.html mostly works too, but a server is more reliable for canvas image data.)

## Structure

| File | Role |
|---|---|
| `index.html` | screen-stack shell (title / create / camp / challenge / tribal / reveal / finale / aftershow) |
| `css/style.css` | "Chunky by Day, Ritual by Night" design system (locked art direction) |
| `js/data.js` | GameConfig port + 28 challenges + 15 trait clusters + name/occupation pools + dialogue |
| `js/sim.js` | the simulation: relationships, social ticks, alliances, lying, vote weights, voting gates, jury |
| `js/ui.js` | screen stack, toasts, modal, sprite recolor factory (6 bodies -> whole cast via skin+outfit tint) |
| `js/game.js` | season orchestration + all screens' logic |
| `assets/bodies/` | the 6 master body sprites (defringed, transparent) |

## Save

One season, auto-saved to localStorage at each dawn. Returning players persist
across seasons (20% chance one shows up, +0.1 game awareness).

## Testing

`scratchpad/test_bundle.js` runs 5 full headless seasons and asserts:
18 cast, 16 eliminations, 7 jurors, 2 finalists, clamped values. All pass.
