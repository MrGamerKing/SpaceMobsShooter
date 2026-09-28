# Space Mobs Shooter

An arcade space shooter where you pilot a Phantom through endless waves of Minecraft-style mobs and face a new boss every fifth wave. It runs in any modern browser on PC or phone and supports gamepads. It can also run as a desktop app.

Made by **MrGamerKing** · [YouTube](https://www.youtube.com/@MrGamerKingOfficial)

## Play

- **In a browser:** open `index.html`. No install or build step is needed.
- **On GitHub Pages:** upload the contents of this folder to a repository, go to **Settings → Pages**, pick **Deploy from a branch**, and choose `main` with the `/ (root)` folder. The game will be live at `https://<your-username>.github.io/<repo-name>/`.
- **As a desktop app (Electron):** run `npm install`, then `npm start`.

## Startup

The game opens with an intro: the **VarexGames** studio logo, then **Made in Pakistan**, then the title screen with its music. Press any key, click or tap to go to the main menu. You can also press a key during the splash screens to skip them.

The game logo is drawn in code (in `intro.js`), so it stays sharp on every screen size.

Browsers only allow sound after your first click, tap or key press, so in a browser the music starts when you continue from the title screen (or earlier, if you clicked during the intro). The desktop app plays the intro sounds straight away.

To skip the intro while testing, open `index.html#nointro`.

## Game modes

Press **PLAY** and pick a mode:

- **Arcade:** choose the difficulty (Easy, Normal or Hard) and your starting hearts (1–10). After every boss your run is saved at a **checkpoint**. From the Arcade screen (or the **Continue** button on the main menu, or the game-over screen) you can continue from the last checkpoint with full hearts, or start a **New Game**. A new game asks you to confirm first, because it erases the checkpoint.
- **Hardcore:** there are no saves: if you die, you start again from wave 1. The difficulty is always **Hard**, and you can never gain extra hearts beyond the ones you start with. Choose one of three challenges:

| Challenge | Hearts | Rules | Score bonus |
| --- | --- | --- | --- |
| Extreme | 5 | Heart pickups heal you up to 5. A Totem of Undying revives you with 3 hearts. | ×1.25 |
| Insane | 3 | Heart pickups heal you up to 3. A Totem of Undying revives you with 3 hearts. | ×1.5 |
| Brutal | 1 | Hearts never drop, only Totems of Undying (which drop a little more often). A totem revives you with 1 heart. | ×2 |

Beating a boss in each Hardcore challenge unlocks a trophy.

## Controls

| Action | Keyboard / mouse | Touch | Gamepad |
| --- | --- | --- | --- |
| Fly | WASD / arrows, or hold left click | Drag anywhere (the ship copies your finger's movement) | Left stick / D-pad |
| Shoot | Automatic (toggle with **F**), or hold Space | Automatic | A / RT |
| Dash (you can't be hit while dashing) | Shift / K | Flick (quick swipe) or the dash button | B / RB |
| Nova bomb | B / right click | Two-finger tap or the nova button | X / Y / LB |
| Pause | Esc / P | Pause button | Start |

The Settings screen switches touch controls to a floating joystick or a left-handed layout. It also sets your Arcade starting hearts (1–10) and difficulty.

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

**How boss fights work:**

- **Health scales with your firepower.** On Normal a fight lasts about 30–40 seconds for the first bosses and about a minute for the later ones. Weapon upgrades still speed you up.
- **Shields:** at every new phase the boss raises a shield. Break it to **stun** the boss for about 2.5 seconds; it takes ×1.5 damage while stunned, and it drops a heart (or a power-up if your hearts are full).
- **Harassment and combos:** bosses fire aimed shots between attacks and chain attacks together in later phases. Below Hard, these shots leave a gap where you stand and only aim ahead of you in the final phase.
- **Last Stand:** at 10% health every boss unleashes its own ultimate attack.
- **Berserk:** if a fight drags on for a long time, the boss speeds up.
- **Hard mode:** bosses have more HP, attack faster and fire extra bullets. From the second boss on, their heavy hits (beams, slams, lasers, charges) cost **2 hearts**.

To rebalance boss fights, edit the `DIFF` table near the top of `game.js` (boss HP `bhp`, attack speed `tempo`, extra bullets `tier`, gap between pot-shots `harass`), or a boss's `hpw` value in `bosses.js`.

## Skins

Pick a look for your flyer on the **SKINS** screen in the main menu. Skins only change the look and the engine-trail colour. Your hitbox stays the same.

Phantom (the original), Steve with an elytra, Alex with an enchanted elytra, Ender Dragon, Allay, Bee, Parrot, Bat, Blaze, Ghast and Nightmare Phantom.

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
- A combo multiplier up to x8, perfect-wave bonuses, 22 trophies and a local high-score board.
- Four space zones, mobs that shatter into pieces, screen shake, slow motion, and music and sound effects generated in code.

## Files

Everything the game needs is in this one folder, with no subfolders:

```
index.html     menus, HUD and screens
game.css       all styling and animations
settings.js    saved settings, high scores, Arcade checkpoint and Hardcore challenge rules
trophies.js    trophies (achievements)
audio.js       generated sound effects and music (Web Audio)
input.js       keyboard, mouse, touch gestures, joystick and gamepad
skins.js       the list of player skins
bosses.js      all 10 bosses and their attacks
game.js        game engine: rendering, mobs, waves, power-ups and particles
intro.js       startup intro (VarexGames, Made in Pakistan, title screen) and the game logo
ui.js          menus, HUD updates and startup
*.png          sprites and images
main.js        Electron entry point for the desktop app
```

For testing, open the browser console: `Game.debug.boss(4)` jumps straight to the Ender Dragon, and `Game.debug.god()` makes you invincible. `Game.debug.autopilot('dodge')` lets a simple bot fly and dodge; in god mode, `Game.debug.info().botHits` counts the hearts you would have lost.
