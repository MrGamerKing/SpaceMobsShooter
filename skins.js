/* =========================================================================
   Player skins — purely cosmetic, picked on the SKINS screen.
   img   : sprite file · ar : height / width · ws : width scale vs the Phantom
   trail : engine-trail colours · glow : aura colour under the ship
   ========================================================================= */
const SKINS = [
  { id: 'phantom', name: 'PHANTOM', img: 'player.png', ar: 197 / 331, ws: 1, trail: ['#3ee6ff', '#508cff'], glow: '#3ee6ff', desc: 'The original night flyer. Fast, fearless, a little bony.' },
  { id: 'steve', name: 'STEVE', img: 'skin_steve.png', ar: 14 / 24, ws: 0.95, trail: ['#ffffff', '#9ea3b8'], glow: '#9ee8ff', desc: 'The classic hero gliding on an elytra.' },
  { id: 'alex', name: 'ALEX', img: 'skin_alex.png', ar: 14 / 24, ws: 0.95, trail: ['#c7b3f0', '#8a6fd0'], glow: '#b89cff', desc: 'Alex on a shimmering enchanted elytra.' },
  { id: 'dragon', name: 'ENDER DRAGON', img: 'skin_dragon.png', ar: 14 / 24, ws: 1.05, trail: ['#e37bff', '#a33ad6'], glow: '#c060ff', desc: 'Tame the queen of the End and ride her into battle.' },
  { id: 'allay', name: 'ALLAY', img: 'skin_allay.png', ar: 14 / 24, ws: 0.9, trail: ['#9fe3ff', '#ffffff'], glow: '#8fd8ff', desc: 'A tiny blue helper with a big heart.' },
  { id: 'bee', name: 'BEE', img: 'skin_bee.png', ar: 14 / 24, ws: 0.9, trail: ['#ffe066', '#f5c518'], glow: '#ffd23f', desc: 'Buzz buzz. Stings like a TNT block.' },
  { id: 'parrot', name: 'PARROT', img: 'skin_parrot.png', ar: 14 / 24, ws: 0.95, trail: ['#ff4d5e', '#2e6fd8', '#f0c030'], glow: '#ff6a5e', desc: 'A rainbow macaw that leaves a colourful trail.' },
  { id: 'bat', name: 'BAT', img: 'skin_bat.png', ar: 14 / 24, ws: 0.95, trail: ['#b08a60', '#6a4a30'], glow: '#c09060', desc: 'A cave bat that squeaked its way to space.' },
  { id: 'blaze', name: 'BLAZE', img: 'skin_blaze.png', ar: 14 / 24, ws: 0.9, trail: ['#ff8c28', '#ffd23f'], glow: '#ff8c28', desc: 'Fireproof, smoky and always spinning.' },
  { id: 'ghast', name: 'GHAST', img: 'skin_ghast.png', ar: 13 / 12, ws: 0.62, trail: ['#ffffff', '#ff6a6a'], glow: '#ffffff', desc: 'A crying cube of the Nether, floating free.' },
  { id: 'crimson', name: 'NIGHTMARE PHANTOM', img: 'phantomlord.png', ar: 197 / 331, ws: 1, trail: ['#ff4d5e', '#a01830'], glow: '#ff3050', desc: 'Wear the colours of the Phantom Overlord.' },
];
