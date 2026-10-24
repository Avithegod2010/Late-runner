/* ================================================================
   World Exploration Collectibles
   Three themed collectibles hide along each world. Completing a
   collection unlocks a cosmetic decal and reveals a piece of the
   game's fictional city history.
   ================================================================ */

export interface CollectibleDef {
  id: string;
  worldId: string;
  name: string;
  /** one-line hint where it tends to appear */
  hint: string;
  /** lore revealed on pickup */
  lore: string;
}

export const COLLECTIBLES: CollectibleDef[] = [
  // Neon Sunset
  { id: "ns-horseshoe", worldId: "synthwave", name: "Chrome Horseshoe", hint: "Drifts near the palm-lined shoulder", lore: "Before the neon, couriers raced horses down this exact strip. The chrome horseshoe was the first prize ever struck for the Midnight Run." },
  { id: "ns-cassette", worldId: "synthwave", name: "Unlabeled Cassette", hint: "Hums where the billboards flicker", lore: "Track 4 is a 1986 engine recording. Old-timers swear playing it at sunset makes the traffic part a half-second earlier." },
  { id: "ns-sunglasses", worldId: "synthwave", name: "One Pink Lens", hint: "Catches light above the centre lane", lore: "The city's most famous wrong-way rider lost this lens mid-jump in '91. The other half has never been found." },
  // Midnight City
  { id: "mc-token", worldId: "city", name: "Old Metro Token", hint: "Glints in the rain-slick gutters", lore: "The metro flooded in the Great Storm and the city switched to couriers overnight. Tokens became lucky charms; riders drill a hole and wear them." },
  { id: "mc-badge", worldId: "city", name: "Retired Badge #47", hint: "Spins under the streetlights", lore: "Officer Vega spent nine years trying to ticket the wrong-way riders. She retired, bought a bike, and now holds the city lap record." },
  { id: "mc-key", worldId: "city", name: "Rooftop Key", hint: "Falls from the tallest towers", lore: "Opens the old dispatch rooftop where the first courier HQ still has a kettle on. The coffee is terrible. The view is not." },
  // Desert Dawn
  { id: "dd-fossil", worldId: "desert", name: "Petrified Whistle", hint: "Buries itself near the cactus line", lore: "Stagecoach drivers blew this canyon clean of bandits a century before engines. It still works — once." },
  { id: "dd-thermos", worldId: "desert", name: "Dented Thermos", hint: "Rolls along the dusty shoulder", lore: "Belonged to the water courier who mapped every spring in the basin. The dent is from a road train. The courier isn't." },
  { id: "dd-compass", worldId: "desert", name: "Wrong-Way Compass", hint: "Spins near the switchbacks", lore: "Points opposite north. Follow it and you take the old smugglers' shortcut — three minutes saved, one pothole guaranteed." },
  // Alpine Frost
  { id: "af-bell", worldId: "alpine", name: "Sled Bell", hint: "Rings above the snowline", lore: "The mountain pass doubled as a bobsled run some winters. The bell warned oncoming traffic — a tradition riders keep with horns." },
  { id: "af-goggles", worldId: "alpine", name: "Frosted Goggles", hint: "Ices over by the pines", lore: "Left behind by the avalanche courier who delivered during whiteouts for twelve seasons. Visibility: zero. Delivery rate: perfect." },
  { id: "af-crystal", worldId: "alpine", name: "Blue Ice Crystal", hint: "Sinks into the packed snow", lore: "Locals say the pass glacier swallowed a delivery of lab-grown crystal in the 70s. It gives a piece back every decade." },
  // Tokyo Neon (and any later worlds reuse the pattern)
  { id: "tn-omamori", worldId: "tokyo", name: "Traffic Omamori", hint: "Swings near the lantern arches", lore: "A shrine charm for safe travel. The courier who hung it rode the wrong way past the shrine every night for luck." },
  { id: "tn-figurine", worldId: "tokyo", name: "Capsule Figurine", hint: "Pops out of the arcade glow", lore: "Series 2, the jumping rider — rarest in the set. Kids trade three trucks for one; couriers keep them in chest pockets." },
  { id: "tn-ticket", worldId: "tokyo", name: "Last Train Ticket", hint: "Flutters by the torii gates", lore: "Stamped for a train that never came. The station became the district's first relay hub, ticket window and all." },
];

export const COLLECTIBLES_PER_WORLD = 3;

export function collectiblesForWorld(worldId: string): CollectibleDef[] {
  return COLLECTIBLES.filter((c) => c.worldId === worldId);
}

/** Completion reward: a cosmetic decal id the rider can equip. */
export const COLLECTION_REWARDS: Record<string, { decalId: string; decalName: string; coins: number }> = {
  synthwave: { decalId: "collector-sunset", decalName: "Sunset Chrome decal", coins: 400 },
  city: { decalId: "collector-city", decalName: "Midnight badge decal", coins: 400 },
  desert: { decalId: "collector-desert", decalName: "Dust compass decal", coins: 400 },
  alpine: { decalId: "collector-alpine", decalName: "Frost bell decal", coins: 400 },
  tokyo: { decalId: "collector-tokyo", decalName: "Neon charm decal", coins: 400 },
};

/** Sanitize an untrusted collected-id list. */
export function sanitizeCollections(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const valid = new Set(COLLECTIBLES.map((c) => c.id));
  const out: string[] = [];
  for (const id of v) {
    if (typeof id === "string" && valid.has(id) && !out.includes(id)) out.push(id);
    if (out.length >= COLLECTIBLES.length) break;
  }
  return out;
}
