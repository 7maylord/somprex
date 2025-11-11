import type { Hex } from "viem";

export enum MarketType {
  BLOCK = 0,
  TRANSFER = 1,
  GAME = 2,
}

export enum MarketStatus {
  ACTIVE = 0,
  LOCKED = 1,
  RESOLVED = 2,
  CANCELLED = 3,
}

export interface Market {
  marketId: Hex;
  marketType: MarketType;
  question: string;
  creator: Hex;
  createdAt: bigint;
  resolutionTime: bigint;
  status: MarketStatus;
  winningOption: number;
  totalPool: bigint;
  optionPools: [bigint, bigint];
  dataSourceId: Hex;
  threshold: bigint;
  thresholdToken: Hex;
}

export interface Bet {
  bettor: Hex;
  marketId: Hex;
  option: number; // 0 = YES, 1 = NO
  amount: bigint;
  timestamp: bigint;
  claimed: boolean;
}

export interface Odds {
  yes: number;
  no: number;
  yesProb: number;
  noProb: number;
}

export interface GameSession {
  sessionId: Hex;
  player: Hex;
  startTime: bigint;
  endTime: bigint;
  bossLevel: number;
  defeated: boolean;
  damageDealt: bigint;
  timeTaken: bigint;
}

export interface Player {
  playerAddress: Hex;
  totalGames: bigint;
  victories: bigint;
  currentLevel: number;
}

export interface BlockData {
  blockNumber: bigint;
  timestamp: bigint;
  txCount: bigint;
  gasUsed: bigint;
}

export interface TransferEvent {
  from: Hex;
  to: Hex;
  amount: bigint;
  timestamp: bigint;
}

export interface MarketFormData {
  marketType: MarketType;
  question: string;
  duration: number; // in seconds
  threshold?: number; // for block/transfer markets
}

export interface BetFormData {
  marketId: Hex;
  option: number;
  amount: string;
}