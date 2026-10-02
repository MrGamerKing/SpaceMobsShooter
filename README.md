# Space Mobs Shooter

An arcade space shooter where you pilot a Phantom through waves of Minecraft-style mobs and bosses, with a pet at your side. There are three games (Arcade, Boss Rush and Village Raid), each playable in Classic or Hardcore. Play alone or in online co-op with up to 3 friends. It runs in any modern browser on PC or phone and supports gamepads. It can also run as a desktop app.

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

Press **SINGLE PLAYER**, pick a **game**, then pick **Classic** or **Hardcore**.

**The three games:**

- **Arcade:** endless waves of mobs with a boss every 5 waves. This is the original game, and it has a secret.
- **Boss Rush:** no mobs, only bosses, all 11 back to back. Everyone starts with a level 3 gun. The faster you win a fight, the bigger the **speed bonus**. Finish all 11 for the **Boss Rusher** trophy... and something else comes for you. Then the bosses return as MK II.
- **Village Raid:** a village with houses and villagers sits at the bottom of the screen. Each **raid** is four waves of illagers (pillagers, vindicators, witches, evokers and their vexes) and then a **raid captain** boss (the Ravager first, then the Illusioner, then the rest). Every raider that gets past you burns a house and damages the village (20 health). If the village falls, the run is over. Winning a raid earns the **Hero of the Village** trophy and repairs part of the village.

**The two ways to play each game:**

- **Classic:** choose the difficulty (Easy, Normal or Hard) and your starting hearts (1–10). After every boss your run is saved at a **checkpoint**. Each game has its own checkpoint. From the Classic screen (or the **Continue** button on the main menu, which shows your newest checkpoint, or the game-over screen) you can continue from the last checkpoint with full hearts, or start a **New Game**. A new game asks you to confirm first, because it erases that game's checkpoint.
- **Hardcore:** there are no saves: if you die, you start again from the beginning. The difficulty is always **Hard**, and you can never gain extra hearts beyond the ones you start with. Choose one of three challenges:

| Challenge | Hearts | Rules | Score bonus |
| --- | --- | --- | --- |
| Extreme | 5 | Heart pickups heal you up to 5. A Totem of Undying revives you with 3 hearts. | ×1.25 |
| Insane | 3 | Heart pickups heal you up to 3. A Totem of Undying revives you with 3 hearts. | ×1.5 |
| Brutal | 1 | Hearts never drop, only Totems of Undying (which drop a little more often). A totem revives you with 1 heart. | ×2 |

Beating a boss in each Hardcore challenge unlocks a trophy. Best scores are kept separately for every game and challenge.

## Multiplayer (online co-op)

Up to 4 players can fight the waves and bosses together over the internet.

1. One player presses **MULTIPLAYER → CREATE ROOM** and picks a room name, a username and a password.
2. The others press **MULTIPLAYER → JOIN ROOM** and enter the same room name and password with their own username.
3. In the lobby everyone sees the player list with each player's skin and pet. The host picks the **game** (Arcade, Boss Rush or Village Raid), the mode (**Classic** with difficulty and hearts, or **Hardcore** with Extreme / Insane / Brutal) and the maximum number of players, can remove players, and presses **START GAME**. Players can still change their skin or pet in the lobby.

In the game every ship keeps its own skin, its own pet and a small name tag with its hearts. When a player loses a heart, a heart breaks above their ship; when they heal, a heart pops in.

- Everyone keeps their own character's move and special. The team shares the score, combo, special meter and power-ups (overdrive, shield, magnet and so on). Weapon stars, hearts and totems go to whoever grabs them.
- Mobs and bosses pick targets among the players, and their health grows with the size of the team.
- A player who goes down can **spectate** their teammates (switching between them) or **leave**. In Classic they warp back in at the start of the next wave (the next boss in Boss Rush). In Hardcore there are no respawns.
- The run ends when the whole team is down. Everyone can then go **back to the lobby** and play again.
- The pause menu doesn't stop a co-op game; it only opens the menu for you.
- Co-op runs aren't saved as checkpoints. They go on the leaderboard with a **CO-OP** tag.

**How it works:** there is no game server. The room creator (the host) runs the game on their own device, and the other players connect straight to them with WebRTC, using [PeerJS](https://peerjs.com) (MIT license, included as `peerjs.min.js`). PeerJS's free public service only introduces the players to each other. The game data then goes directly between devices, or through your relay server if you set one up (see below). So the host should keep the game open and in front while playing. Everyone needs an internet connection.

### Playing with friends far away (different internet or mobile data)

Players on the **same Wi-Fi** connect directly. Players on **different internet connections** often can't reach each other directly: many routers and mobile networks (especially "carrier NAT", common on 4G and on many home connections) block it. Then the game needs a **relay server** (called TURN) to pass the game data between you. Free public relays that need no sign-up no longer exist (PeerJS's old ones are gone), so set up your own free one:

1. Make a free account with a relay provider, for example [ExpressTURN](https://www.expressturn.com) or [Metered](https://www.metered.ca/stun-turn). Check their current free-plan limits.
2. Copy your relay details:
   - **ExpressTURN:** the server address (like `turn:relay1.expressturn.com:3478`), username and password.
   - **Metered:** the "TURN credentials" API link (`https://YOURAPP.metered.live/api/v1/turn/credentials?apiKey=…`), or an address with username and password.
3. Put them in the game, in **one** of these two ways:
   - **In the game (private):** MULTIPLAYER → the yellow **SET UP A RELAY** line (or Settings → Online → SETUP). Paste the details, press **TEST**, then **SAVE**. They're saved only on that device. The host having a relay is usually enough, but it works best if every player adds it.
   - **For everyone (public):** put them in `netconfig.js` (`relayLink`, or an entry in `relays`) and upload it. Then every copy of your game uses the relay with no setup. Anything in that file is public on GitHub, so other people could use up your relay's free allowance.

If a friend still can't join, the game says **"Found the room, but your two internet connections can't reach each other"**, with a button that opens the relay setup.

Relays add a little delay, and the game only uses one when a direct connection isn't possible.

The shared world is shaped to suit everyone's screens. On a very different screen (for example a phone held upright while the host uses a PC) the world is scaled to fit, with dark bars around it. Turning the phone sideways gives a bigger view.

**Safety on GitHub:**

- The repository contains no passwords, keys or server secrets, so it's safe to publish.
- Room passwords are typed while playing and are never stored or sent. A room's address is a SHA-256 fingerprint of its name and password, so nobody can find a room without the password. Joining also has to prove the password with a second fingerprint.
- Usernames and room names are cleaned (letters, numbers and a few symbols, 12 / 20 characters max) and always shown as plain text.
- The host checks every message from the other players and ignores floods or impossible values.
- As in any browser game, a player could modify their own copy of the game. This doesn't matter for playing with friends.
- Pick a password that isn't easy to guess, and share it only with your friends.

## Controls

| Action | Keyboard / mouse | Touch | Gamepad |
| --- | --- | --- | --- |
| Fly | WASD / arrows, or hold left click | Drag anywhere (the ship copies your finger's movement) | Left stick / D-pad |
| Shoot | Automatic (toggle with **F**), or hold Space | Automatic | A / RT |
| Move ability (your character's own) | Shift / K | Flick (quick swipe) or the move button | B / RB |
| Special attack (your character's own) | B / right click | Two-finger tap or the special button | X / Y / LB |
| Pause | Esc / P | Pause button | Start |

The Settings screen switches touch controls to a floating joystick or a left-handed layout. It also sets your Classic starting hearts (1–10) and difficulty.

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
| 55 | **Wither Storm** | The final boss. It **keeps growing** the whole fight (faster in later phases). A tractor beam drags you toward it while blocks fly up from below, debris sprays, purple void beams and a command block surge |

After wave 55 the bosses return as **MK II**, then **MK III**, and so on. Each return brings a new colour, more HP, more bullets, faster attacks and new moves.

**The secret boss:** from wave 16 in Arcade, a pale face with glowing white eyes sometimes watches from the edge of the screen for a moment. Shoot it (with your own shots; explosions and specials don't count) and **Herobrine** comes. He teleports, calls down lightning (warning rings first), sends shadow copies of himself, stares with two white beams and turns the lights out so only his eyes are visible. He also appears after the full lap in Boss Rush. He shows as **???** in the boss list and trophies until you beat him.

**How boss fights work:**

- **Health scales with your firepower.** On Normal a fight lasts about 30–40 seconds for the first bosses and about a minute for the later ones. Weapon upgrades still speed you up.
- **Shields:** at every new phase the boss raises a shield. Break it to **stun** the boss for about 2.5 seconds; it takes ×1.5 damage while stunned, and it drops a heart (or a power-up if your hearts are full).
- **Harassment and combos:** bosses fire aimed shots between attacks and chain attacks together in later phases. Below Hard, these shots leave a gap where you stand and only aim ahead of you in the final phase.
- **Last Stand:** at 10% health every boss unleashes its own ultimate attack.
- **Berserk:** if a fight drags on for a long time, the boss speeds up.
- **Hard mode:** bosses have more HP, attack faster and fire extra bullets. From the second boss on, their heavy hits (beams, slams, lasers, charges) cost **2 hearts**.

To rebalance boss fights, edit the `DIFF` table near the top of `game.js` (boss HP `bhp`, attack speed `tempo`, extra bullets `tier`, gap between pot-shots `harass`), or a boss's `hpw` value in `bosses.js`.

## Skins

Pick your character on the **SKINS** screen in the main menu. Each one has its own look, trail colour and **two abilities of its own**:

- **Move** (SHIFT, the dash button, a flick on touch, or B/RB on a gamepad), with its own cooldown.
- **Special** (B, right click, the special button, a two-finger tap, or X/Y/LB on a gamepad), which uses the special meter.

The two buttons in the corner show your character's icons. Your hitbox is the same for every character.

| Character | Move (cooldown) | Special |
| --- | --- | --- |
| Phantom | **Phase Dash** (0.9s): a lightning-fast dash; nothing can hit you mid-dash | **Nova**: a screen-wide shockwave that wipes out bullets and hits every mob |
| Steve | **Firework Boost** (1.6s): a long rocket boost that burns through mobs in your way | **TNT Rain**: lobs 8 lit TNT blocks onto the nearest mobs |
| Alex | **Ender Pearl** (1.3s): teleport a short hop | **Enchanted Volley**: 30 homing enchanted arrows |
| Ender Dragon | **Wing Gust** (2s): dash and blow away every enemy bullet around you | **Dragon Breath**: a column of purple fire for 3 seconds that melts mobs and bullets |
| Allay | **Spirit Dash** (1.1s): a dash that pulls every pickup toward you | **Allay Choir**: heals 1 heart for the whole team, shields everyone for 4 seconds and calls the drones |
| Bee | **Buzz** (0.45s): a tiny, quick hop that is ready again almost at once | **Bee Swarm**: 16 bees that chase down mobs |
| Parrot | **Barrel Roll** (1.4s): spin through bullets and send them back at the mobs | **Rainbow Burst**: turns every enemy bullet into points and hits every mob |
| Bat | **Night Flight** (2.4s): turn to shadow, fly faster, can't be hit, and darkness lifts | **Sonar Screech**: three sonic rings that smash mobs and bullets nearby |
| Blaze | **Flame Dash** (1.3s): dash and leave a trail of fire that burns mobs | **Inferno**: three rings of fireballs in every direction |
| Ghast | **Puff Up** (3s): a tough bubble that blocks everything for 1.6 seconds | **Mega Fireball**: one huge fireball that drifts to the nearest mob and explodes |
| Nightmare Phantom | **Shadow Dive** (1.5s): a razor-fast dive that slashes every mob you pass | **Blood Moon**: for 5 seconds everything slows down and every mob keeps taking damage |

**The special meter** fills only from mobs **you** kill and from grazing bullets. Kills made by a special (or by anything it sets off, like TNT or the Allay Choir's drones) never refill it. Against a boss, one special can take at most **5%** of its health (4% for the Nova), so bosses stay a real fight.

To change an ability, edit the character in `skins.js` (name, description, cooldown) and its behaviour in the "character abilities" part of `game.js`.

## Pets

Pick a pet on the **PETS** screen in the main menu (or in a co-op lobby). It follows your ship and uses **two abilities of its own**, automatically:

| Pet | Role | Abilities |
| --- | --- | --- |
| Wolf | Hunter | **Pack Bite**: lunges at the nearest mob and bites it. **Loyal Rage**: when you get hurt, it bites faster and harder for 6 seconds |
| Cat | Guardian | **Scare**: creepers and phantoms are afraid of cats and keep away from you. **Morning Gift**: brings you a random power-up every 40 seconds |
| Bee | Stinger | **Poison Sting**: stings a mob every 2 seconds and poisons it for 4 seconds. **Hive Fury**: at your last heart it stings three times as fast |
| Mini Allay | Collector | **Fetch**: flies out and brings you every pickup on screen. **Song**: the special meter fills 30% faster |
| Frog | Gobbler | **Tongue Snap**: snatches an enemy bullet near you every 1.5 seconds. **Snack Time**: swallows small mobs (vexes, phantoms, tiny slimes) every 7 seconds |
| Axolotl | Healer | **Regeneration**: while you are hurt, heals 1 heart every 40 seconds. **Bubble**: once per wave, dropping to your last heart puts you in a safe bubble for 3 seconds |

Pets can't be hurt. In co-op everyone brings their own pet. Pet kills count toward the **Best Friend** trophy. Pets and their abilities are in `pets.js` and in the "pets" part of `game.js`.

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
- Newer mobs:
  - **Pillager** (from wave 4): a red laser sight follows you while it loads its crossbow, then a fast bolt. Every third shot is a 3-bolt Multishot. Pillagers also fly in patrols.
  - **Witch** (from wave 6): lobs splash potions. A ring shows where each one lands: **Harming** hurts, **Poison** leaves a cloud, **Slowness** makes your ship heavy. She drinks a healing potion when hurt.
  - **Breeze** (from wave 9): hops around the sky and fires wind charges that knock your ship back.
  - **Piglin Brute** (from wave 12): very tough. It raises its golden axe (a dashed line shows where it will go) and charges.
  - **Vindicator** (Village Raid only): an illager with an iron axe that charges like a brute.
- Gold **elite** mobs from wave 7.
- Mob health rises smoothly every wave. Your weapon also gets stronger with every boss you beat, so the game stays balanced.
- Power-ups:
  - Weapon stars (up to level 5, then +10% power each).
  - Overdrive, shield, magnet and 2x score.
  - **Time Warp** (clock), **Thunderstorm** (trident), **Allay drones** and **Totem of Undying** (an extra life).
- 11 characters, each with its own move and special attack (see **Skins**). The special meter recharges only from mobs **you** kill and from grazing bullets.
- 6 pets, each with two abilities (see **Pets**).
- A combo multiplier up to x8, perfect-wave bonuses, 27 trophies (one of them secret) and a local high-score board.
- Four space zones, mobs that shatter into pieces, screen shake, slow motion, and music and sound effects generated in code.

## Files

Everything the game needs is in this one folder, with no subfolders:

```
index.html     menus, HUD and screens
game.css       all styling and animations
settings.js    saved settings, high scores, the three games, Classic checkpoints and Hardcore challenge rules
trophies.js    trophies (achievements)
audio.js       generated sound effects and music (Web Audio)
input.js       keyboard, mouse, touch gestures, joystick and gamepad
skins.js       the 11 characters: looks, abilities and their button icons
pets.js        the 6 pets and their abilities
bosses.js      all 11 bosses plus the secret one, and their attacks
game.js        game engine: rendering, mobs, waves, power-ups and particles
intro.js       startup intro (VarexGames, Made in Pakistan, title screen) and the game logo
net.js         online co-op: rooms, passwords (SHA-256), lobby, messages and relay (TURN) support
netconfig.js   optional relay server for everyone who plays your copy (see "Playing with friends far away")
peerjs.min.js  PeerJS 1.5.5 (MIT license), the WebRTC library net.js uses
ui.js          menus, HUD updates, lobby and startup
*.png          sprites and images
main.js        Electron entry point for the desktop app
```

For testing, open the browser console: `Game.debug.boss(4)` jumps straight to the Ender Dragon, `Game.debug.boss(11)` to the Wither Storm, `Game.debug.herobrine()` summons the secret boss, `Game.debug.killBoss()` defeats the current boss, and `Game.debug.god()` makes you invincible. `Game.start({ game: 'raid' })` starts a Village Raid (`'bossrush'` for Boss Rush), and `Game.debug.pet()` shows what your pet is doing. `Game.debug.autopilot('dodge')` lets a simple bot fly and dodge; in god mode, `Game.debug.info().botHits` counts the hearts you would have lost. In a co-op game, `Game.debug.players()` lists every ship and `Game.debug.hurtPid(2)` hurts player 2 (host only).

## Credits

- Game by **MrGamerKing**, published by **VarexGames**.
- [PeerJS](https://github.com/peers/peerjs) (MIT License, Copyright (c) 2015 Michelle Bu and Eric Zhang) for online co-op.
