import { http, createConfig, createStorage } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected, metaMask, walletConnect } from "wagmi/connectors";

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
const connectors = [
  injected({ shimDisconnect: true }),
  metaMask(),
  ...(projectId ? [walletConnect({ projectId, showQrModal: true })] : []),
];

export const config = createConfig({
  chains: [sepolia],
  connectors,
  transports: {
    [sepolia.id]: http(),
  },
  storage: createStorage({ storage: localStorage }),
});
