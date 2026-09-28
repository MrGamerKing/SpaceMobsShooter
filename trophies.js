/* =========================================================================
   Trophies — achievements saved in localStorage
   ========================================================================= */
const Trophies = (() => {
  const KEY = 'sms.trophies.v1';
  const LIST = [
    { id: 'first', name: 'FIRST BLOOD', desc: 'Defeat your first mob', icon: 'zombie.png' },
    { id: 'combo', name: 'COMBO MASTER', desc: 'Reach a x8 combo multiplier', icon: 'newbullet.png' },
    { id: 'warden', name: 'WARDEN SLAYER', desc: 'Defeat the Warden', icon: 'warden.png' },
    { id: 'wither', name: 'WITHER SLAYER', desc: 'Defeat the Wither', icon: 'wither.png' },
    { id: 'dragon', name: 'THE END', desc: 'Defeat the Ender Dragon', icon: 'dragon.png' },
    { id: 'bosses5', name: 'BOSS HUNTER', desc: 'Defeat 5 different bosses (all runs)', icon: 'ravager.png' },
    { id: 'bosses10', name: 'GRAND SLAM', desc: 'Defeat all 10 bosses (all runs)', icon: 'phantomlord.png' },
    { id: 'flawless', name: 'FLAWLESS', desc: 'Beat a boss without taking damage', icon: 'heart.png' },
    { id: 'maxpower', name: 'MAX POWER', desc: 'Reach weapon level 5', icon: 'upcharge4.png' },
    { id: 'graze', name: 'GRAZE KING', desc: 'Graze 100 bullets in one run', icon: 'scoreinc.png' },
    { id: 'demolition', name: 'DEMOLITION', desc: 'Take out 4 mobs with one explosion', icon: 'tnt.png' },
    { id: 'immortal', name: 'IMMORTAL', desc: 'Get saved by a Totem of Undying', icon: 'totem.png' },
    { id: 'storm', name: 'STORMBRINGER', desc: 'Kill 15 mobs with lightning in one run', icon: 'trident.png' },
    { id: 'survivor', name: 'SURVIVOR', desc: 'Reach wave 15', icon: 'player.png' },
    { id: 'legend', name: 'LEGEND', desc: 'Score 100,000 points in one run', icon: 'booster.png' },
    { id: 'hardcore', name: 'HARDCORE HERO', desc: 'Reach wave 10 on Hard', icon: 'enderman.png' },
    { id: 'elite', name: 'ELITE HUNTER', desc: 'Defeat 25 elite mobs (all runs)', icon: 'blaze.png' },
    { id: 'slimes', name: 'SLIME SQUASHER', desc: 'Pop 60 slimes (all runs)', icon: 'slime.png' },
    { id: 'collector', name: 'COLLECTOR', desc: 'Collect all 11 power-up types', icon: 'allay.png' },
    { id: 'extreme', name: 'EXTREME', desc: 'Defeat a boss in Hardcore Extreme', icon: 'magma.png' },
    { id: 'insane', name: 'INSANITY', desc: 'Defeat a boss in Hardcore Insane', icon: 'illusioner.png' },
    { id: 'brutal', name: 'BRUTAL LEGEND', desc: 'Defeat a boss in Hardcore Brutal (one heart!)', icon: 'wskull.png' },
  ];
  const COUNTERS = { elites: ['elite', 25], slimes: ['slimes', 60] };
  const ALL_PICKUPS = 11;

  let data = { unlocked: {}, counters: {}, collected: [], bosses: [] };
  try { data = Object.assign(data, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* ignore */ }
  const listeners = [];
  let session = [];

  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ } };

  function unlock(id) {
    if (data.unlocked[id]) return false;
    const t = LIST.find((x) => x.id === id);
    if (!t) return false;
    data.unlocked[id] = Date.now();
    session.push(t);
    save();
    listeners.forEach((fn) => fn(t));
    return true;
  }

  return {
    LIST,
    unlock,
    has(id) { return !!data.unlocked[id]; },
    /** Lifetime counters (elite kills, slimes popped). */
    add(counter, n = 1) {
      data.counters[counter] = (data.counters[counter] || 0) + n;
      const rule = COUNTERS[counter];
      if (rule && data.counters[counter] >= rule[1]) unlock(rule[0]);
      else save();
    },
    collect(type) {
      if (data.collected.includes(type)) return;
      data.collected.push(type);
      if (data.collected.length >= ALL_PICKUPS) unlock('collector');
      else save();
    },
    /** Record a defeated boss kind (lifetime) and unlock the boss trophies. */
    boss(kind) {
      if (LIST.some((t) => t.id === kind)) unlock(kind);
      if (!data.bosses) data.bosses = [];
      if (!data.bosses.includes(kind)) data.bosses.push(kind);
      if (data.bosses.length >= 5) unlock('bosses5');
      if (data.bosses.length >= 10) unlock('bosses10');
      save();
    },
    progress(id) {
      if (id === 'bosses5' || id === 'bosses10') return `${Math.min(id === 'bosses5' ? 5 : 10, (data.bosses || []).length)}/${id === 'bosses5' ? 5 : 10}`;
      if (id === 'elite') return `${Math.min(25, data.counters.elites || 0)}/25`;
      if (id === 'slimes') return `${Math.min(60, data.counters.slimes || 0)}/60`;
      if (id === 'collector') return `${data.collected.length}/${ALL_PICKUPS}`;
      return '';
    },
    count() { return Object.keys(data.unlocked).length; },
    startRun() { session = []; },
    sessionUnlocks() { return session.slice(); },
    onUnlock(fn) { listeners.push(fn); },
    reset() { data = { unlocked: {}, counters: {}, collected: [], bosses: [] }; save(); },
  };
})();
