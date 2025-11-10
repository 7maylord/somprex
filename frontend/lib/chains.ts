import { defineChain } from "viem";

export const somniaTestnet = defineChain({
  id: 50312,
  name: "Somnia Testnet",
  network: "somnia-testnet",
  nativeCurrency: {
    decimals: 18,
    name: "Somnia Token",
    symbol: "SOMI",
  },
  rpcUrls: {
    default: {
      http: ["https://dream-rpc.somnia.network"],
    },
    public: {
      http: ["https://dream-rpc.somnia.network"],
    },
  },
  blockExplorers: {
    default: {
      name: "Somnia Explorer",
      url: "https://explorer.somnia.network",
    },
  },
  testnet: true,
});
