# Space Mobs Shooter

An arcade space shooter where you pilot a Phantom through waves of Minecraft mobs and face the Warden every fifth wave. It runs in any modern browser on PC or phone and supports gamepads. It can also run as a desktop app.

Made by **MrGamerKing** · [YouTube](https://www.youtube.com/@MrGamerKingOfficial)

## Play

- **In a browser:** open `index.html`. No install or build step is needed.
- **On GitHub Pages:** push this folder to a repository, go to **Settings → Pages**, pick **Deploy from a branch**, and choose `main` with the `/ (root)` folder. The game will be live at `https://<your-username>.github.io/<repo-name>/`.
- **As a desktop app (Electron):** run `npm install`, then `npm start`.

## Controls

| Action | Keyboard / mouse | Touch | Gamepad |
| --- | --- | --- | --- |
| Fly | WASD / arrows, or hold left click | Drag anywhere (the ship copies your finger's movement) | Left stick / D-pad |
| Shoot | Automatic (toggle with **F**), or hold Space | Automatic | A / RT |
| Dash (you can't be hit while dashing) | Shift / K | Flick (quick swipe) or the dash button | B / RB |
| Nova bomb | B / right click | Two-finger tap or the nova button | X / Y / LB |
| Pause | Esc / P | Pause button | Start |

The Settings screen switches touch controls to a floating joystick.

## Features

- Five mob types, each with its own AI: zombies, sniping skeletons, homing creepers that drop TNT, diving vex swarms and summoning evokers.
- A three-phase Warden boss fight with a telegraphed Sonic Boom beam.
- Five weapon levels (level 5 adds homing missiles), plus overdrive, shield, magnet, double-score and heart power-ups.
- A combo multiplier up to x8, bullet grazing, perfect-wave bonuses, and a local high-score board.
- Four space zones, particle explosions, screen shake, slow motion, and music and sound effects generated in code.
- Adjustable volume, graphics quality, sensitivity, vibration and more.

## Project layout

All files live together in a single folder — no subfolders, every reference is a plain filename.

```
index.html   menus, HUD and screens
game.css     all styling and animations
settings.js  saved settings and high scores
audio.js     generated sound effects and music (Web Audio)
input.js     keyboard, mouse, touch gestures, joystick and gamepad
game.js      game engine: rendering, mobs, boss, waves and particles
ui.js        menus, HUD updates and startup
*.png        sprites and images
main.js      Electron entry point for the desktop app
```
