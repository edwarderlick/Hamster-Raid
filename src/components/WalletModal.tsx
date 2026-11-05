import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { sfx } from "../audio";

export function WalletModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { connectors, connect, isPending, error } = useConnect();
  const { isConnected, address, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  if (!open) return null;
  const wrong = isConnected && chainId !== sepolia.id;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-title"
    >
      <div className="pixel-border w-full max-w-md rounded-2xl bg-navy-800 p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id="wallet-title" className="font-pixel text-[11px] leading-5 text-ember-400">
            Connect Wallet
          </h2>
          <button onClick={onClose} className="text-white/60 hover:text-white" aria-label="Close">
            ✕
          </button>
        </div>
        <p className="mt-3 text-sm text-white/70">
          Signatures only. Hamster Raid never asks you to send a transaction or spend gas.
        </p>
        {wrong && (
          <div className="mt-4 rounded-lg border border-ember-500/40 bg-ember-500/10 p-3 text-sm">
            Switch to Sepolia (11155111) to raid.
            <button
              className="ml-2 underline"
              onClick={() => switchChain({ chainId: sepolia.id })}
            >
              Switch network
            </button>
          </div>
        )}
        {isConnected && !wrong ? (
          <div className="mt-4 space-y-3">
            <p className="font-display text-lg">
              {address?.slice(0, 6)}…{address?.slice(-4)}
            </p>
            <p className="text-sm text-volt-400">Sepolia connected.</p>
            <button
              className="rounded-lg border border-white/20 px-3 py-2 text-sm"
              onClick={() => disconnect()}
            >
              Disconnect
            </button>
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {connectors.map((c) => (
              <li key={c.uid}>
                <button
                  className="flex w-full items-center justify-between rounded-xl border border-volt-500/30 bg-navy-900 px-4 py-3 text-left hover:border-ember-400"
                  disabled={isPending}
                  onClick={() => {
                    sfx.click();
                    connect({ connector: c, chainId: sepolia.id });
                  }}
                >
                  <span className="font-display font-semibold">{c.name}</span>
                  <span className="text-xs text-white/40">
                    {c.type === "injected" ? "Browser" : c.type}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="mt-3 text-sm text-red-400">{error.message}</p>}
      </div>
    </div>
  );
}
