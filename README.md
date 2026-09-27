# Space Mobs Shooter

An arcade space shooter where you pilot a Phantom through endless waves of Minecraft-style mobs and face a new boss every fifth wave. It runs in any modern browser on PC or phone and supports gamepads. It can also run as a desktop app.

Made by **MrGamerKing** · [YouTube](https://www.youtube.com/@MrGamerKingOfficial)

## Play

- **In a browser:** open `index.html`. No install or build step is needed.
- **On GitHub Pages:** upload the contents of this folder to a repository, go to **Settings → Pages**, pick **Deploy from a branch**, and choose `main` with the `/ (root)` folder. The game will be live at `https://<your-username>.github.io/<repo-name>/`.
- **As a desktop app (Electron):** run `npm install`, then `npm start`.

## Controls

| Action | Keyboard / mouse | Touch | Gamepad |
| --- | --- | --- | --- |
| Fly | WASD / arrows, or hold left click | Drag anywhere (the ship copies your finger's movement) | Left stick / D-pad |
| Shoot | Automatic (toggle with **F**), or hold Space | Automatic | A / RT |
| Dash (you can't be hit while dashing) | Shift / K | Flick (quick swipe) or the dash button | B / RB |
| Nova bomb | B / right click | Two-finger tap or the nova button | X / Y / LB |
| Pause | Esc / P | Pause button | Start |

The Settings screen switches touch controls to a floating joystick or a left-handed layout. It also sets your starting hearts (1–10) and the difficulty.

## Bosses

A boss arrives every 5 waves, and each has its own attacks:

| Wave | Boss | Signature moves |
| --- | --- | --- |
| 5 | The Warden | Sonic volleys, sonic boom beams, summons |
| 10 | The Wither | Exploding skulls, homing blue skulls, grows armor at half health |
| 15 | Elder Guardian | An eye laser that follows you, spike bursts, a Mining Fatigue curse that slows you |
| 20 | Ender Dragon | End Crystals that heal it, acid breath clouds, swoops |
| 25 | Ravager | Charges at you, a roar that pushes you back, falling boulders |
| 30 | Magma King | Bouncing fire rings, a slam that lands where you are, lava pools |
| 35 | Blaze King | A spinning rod shield that blocks your bullets, fire pillars |
| 40 | The Illusioner | Mirror clones, evoker fangs, arrow rain, blindness |
| 45 | Ghast Queen | Fireballs you can shoot back, crying rain, a scream |
| 50 | Phantom Overlord | Dive bombs, phantom swarms, walls of wind |

After wave 50 the bosses return as **MK II**, then **MK III**, and so on. Each return brings a new colour, more HP, more bullets, faster attacks and new moves.

## Features

- Ten regular mobs:
  - **Zombie:** slow and tanky.
  - **Skeleton:** aimed arrows.
  - **Creeper:** hunts you, explodes and drops TNT.
  - **Vex:** fast diving swarms.
  - **Evoker:** summons vex.
  - **Slime:** splits into smaller slimes.
  - **Blaze:** fireball bursts.
  - **Enderman:** teleports, dodges and lunges.
  - **Shulker:** armored while closed, fires homing bullets.
  - **Ghast:** fireballs you can shoot back.
- Gold **elite** mobs from wave 7.
- Mob health rises smoothly every wave. Your weapon also gets stronger with every boss you beat, so the game stays balanced.
- Power-ups:
  - Weapon stars (up to level 5, then +10% power each).
  - Overdrive, shield, magnet and 2x score.
  - **Time Warp** (clock), **Thunderstorm** (trident), **Allay drones** and **Totem of Undying** (an extra life).
- The Nova bomb recharges only from mobs **you** kill and from grazing bullets. Kills made by the Nova itself don't recharge it.
- A combo multiplier up to x8, perfect-wave bonuses, 19 trophies and a local high-score board.
- Four space zones, mobs that shatter into pieces, screen shake, slow motion, and music and sound effects generated in code.

## Files

Everything the game needs is in this one folder, with no subfolders:

```
index.html     menus, HUD and screens
game.css       all styling and animations
settings.js    saved settings and high scores
trophies.js    trophies (achievements)
audio.js       generated sound effects and music (Web Audio)
input.js       keyboard, mouse, touch gestures, joystick and gamepad
bosses.js      all 10 bosses and their attacks
game.js        game engine: rendering, mobs, waves, power-ups and particles
ui.js          menus, HUD updates and startup
*.png          sprites and images
main.js        Electron entry point for the desktop app
```

For testing, open the browser console: `Game.debug.boss(4)` jumps straight to the Ender Dragon, and `Game.debug.god()` makes you invincible.
