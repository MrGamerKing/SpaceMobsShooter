/* =========================================================================
   Pets — a little companion that follows your ship and helps out.
   Chosen in the main menu (PETS). Each has two abilities, both automatic.
   img : sprite file · ar : height / width · glow : aura colour
   How the abilities behave is in game.js ("pets").
   ========================================================================= */
const PETS = [
  {
    id: 'none', name: 'NO PET', img: '', ar: 1, glow: '#7f8aa8', role: 'SOLO',
    desc: 'Fly alone. No help, no distractions.',
    abil: [],
  },
  {
    id: 'wolf', name: 'WOLF', img: 'pet_wolf.png', ar: 8 / 10, glow: '#e6e6e6', role: 'HUNTER',
    desc: 'A loyal tamed wolf with a red collar. It hunts down mobs for you.',
    abil: [
      { name: 'PACK BITE', desc: 'Lunges at the nearest mob and bites it.' },
      { name: 'LOYAL RAGE', desc: 'When you get hurt it goes wild: faster, harder bites for 6 seconds.' },
    ],
  },
  {
    id: 'cat', name: 'CAT', img: 'pet_cat.png', ar: 8 / 10, glow: '#ffb35a', role: 'GUARDIAN',
    desc: 'A ginger cat. Small, fearless and secretly the scariest thing in the sky.',
    abil: [
      { name: 'SCARE', desc: 'Creepers and phantoms are afraid of cats: they keep away from you.' },
      { name: 'MORNING GIFT', desc: 'Every 40 seconds it brings you a random power-up.' },
    ],
  },
  {
    id: 'bee', name: 'BEE', img: 'pet_bee.png', ar: 9 / 10, glow: '#ffd23f', role: 'STINGER',
    desc: 'A busy little bee that buzzes around your ship.',
    abil: [
      { name: 'POISON STING', desc: 'Stings a mob every 2 seconds and poisons it for 4 seconds.' },
      { name: 'HIVE FURY', desc: 'When you are down to your last heart it stings three times as fast.' },
    ],
  },
  {
    id: 'allay', name: 'MINI ALLAY', img: 'allay.png', ar: 1, glow: '#62b6f0', role: 'COLLECTOR',
    desc: 'A tiny blue spirit that loves collecting things for you.',
    abil: [
      { name: 'FETCH', desc: 'Flies out and brings you every pickup on the screen. Nothing falls away.' },
      { name: 'SONG', desc: 'Its song fills the special meter 30% faster.' },
    ],
  },
  {
    id: 'frog', name: 'FROG', img: 'pet_frog.png', ar: 8 / 10, glow: '#ffb070', role: 'GOBBLER',
    desc: 'A hungry frog with a very long tongue.',
    abil: [
      { name: 'TONGUE SNAP', desc: 'Snatches an enemy bullet out of the air near you every 1.5 seconds.' },
      { name: 'SNACK TIME', desc: 'Swallows small mobs whole (vexes, phantoms, tiny slimes) every 7 seconds.' },
    ],
  },
  {
    id: 'axolotl', name: 'AXOLOTL', img: 'pet_axolotl.png', ar: 8 / 10, glow: '#ff8ac0', role: 'HEALER',
    desc: 'A pink axolotl in a bubble. It keeps you alive.',
    abil: [
      { name: 'REGENERATION', desc: 'While you are hurt it heals 1 heart every 40 seconds.' },
      { name: 'BUBBLE', desc: 'Once per wave, dropping to your last heart puts you in a safe bubble for 3 seconds.' },
    ],
  },
];
