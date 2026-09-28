/* =========================================================================
   Player skins — each one is a character with its own two abilities:
     move : the SHIFT / dash-button ability (cd = cooldown in seconds)
     ult  : the B / special-button attack, charged by your kills and grazes
   img   : sprite file · ar : height / width · ws : width scale vs the Phantom
   trail : engine-trail colours · glow : aura colour under the ship
   How the abilities behave is in game.js ("character abilities").
   ========================================================================= */
const SKINS = [
  {
    id: 'phantom', name: 'PHANTOM', img: 'player.png', ar: 197 / 331, ws: 1, trail: ['#3ee6ff', '#508cff'], glow: '#3ee6ff',
    desc: 'The original night flyer. Fast, fearless, a little bony.',
    move: { id: 'dash', name: 'PHASE DASH', cd: 0.9, desc: 'A lightning-fast dash. Nothing can hit you mid-dash.' },
    ult: { id: 'nova', name: 'NOVA', desc: 'A screen-wide shockwave that wipes out bullets and hits every mob.' },
  },
  {
    id: 'steve', name: 'STEVE', img: 'skin_steve.png', ar: 14 / 24, ws: 0.95, trail: ['#ffffff', '#9ea3b8'], glow: '#9ee8ff',
    desc: 'The classic hero gliding on an elytra.',
    move: { id: 'rocket', name: 'FIREWORK BOOST', cd: 1.6, desc: 'A long rocket-powered boost that burns through mobs in your way.' },
    ult: { id: 'tnt', name: 'TNT RAIN', desc: 'Lobs 8 lit TNT blocks onto the nearest mobs. Each one blows up in a big blast.' },
  },
  {
    id: 'alex', name: 'ALEX', img: 'skin_alex.png', ar: 14 / 24, ws: 0.95, trail: ['#c7b3f0', '#8a6fd0'], glow: '#b89cff',
    desc: 'Alex on a shimmering enchanted elytra.',
    move: { id: 'pearl', name: 'ENDER PEARL', cd: 1.3, desc: 'Teleport instantly a short hop in the direction you are moving.' },
    ult: { id: 'arrows', name: 'ENCHANTED VOLLEY', desc: 'Fires 30 glowing enchanted arrows that home in on mobs.' },
  },
  {
    id: 'dragon', name: 'ENDER DRAGON', img: 'skin_dragon.png', ar: 14 / 24, ws: 1.05, trail: ['#e37bff', '#a33ad6'], glow: '#c060ff',
    desc: 'Tame the queen of the End and ride her into battle.',
    move: { id: 'gust', name: 'WING GUST', cd: 2, desc: 'One mighty wingbeat: dash and blow away every enemy bullet around you.' },
    ult: { id: 'breath', name: 'DRAGON BREATH', desc: 'Breathe a torrent of purple fire straight ahead for 3 seconds, melting mobs and bullets.' },
  },
  {
    id: 'allay', name: 'ALLAY', img: 'skin_allay.png', ar: 14 / 24, ws: 0.9, trail: ['#9fe3ff', '#ffffff'], glow: '#8fd8ff',
    desc: 'A tiny blue helper with a big heart.',
    move: { id: 'spirit', name: 'SPIRIT DASH', cd: 1.1, desc: 'A gentle dash that pulls every pickup on screen toward you.' },
    ult: { id: 'choir', name: 'ALLAY CHOIR', desc: 'Heals 1 heart for the whole team, shields everyone for 4 seconds and calls the allay drones.' },
  },
  {
    id: 'bee', name: 'BEE', img: 'skin_bee.png', ar: 14 / 24, ws: 0.9, trail: ['#ffe066', '#f5c518'], glow: '#ffd23f',
    desc: 'Buzz buzz. Stings like a TNT block.',
    move: { id: 'buzz', name: 'BUZZ', cd: 0.45, desc: 'A tiny, quick hop that is ready again almost straight away.' },
    ult: { id: 'swarm', name: 'BEE SWARM', desc: 'Releases 16 angry bees that chase down mobs and sting them.' },
  },
  {
    id: 'parrot', name: 'PARROT', img: 'skin_parrot.png', ar: 14 / 24, ws: 0.95, trail: ['#ff4d5e', '#2e6fd8', '#f0c030'], glow: '#ff6a5e',
    desc: 'A rainbow macaw that leaves a colourful trail.',
    move: { id: 'roll', name: 'BARREL ROLL', cd: 1.4, desc: 'Spin through bullets. Any you touch fly back at the mobs.' },
    ult: { id: 'rainbow', name: 'RAINBOW BURST', desc: 'A rainbow shockwave that turns every enemy bullet into points and hits all mobs.' },
  },
  {
    id: 'bat', name: 'BAT', img: 'skin_bat.png', ar: 14 / 24, ws: 0.95, trail: ['#b08a60', '#6a4a30'], glow: '#c09060',
    desc: 'A cave bat that squeaked its way to space.',
    move: { id: 'echo', name: 'NIGHT FLIGHT', cd: 2.4, desc: 'Turn to shadow for a second: you fly faster, nothing can touch you, and darkness lifts.' },
    ult: { id: 'screech', name: 'SONAR SCREECH', desc: 'Three sonic rings burst out from you, smashing mobs and bullets nearby.' },
  },
  {
    id: 'blaze', name: 'BLAZE', img: 'skin_blaze.png', ar: 14 / 24, ws: 0.9, trail: ['#ff8c28', '#ffd23f'], glow: '#ff8c28',
    desc: 'Fireproof, smoky and always spinning.',
    move: { id: 'flame', name: 'FLAME DASH', cd: 1.3, desc: 'Dash and leave a trail of fire that burns any mob that touches it.' },
    ult: { id: 'inferno', name: 'INFERNO', desc: 'Unleashes three rings of fireballs in every direction.' },
  },
  {
    id: 'ghast', name: 'GHAST', img: 'skin_ghast.png', ar: 13 / 12, ws: 0.62, trail: ['#ffffff', '#ff6a6a'], glow: '#ffffff',
    desc: 'A crying cube of the Nether, floating free.',
    move: { id: 'puff', name: 'PUFF UP', cd: 3, desc: 'Puff into a tough bubble that blocks everything for 1.6 seconds.' },
    ult: { id: 'mega', name: 'MEGA FIREBALL', desc: 'Launches one huge fireball that drifts toward the nearest mob and explodes with enormous force.' },
  },
  {
    id: 'crimson', name: 'NIGHTMARE PHANTOM', img: 'phantomlord.png', ar: 197 / 331, ws: 1, trail: ['#ff4d5e', '#a01830'], glow: '#ff3050',
    desc: 'Wear the colours of the Phantom Overlord.',
    move: { id: 'dive', name: 'SHADOW DIVE', cd: 1.5, desc: 'A razor-fast dive that slashes every mob you fly through.' },
    ult: { id: 'bloodmoon', name: 'BLOOD MOON', desc: 'For 5 seconds every mob and bullet slows down, and every mob on screen keeps taking damage.' },
  },
];

/** Button icons for every ability (24×24 SVG). */
const ABILITY_ICONS = (() => {
  const s = (d, w = 2.4) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const f = (d) => `<svg viewBox="0 0 24 24" fill="currentColor">${d}</svg>`;
  return {
    // movement
    dash: s('<path d="M6 13l6-6 6 6M6 19l6-6 6 6"/>', 2.6),
    rocket: s('<path d="M12 2c3 2.2 4.6 5.8 4.6 9.6L14.8 15H9.2l-1.8-3.4C7.4 7.8 9 4.2 12 2z"/><circle cx="12" cy="9" r="1.6"/><path d="M9.5 18l-1.5 3M14.5 18l1.5 3M12 18v4"/>', 2),
    pearl: s('<circle cx="12" cy="12" r="8"/><path d="M8.5 12.5a3.5 3.5 0 1 1 3.5 3.5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>', 2),
    gust: s('<path d="M3 8h10a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7"/>', 2.2),
    spirit: f('<path d="M12 2.5l2.6 6.9L21.5 12l-6.9 2.6L12 21.5l-2.6-6.9L2.5 12l6.9-2.6z"/>'),
    buzz: s('<path d="M3 18l5.5-5.5 4 4L20 9M14.5 9H20v5.5"/>', 2.4),
    roll: s('<path d="M20 12a8 8 0 1 1-2.8-6.1M20 3.5v5h-5"/>', 2.4),
    echo: f('<path d="M20.5 14.2A8.6 8.6 0 1 1 9.8 3.5a7 7 0 0 0 10.7 10.7z"/>'),
    flame: f('<path d="M12 22c-4.2 0-7-2.9-7-6.6 0-4.3 4.2-6.6 4.2-11.4 2.2 1.6 3.4 3.6 3.6 6 1-.9 1.7-2.2 1.9-3.9 2.4 2.1 3.3 5.3 3.3 9.3 0 3.7-2.8 6.6-6 6.6z"/>'),
    puff: s('<circle cx="12" cy="12" r="8.5"/><path d="M8 9.2a4.5 4.5 0 0 1 3.4-2.4"/>', 2.2),
    dive: s('<path d="M4 20L20 4M9 21L21 9M3 15L15 3"/>', 2.4),
    // specials
    nova: f('<path d="M12 1.5l2.1 6.2 6.3-2.3-3.6 5.6 5.7 3.3-6.5.8.6 6.6L12 16.9l-4.6 4.8.6-6.6-6.5-.8 5.7-3.3-3.6-5.6 6.3 2.3z"/>'),
    tnt: s('<rect x="3" y="8" width="18" height="11" rx="1.5"/><path d="M8.5 8v11M15.5 8v11M12 8V4.5M10 3l2 1.5L14 3"/>', 2),
    arrows: s('<path d="M4 20L15 9M15 9h-4.5M15 9v4.5M9 21L20 10M20 10h-4.5M20 10v4.5"/>', 2.2),
    breath: s('<path d="M6 21c0-5 3-7 3-13M12 21c0-6 0-9 0-18M18 21c0-5-3-7-3-13"/>', 2.4),
    choir: f('<path d="M12 21s-8.5-5.2-8.5-11.2A4.6 4.6 0 0 1 12 7.2a4.6 4.6 0 0 1 8.5 2.6C20.5 15.8 12 21 12 21z"/>'),
    swarm: f('<circle cx="7" cy="8" r="2.8"/><circle cx="17" cy="7" r="2.8"/><circle cx="12" cy="16.5" r="3.2"/><path d="M4 3.5l2 2M20 2.5l-2 2" stroke="currentColor" stroke-width="1.8"/>'),
    rainbow: s('<path d="M2.5 18a9.5 9.5 0 0 1 19 0M6.5 18a5.5 5.5 0 0 1 11 0M10.3 18a1.7 1.7 0 0 1 3.4 0"/>', 2.2),
    screech: s('<circle cx="12" cy="12" r="2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.6 4.6a10.5 10.5 0 0 0 0 14.8M19.4 4.6a10.5 10.5 0 0 1 0 14.8"/>', 2.1),
    inferno: s('<circle cx="12" cy="12" r="3.6"/><path d="M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22M4.9 4.9l2.5 2.5M16.6 16.6l2.5 2.5M4.9 19.1l2.5-2.5M16.6 7.4l2.5-2.5"/>', 2.2),
    mega: f('<circle cx="12" cy="13.5" r="7.5"/><path d="M13 5.2c.3-1.6 1.4-2.8 3-3.4M9 5.8c-.7-1.4-.6-2.9.3-4.2" stroke="currentColor" stroke-width="1.8" fill="none"/>'),
    bloodmoon: f('<circle cx="12" cy="10.5" r="7.5"/><path d="M8 19.5l-.8 2.5M12 19.8V22.5M16 19.5l.8 2.5" stroke="currentColor" stroke-width="1.8"/>'),
  };
})();
