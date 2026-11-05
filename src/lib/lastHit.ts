import { keccak256, concat, pad, toHex, type Hex } from "viem";

function normalizeHash(hash: string): Hex {
  const h = hash.startsWith("0x") ? hash : `0x${hash}`;
  return pad(h as Hex, { size: 32 });
}

/**
 * Deterministic last-hit picker. Anyone can recompute:
 *   index = uint256(keccak256(dataHash || roundId)) % ready.length
 * Ready addresses are sorted lowercase. Empty roster returns null.
 */
export function pickLastHit(
  dataHash: string,
  roundId: number,
  readyAddresses: string[],
): string | null {
  const sorted = [...new Set(readyAddresses.map((a) => a.toLowerCase()))].sort();
  if (sorted.length === 0) return null;
  const digest = keccak256(
    concat([normalizeHash(dataHash), pad(toHex(roundId), { size: 32 })]),
  );
  const index = Number(BigInt(digest) % BigInt(sorted.length));
  return sorted[index] ?? null;
}

export function verifyLastHit(
  dataHash: string,
  roundId: number,
  readyAddresses: string[],
  claimed: string,
): boolean {
  const picked = pickLastHit(dataHash, roundId, readyAddresses);
  return picked !== null && picked === claimed.toLowerCase();
}
