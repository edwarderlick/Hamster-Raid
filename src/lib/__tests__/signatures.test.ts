import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { buildSignMessage, verifySignedIntent, type SignedIntent } from "../signatures";

/** Public Hardhat/Anvil account #0. Test fixture only, not a real key. */
const KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

describe("verifySignedIntent", () => {
  it("accepts a valid join signature and rejects expiry / wrong action", async () => {
    const account = privateKeyToAccount(KEY);
    const intent: SignedIntent = {
      address: account.address,
      nonce: "aabbccddeeff0011",
      expiresAt: Date.now() + 60_000,
      action: "join",
      week: 0,
      chainId: 11155111,
    };
    const signature = await account.signMessage({ message: buildSignMessage(intent) });
    const ok = await verifySignedIntent(intent, signature, {
      action: "join",
      chainId: 11155111,
    });
    expect(ok).toEqual({ ok: true });

    const expired = await verifySignedIntent(
      { ...intent, expiresAt: Date.now() - 1 },
      signature,
      { action: "join", chainId: 11155111 },
    );
    expect(expired.ok).toBe(false);

    const wrong = await verifySignedIntent(intent, signature, {
      action: "ready",
      chainId: 11155111,
    });
    expect(wrong.ok).toBe(false);
  });

  it("verifies a save intent", async () => {
    const account = privateKeyToAccount(KEY);
    const intent: SignedIntent = {
      address: account.address,
      nonce: "1122334455667788",
      expiresAt: Date.now() + 60_000,
      action: "save",
      week: 1,
      chainId: 11155111,
    };
    const signature = await account.signMessage({ message: buildSignMessage(intent) });
    const ok = await verifySignedIntent(intent, signature, { action: "save", chainId: 11155111 });
    expect(ok).toEqual({ ok: true });
  });
});
