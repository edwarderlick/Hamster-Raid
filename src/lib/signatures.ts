import { verifyMessage, type Hex } from "viem";

export type SignedIntent = {
  address: string;
  nonce: string;
  expiresAt: number;
  action: "join" | "ready" | "save";
  week: number;
  round?: number;
  chainId: number;
};

export function buildSignMessage(intent: SignedIntent): string {
  const lines = [
    "Hamster Raid — Squeekchain",
    "",
    `Action: ${intent.action === "join" ? "Join the raid" : intent.action === "save" ? "Save character" : "Ready up"}`,
    `Address: ${intent.address}`,
    `Week: ${intent.week}`,
    intent.round !== undefined ? `Round: ${intent.round}` : null,
    `Nonce: ${intent.nonce}`,
    `Expires: ${new Date(intent.expiresAt).toISOString()}`,
    `Chain: Sepolia (${intent.chainId})`,
    "",
    "This signature is free. It never sends a transaction or spends gas.",
  ];
  return lines.filter((l) => l !== null).join("\n");
}

export async function verifySignedIntent(
  intent: SignedIntent,
  signature: Hex,
  expected: { action: SignedIntent["action"]; chainId: number; now?: number },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = expected.now ?? Date.now();
  if (intent.action !== expected.action) return { ok: false, error: "wrong_action" };
  if (intent.chainId !== expected.chainId) return { ok: false, error: "wrong_chain" };
  if (intent.expiresAt <= now) return { ok: false, error: "expired" };
  if (!intent.nonce || intent.nonce.length < 8) return { ok: false, error: "bad_nonce" };
  const message = buildSignMessage(intent);
  const valid = await verifyMessage({
    address: intent.address as `0x${string}`,
    message,
    signature,
  });
  if (!valid) return { ok: false, error: "bad_signature" };
  return { ok: true };
}

export function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
