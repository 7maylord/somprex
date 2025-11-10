import { SDK, SchemaEncoder, type SubscriptionCallback } from "@somnia-chain/streams";
import { createPublicClient, createWalletClient, http, toHex, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { somniaTestnet } from "./chains";
import type { MarketType } from "./types";

/**
 * Schema Definitions
 * All event schemas used in the prediction market
 */
export const SCHEMAS = {
  MARKET_CREATED: `bytes32 marketId, uint8 marketType, string question, uint256 resolutionTime, bytes32 dataSourceId`,
  BET_PLACED: `bytes32 marketId, address bettor, uint8 option, uint256 amount, uint256 timestamp`,
  MARKET_RESOLVED: `bytes32 marketId, uint8 winningOption, uint256 totalPool, uint256 timestamp`,
  BLOCK_DATA: `uint256 blockNumber, uint256 timestamp, uint256 txCount, uint256 gasUsed`,
  TRANSFER_EVENT: `address from, address to, uint256 amount, uint256 timestamp`,
  BOSS_DEFEATED: `bytes32 sessionId, address player, uint256 timeTaken, uint256 totalDamage`,
  PLAYER_LEVEL_UP: `address player, uint8 newLevel, uint256 timestamp`,
} as const;

/**
 * Create SDS SDK instance
 * Pure function that returns configured SDK
 */
export const createSDK = (rpcUrl: string, privateKey?: Hex): SDK => {
  const publicClient = createPublicClient({
    chain: somniaTestnet,
    transport: http(rpcUrl),
  });

  if (privateKey) {
    const account = privateKeyToAccount(privateKey);
    const walletClient = createWalletClient({
      chain: somniaTestnet,
      account,
      transport: http(rpcUrl),
    });

    return new SDK({
      public: publicClient,
      wallet: walletClient,
    });
  }

  // Read-only SDK for subscriptions
  return new SDK({
    public: publicClient,
  });
};

/**
 * Create schema encoder for a given schema
 */
export const createSchemaEncoder = (schema: string): SchemaEncoder => {
  return new SchemaEncoder(schema);
};

/**
 * Compute schema ID from schema string
 */
export const computeSchemaId = async (
  sdk: SDK,
  schema: string
): Promise<Hex> => {
  const result = await sdk.streams.computeSchemaId(schema);
  if (!result) {
    throw new Error('Failed to compute schema ID');
  }
  return result;
};

/**
 * Initialize all schemas and return encoders + IDs
 */
export const initializeSchemas = async (
  sdk: SDK
): Promise<{
  encoders: Map<string, SchemaEncoder>;
  ids: Map<string, Hex>;
}> => {
  const encoders = new Map<string, SchemaEncoder>();
  const ids = new Map<string, Hex>();

  for (const [name, schema] of Object.entries(SCHEMAS)) {
    const encoder = createSchemaEncoder(schema);
    const schemaId = await computeSchemaId(sdk, schema);

    encoders.set(name, encoder);
    ids.set(name, schemaId);
  }

  return { encoders, ids };
};

/**
 * Encode market creation data
 */
export const encodeMarketCreated = (
  encoder: SchemaEncoder,
  marketId: Hex,
  marketType: MarketType,
  question: string,
  resolutionTime: bigint,
  dataSourceId: Hex
): Hex => {
  return encoder.encodeData([
    { name: "marketId", value: marketId, type: "bytes32" },
    { name: "marketType", value: marketType.toString(), type: "uint8" },
    { name: "question", value: question, type: "string" },
    { name: "resolutionTime", value: resolutionTime.toString(), type: "uint256" },
    { name: "dataSourceId", value: dataSourceId, type: "bytes32" },
  ]);
};

/**
 * Encode bet placement data
 */
export const encodeBetPlaced = (
  encoder: SchemaEncoder,
  marketId: Hex,
  bettor: Hex,
  option: number,
  amount: bigint,
  timestamp: bigint
): Hex => {
  return encoder.encodeData([
    { name: "marketId", value: marketId, type: "bytes32" },
    { name: "bettor", value: bettor, type: "address" },
    { name: "option", value: option.toString(), type: "uint8" },
    { name: "amount", value: amount.toString(), type: "uint256" },
    { name: "timestamp", value: timestamp.toString(), type: "uint256" },
  ]);
};

/**
 * Encode market resolution data
 */
export const encodeMarketResolved = (
  encoder: SchemaEncoder,
  marketId: Hex,
  winningOption: number,
  totalPool: bigint,
  timestamp: bigint
): Hex => {
  return encoder.encodeData([
    { name: "marketId", value: marketId, type: "bytes32" },
    { name: "winningOption", value: winningOption.toString(), type: "uint8" },
    { name: "totalPool", value: totalPool.toString(), type: "uint256" },
    { name: "timestamp", value: timestamp.toString(), type: "uint256" },
  ]);
};

/**
 * Publish market created event to SDS
 */
export const publishMarketCreated = async (
  sdk: SDK,
  schemaId: Hex,
  encodedData: Hex,
  marketId: Hex
): Promise<string> => {
  const tx = await sdk.streams.set([
    {
      id: marketId,
      schemaId,
      data: encodedData,
    },
  ]);

  if (!tx) {
    throw new Error('Failed to publish market created event to SDS');
  }

  // Emit event for real-time subscribers
  await sdk.streams.emitEvents([
    {
      id: "MarketCreated",
      argumentTopics: [marketId],
      data: encodedData,
    },
  ]);

  return tx;
};

/**
 * Publish bet placed event to SDS
 */
export const publishBetPlaced = async (
  sdk: SDK,
  schemaId: Hex,
  encodedData: Hex,
  marketId: Hex,
  bettor: Hex,
  timestamp: bigint
): Promise<string> => {
  const betId = toHex(`${marketId}-${bettor}-${timestamp}`, { size: 32 });

  const tx = await sdk.streams.set([
    {
      id: betId,
      schemaId,
      data: encodedData,
    },
  ]);

  if (!tx) {
    throw new Error('Failed to publish bet placed event to SDS');
  }

  // Emit for instant notification
  await sdk.streams.emitEvents([
    {
      id: "BetPlaced",
      argumentTopics: [marketId],
      data: encodedData,
    },
  ]);

  return tx;
};

/**
 * Publish market resolution to SDS
 */
export const publishMarketResolved = async (
  sdk: SDK,
  schemaId: Hex,
  encodedData: Hex,
  marketId: Hex
): Promise<string> => {
  const tx = await sdk.streams.set([
    {
      id: marketId,
      schemaId,
      data: encodedData,
    },
  ]);

  if (!tx) {
    throw new Error('Failed to publish market resolved event to SDS');
  }

  // Emit for instant notification
  await sdk.streams.emitEvents([
    {
      id: "MarketResolved",
      argumentTopics: [marketId],
      data: encodedData,
    },
  ]);

  return tx;
};

/**
 * Subscribe to new markets
 */
export const subscribeToNewMarkets = async (
  sdk: SDK,
  encoder: SchemaEncoder,
  callback: (market: {
    marketId: Hex;
    marketType: MarketType;
    question: string;
    resolutionTime: bigint;
    dataSourceId: Hex;
  }) => void
): Promise<void> => {
  await sdk.streams.subscribe({
    somniaStreamsEventId: "MarketCreated",
    ethCalls: [],
    onlyPushChanges: false,
    onData: (data: SubscriptionCallback) => {
      const decoded = encoder.decodeData(data.result.data as Hex);
      callback({
        marketId: decoded[0].value.value as Hex,
        marketType: Number(decoded[1].value.value) as MarketType,
        question: decoded[2].value.value as string,
        resolutionTime: BigInt(decoded[3].value.value as string),
        dataSourceId: decoded[4].value.value as Hex,
      });
    },
  });
};

/**
 * Subscribe to bets for a specific market
 */
export const subscribeToBets = async (
  sdk: SDK,
  encoder: SchemaEncoder,
  marketId: Hex,
  callback: (bet: {
    bettor: Hex;
    option: number;
    amount: bigint;
    timestamp: bigint;
  }) => void
): Promise<void> => {
  await sdk.streams.subscribe({
    somniaStreamsEventId: "BetPlaced",
    ethCalls: [],
    onlyPushChanges: false,
    onData: (data: SubscriptionCallback) => {
      const decoded = encoder.decodeData(data.result.data as Hex);
      callback({
        bettor: decoded[1].value.value as Hex,
        option: Number(decoded[2].value.value),
        amount: BigInt(decoded[3].value.value as string),
        timestamp: BigInt(decoded[4].value.value as string),
      });
    },
  });
};

/**
 * Subscribe to market resolutions
 */
export const subscribeToResolutions = async (
  sdk: SDK,
  encoder: SchemaEncoder,
  marketId: Hex | null,
  callback: (resolution: {
    marketId: Hex;
    winningOption: number;
    totalPool: bigint;
    timestamp: bigint;
  }) => void
): Promise<void> => {
  await sdk.streams.subscribe({
    somniaStreamsEventId: "MarketResolved",
    ethCalls: [],
    onlyPushChanges: false,
    onData: (data: SubscriptionCallback) => {
      const decoded = encoder.decodeData(data.result.data as Hex);
      callback({
        marketId: decoded[0].value.value as Hex,
        winningOption: Number(decoded[1].value.value),
        totalPool: BigInt(decoded[2].value.value as string),
        timestamp: BigInt(decoded[3].value.value as string),
      });
    },
  });
};

/**
 * Subscribe to block data
 */
export const subscribeToBlockData = async (
  sdk: SDK,
  encoder: SchemaEncoder,
  callback: (block: {
    blockNumber: bigint;
    timestamp: bigint;
    txCount: bigint;
    gasUsed: bigint;
  }) => void
): Promise<void> => {
  await sdk.streams.subscribe({
    somniaStreamsEventId: "BlockProduced",
    ethCalls: [],
    onlyPushChanges: false,
    onData: (data: SubscriptionCallback) => {
      const decoded = encoder.decodeData(data.result.data as Hex);
      callback({
        blockNumber: BigInt(decoded[0].value.value as string),
        timestamp: BigInt(decoded[1].value.value as string),
        txCount: BigInt(decoded[2].value.value as string),
        gasUsed: BigInt(decoded[3].value.value as string),
      });
    },
  });
};

/**
 * Subscribe to token transfers
 */
export const subscribeToTransfers = async (
  sdk: SDK,
  encoder: SchemaEncoder,
  tokenAddress: Hex,
  callback: (transfer: {
    from: Hex;
    to: Hex;
    amount: bigint;
    timestamp: bigint;
  }) => void
): Promise<void> => {
  await sdk.streams.subscribe({
    somniaStreamsEventId: "Transfer",
    ethCalls: [],
    onlyPushChanges: false,
    onData: (data: SubscriptionCallback) => {
      const decoded = encoder.decodeData(data.result.data as Hex);
      callback({
        from: decoded[0].value.value as Hex,
        to: decoded[1].value.value as Hex,
        amount: BigInt(decoded[2].value.value as string),
        timestamp: BigInt(decoded[3].value.value as string),
      });
    },
  });
};

/**
 * Subscribe to boss defeats
 */
export const subscribeToBossDefeats = async (
  sdk: SDK,
  encoder: SchemaEncoder,
  callback: (event: {
    sessionId: Hex;
    player: Hex;
    timeTaken: bigint;
    totalDamage: bigint;
  }) => void
): Promise<void> => {
  await sdk.streams.subscribe({
    somniaStreamsEventId: "BossDefeated",
    ethCalls: [],
    onlyPushChanges: false,
    onData: (data: SubscriptionCallback) => {
      const decoded = encoder.decodeData(data.result.data as Hex);
      callback({
        sessionId: decoded[0].value.value as Hex,
        player: decoded[1].value.value as Hex,
        timeTaken: BigInt(decoded[2].value.value as string),
        totalDamage: BigInt(decoded[3].value.value as string),
      });
    },
  });
};

/**
 * Subscribe to player level ups
 */
export const subscribeToLevelUps = async (
  sdk: SDK,
  encoder: SchemaEncoder,
  callback: (event: {
    player: Hex;
    newLevel: number;
    timestamp: bigint;
  }) => void
): Promise<void> => {
  await sdk.streams.subscribe({
    somniaStreamsEventId: "PlayerLevelUp",
    ethCalls: [],
    onlyPushChanges: false,
    onData: (data: SubscriptionCallback) => {
      const decoded = encoder.decodeData(data.result.data as Hex);
      callback({
        player: decoded[0].value.value as Hex,
        newLevel: Number(decoded[1].value.value),
        timestamp: BigInt(decoded[2].value.value as string),
      });
    },
  });
};

/**
 * Calculate odds (pure function)
 */
export const calculateOdds = (
  yesPool: bigint,
  noPool: bigint
): {
  yes: number;
  no: number;
  yesProb: number;
  noProb: number;
} => {
  const totalPool = yesPool + noPool;

  if (totalPool === BigInt(0)) {
    return {
      yes: 2.0,
      no: 2.0,
      yesProb: 50,
      noProb: 50,
    };
  }

  const yesOdds = Number(totalPool) / Number(yesPool || BigInt(1));
  const noOdds = Number(totalPool) / Number(noPool || BigInt(1));

  const yesProb = (Number(yesPool) / Number(totalPool)) * 100;
  const noProb = (Number(noPool) / Number(totalPool)) * 100;

  return {
    yes: parseFloat(yesOdds.toFixed(2)),
    no: parseFloat(noOdds.toFixed(2)),
    yesProb: parseFloat(yesProb.toFixed(1)),
    noProb: parseFloat(noProb.toFixed(1)),
  };
};