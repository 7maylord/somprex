// Helper functions for interacting with deployed contracts
import { createPublicClient, createWalletClient, http, type Address, type Hex } from "viem";
import { somniaTestnet } from "./chains";
import { ABIS } from "@/abis";

/**
 * Get contract address for a given contract name
 */
export function getContractAddress(contractName: keyof typeof ABIS): Address {
  const envMap: Record<string, string> = {
    PredictionMarket: process.env.NEXT_PUBLIC_MARKET_CONTRACT || '',
    BossBattleGame: process.env.NEXT_PUBLIC_GAME_CONTRACT || '',
  };
  
  const address = envMap[contractName];
  if (!address) {
    throw new Error(`Contract address not found for ${contractName}. Please set the appropriate environment variable.`);
  }
  return address as Address;
}

/**
 * Get ABI for a given contract name
 */
export function getContractABI(contractName: keyof typeof ABIS) {
  return ABIS[contractName];
}

/**
 * Create a contract instance using viem
 * Example usage:
 * 
 * const publicClient = createPublicClient({
 *   chain: somniaTestnet,
 *   transport: http(rpcUrl),
 * });
 * 
 * const marketContract = getContract(publicClient, 'PredictionMarket');
 * const markets = await marketContract.read.getAllMarkets();
 */
export function getContract(publicClient: any, contractName: keyof typeof ABIS) {
  const address = getContractAddress(contractName);
  const abi = getContractABI(contractName);
  
  return {
    address,
    abi,
    // Helper to read from contract
    read: {
      // You can add typed read methods here or use publicClient.readContract directly
    },
  };
}

/**
 * Example: Read all markets from PredictionMarket contract
 */
export async function readAllMarkets(publicClient: any) {
  const contract = getContract(publicClient, 'PredictionMarket');
  return await publicClient.readContract({
    address: contract.address,
    abi: contract.abi,
    functionName: 'getAllMarkets',
  });
}

/**
 * Example: Create a market
 */
export async function createMarket(
  walletClient: any,
  marketType: number,
  question: string,
  resolutionTime: bigint,
  dataSourceId: Hex
) {
  const contract = getContract(walletClient, 'PredictionMarket');
  return await walletClient.writeContract({
    address: contract.address,
    abi: contract.abi,
    functionName: 'createMarket',
    args: [marketType, question, resolutionTime, dataSourceId],
  });
}

/**
 * Example: Place a bet
 */
export async function placeBet(
  walletClient: any,
  marketId: Hex,
  option: number,
  amount: bigint
) {
  const contract = getContract(walletClient, 'PredictionMarket');
  return await walletClient.writeContract({
    address: contract.address,
    abi: contract.abi,
    functionName: 'placeBet',
    args: [marketId, option],
    value: amount,
  });
}

