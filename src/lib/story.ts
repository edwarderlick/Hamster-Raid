import { classifyWork } from "./constants.js";
import type { HeroClass } from "./classes.js";

export type StoryInput = {
  roundId: number;
  work: number;
  bossName: string;
  lastHit: string | null;
  lastHitClass?: HeroClass | null;
  killed: boolean;
  healed: number;
  enrage: number;
  hpAfter: number;
  hpMax: number;
  priorBeat?: string;
};

export function templateBeat(input: StoryInput): string {
  const kind = classifyWork(input.work);
  const short = input.lastHit
    ? `${input.lastHit.slice(0, 6)}…${input.lastHit.slice(-4)}`
    : "no raider";
  const cls = input.lastHitClass ? " the Wheel Raider" : "";
  if (input.killed) {
    return `${input.bossName} buckles as round ${input.roundId} lands ${input.work} work units. ${short}${cls} drives the last magnet-passage home. The foundry goes quiet; the wheel keeps the record.`;
  }
  if (kind === "nap") {
    return `Round ${input.roundId} settles with zero work. Squeektoshi is napping, and ${input.bossName} drinks the silence — healing ${input.healed} and stacking enrage to ${input.enrage}. ${short} held the last real hit. The raid waits on the wheel.`;
  }
  if (kind === "jog") {
    return `A steady jog: ${input.work} work units in round ${input.roundId}. ${input.bossName} flinches. ${short}${cls} is marked as last hit. HP sits at ${input.hpAfter}/${input.hpMax}.`;
  }
  return `Zoomies. Round ${input.roundId} dumps ${input.work} work units into ${input.bossName}. Sparks jump the wheel. ${short}${cls} claims the last hit as the HP bar slams to ${input.hpAfter}/${input.hpMax}.`;
}

export async function writeBeat(
  input: StoryInput,
  llm?: { key: string; url: string; model: string },
): Promise<{ text: string; source: "llm" | "template" }> {
  if (!llm?.key) return { text: templateBeat(input), source: "template" };
  try {
    const res = await fetch(llm.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${llm.key}`,
      },
      body: JSON.stringify({
        model: llm.model,
        temperature: 0.8,
        max_tokens: 180,
        messages: [
          {
            role: "system",
            content:
              "You are the Hamster Raid narrator. Write 2-3 cinematic sentences. No markdown. Continuity with the prior beat. The hamster Squeektoshi runs a real wheel; damage is real settled work units. Never invent numbers.",
          },
          {
            role: "user",
            content: JSON.stringify({
              priorBeat: input.priorBeat ?? null,
              roundId: input.roundId,
              work: input.work,
              kind: classifyWork(input.work),
              bossName: input.bossName,
              lastHit: input.lastHit,
              killed: input.killed,
              healed: input.healed,
              enrage: input.enrage,
              hpAfter: input.hpAfter,
              hpMax: input.hpMax,
            }),
          },
        ],
      }),
    });
    if (!res.ok) return { text: templateBeat(input), source: "template" };
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) return { text: templateBeat(input), source: "template" };
    return { text, source: "llm" };
  } catch {
    return { text: templateBeat(input), source: "template" };
  }
}
