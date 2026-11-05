export type Line = { speaker: string; text: string; flag?: string; next?: string; choices?: { label: string; next: string }[] };

export const NPCS: Record<string, Line[]> = {
  miller: [
    { speaker: "Miller", text: "Wheelhaven turns when he runs. When he naps, the mill jams. That's the deal." },
    { speaker: "Miller", text: "Take the east path into Cogwood. Bring back three mite cogs and I'll grease your roll.", flag: "quest-seeds" },
  ],
  lore: [
    { speaker: "Lorekeeper", text: "SqueekCore writes every magnet passage on Sepolia. We just live in the margins." },
    { speaker: "Lorekeeper", text: "The Gearmaw bottled a wheel and called it a heart. Smash the heart, free the town." },
  ],
  scout: [
    { speaker: "Scout Pip", text: "Mines are south. Lever on the left wall drops the rust-gate. Don't stand on vents." },
    { speaker: "Scout Pip", text: "If the hamster is sleeping, foundry doors lock. Wait for zoomies or kick a Surge through anyway." },
  ],
  hermit: [
    { speaker: "Cog Hermit", text: "They hear gears in the canopy. I hear a hamster. Same god, different hymn.", flag: "quest-hermit" },
    { speaker: "Cog Hermit", text: "Secret wall in the ruined hut. Hit it. Don't tell Pip." },
  ],
  smith: [
    { speaker: "Blacksmith", text: "Drop relic iron and gold. I don't do miracles, I do rivets." },
  ],
  shop: [
    { speaker: "Nettle", text: "Buy what you can carry. The wheel doesn't take returns." },
  ],
  board: [
    { speaker: "Quest Board", text: "WANTED: mite cogs. WANTED: rust crawler fangs. WANTED: one fool to punch the Gearmaw." },
  ],
  kid: [
    { speaker: "Pipkin", text: "The miller pays in seeds if you stomp mites. Don't tell mum I said east." },
  ],
  kid2: [
    { speaker: "Bramble", text: "When the wheel naps the lanterns go blue. That's when the foundry locks." },
  ],
  shrine: [
    { speaker: "Wheel Shrine", text: "The shrine drinks RPM. Touch it to rest, fast-travel, and watch the global wound." },
  ],
};

export const MAIN = [
  { id: "main-1", title: "The Jammed Wheel", stages: ["Talk to the Miller.", "Clear Cogwood mites.", "See the shrine.", "Enter the Foundry.", "Fell the Gearmaw."] },
  { id: "side-seeds", title: "Grease the Mill", stages: ["Collect 3 mite cogs."] },
  { id: "side-chest", title: "Hollow Cache", stages: ["Open the hidden Cogwood chest."] },
  { id: "side-hermit", title: "Canopy Hymn", stages: ["Speak with the Cog Hermit."] },
  { id: "side-mines", title: "Rust and Fangs", stages: ["Defeat the Iron Pellet."] },
  { id: "side-levers", title: "Left Wall", stages: ["Throw the mine lever."] },
  { id: "side-shrine", title: "Four Hearths", stages: ["Light every shrine."] },
];

export const SHOP = [
  { id: "oak-blade", cost: 40 },
  { id: "volt-shard", cost: 35 },
  { id: "iron-mail", cost: 55 },
];
