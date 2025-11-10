import { useEffect, useState, useCallback, useRef } from 'react';
import { type SDK, type SchemaEncoder } from '@somnia-chain/streams';
import { type Hex } from 'viem';
import {
  createSDK,
  initializeSchemas,
  subscribeToNewMarkets,
  subscribeToBets,
  subscribeToResolutions,
  subscribeToBlockData,
  subscribeToTransfers,
  subscribeToBossDefeats,
  subscribeToLevelUps,
  SCHEMAS,
} from '@/lib/sds';
import type { MarketType } from '@/lib/types';

/**
 * Hook to create and initialize SDS SDK
 */
export const useSDK = (rpcUrl: string, privateKey?: Hex) => {
  const [sdk, setSDK] = useState<SDK | null>(null);
  const [encoders, setEncoders] = useState<Map<string, SchemaEncoder> | null>(null);
  const [schemaIds, setSchemaIds] = useState<Map<string, Hex> | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        const sdkInstance = createSDK(rpcUrl, privateKey);
        const { encoders: enc, ids } = await initializeSchemas(sdkInstance);

        setSDK(sdkInstance);
        setEncoders(enc);
        setSchemaIds(ids);
        setIsInitialized(true);
      } catch (err) {
        setError(err as Error);
        console.error('Failed to initialize SDK:', err);
      }
    };

    initialize();
  }, [rpcUrl, privateKey]);

  return { sdk, encoders, schemaIds, isInitialized, error };
};

/**
 * Hook to subscribe to new markets
 */
export const useNewMarkets = (
  sdk: SDK | null,
  encoder: SchemaEncoder | null,
  enabled: boolean = true
) => {
  const [markets, setMarkets] = useState<Array<{
    marketId: Hex;
    marketType: MarketType;
    question: string;
    resolutionTime: bigint;
    dataSourceId: Hex;
  }>>([]);

  useEffect(() => {
    if (!sdk || !encoder || !enabled) return;

    const callback = (market: any) => {
      setMarkets(prev => [market, ...prev]);
    };

    subscribeToNewMarkets(sdk, encoder, callback);
  }, [sdk, encoder, enabled]);

  return markets;
};

/**
 * Hook to subscribe to bets for a market
 */
export const useMarketBets = (
  sdk: SDK | null,
  encoder: SchemaEncoder | null,
  marketId: Hex | null,
  enabled: boolean = true
) => {
  const [bets, setBets] = useState<Array<{
    bettor: Hex;
    option: number;
    amount: bigint;
    timestamp: bigint;
  }>>([]);

  useEffect(() => {
    if (!sdk || !encoder || !marketId || !enabled) return;

    const callback = (bet: any) => {
      setBets(prev => [...prev, bet]);
    };

    subscribeToBets(sdk, encoder, marketId, callback);
  }, [sdk, encoder, marketId, enabled]);

  return bets;
};

/**
 * Hook to subscribe to market resolutions
 */
export const useMarketResolutions = (
  sdk: SDK | null,
  encoder: SchemaEncoder | null,
  marketId: Hex | null = null,
  enabled: boolean = true
) => {
  const [resolutions, setResolutions] = useState<Array<{
    marketId: Hex;
    winningOption: number;
    totalPool: bigint;
    timestamp: bigint;
  }>>([]);

  useEffect(() => {
    if (!sdk || !encoder || !enabled) return;

    const callback = (resolution: any) => {
      setResolutions(prev => [...prev, resolution]);
    };

    subscribeToResolutions(sdk, encoder, marketId, callback);
  }, [sdk, encoder, marketId, enabled]);

  return resolutions;
};

/**
 * Hook to subscribe to block data
 */
export const useBlockData = (
  sdk: SDK | null,
  encoder: SchemaEncoder | null,
  enabled: boolean = true
) => {
  const [blocks, setBlocks] = useState<Array<{
    blockNumber: bigint;
    timestamp: bigint;
    txCount: bigint;
    gasUsed: bigint;
  }>>([]);

  const [latestBlock, setLatestBlock] = useState<{
    blockNumber: bigint;
    timestamp: bigint;
    txCount: bigint;
    gasUsed: bigint;
  } | null>(null);

  useEffect(() => {
    if (!sdk || !encoder || !enabled) return;

    const callback = (block: any) => {
      setLatestBlock(block);
      setBlocks(prev => [block, ...prev].slice(0, 100)); // Keep last 100 blocks
    };

    subscribeToBlockData(sdk, encoder, callback);
  }, [sdk, encoder, enabled]);

  return { blocks, latestBlock };
};

/**
 * Hook to subscribe to token transfers
 */
export const useTokenTransfers = (
  sdk: SDK | null,
  encoder: SchemaEncoder | null,
  tokenAddress: Hex,
  enabled: boolean = true
) => {
  const [transfers, setTransfers] = useState<Array<{
    from: Hex;
    to: Hex;
    amount: bigint;
    timestamp: bigint;
  }>>([]);

  const [latestTransfer, setLatestTransfer] = useState<{
    from: Hex;
    to: Hex;
    amount: bigint;
    timestamp: bigint;
  } | null>(null);

  useEffect(() => {
    if (!sdk || !encoder || !enabled) return;

    const callback = (transfer: any) => {
      setLatestTransfer(transfer);
      setTransfers(prev => [transfer, ...prev].slice(0, 50)); // Keep last 50 transfers
    };

    subscribeToTransfers(sdk, encoder, tokenAddress, callback);
  }, [sdk, encoder, tokenAddress, enabled]);

  return { transfers, latestTransfer };
};

/**
 * Hook to subscribe to boss defeats
 */
export const useBossDefeats = (
  sdk: SDK | null,
  encoder: SchemaEncoder | null,
  enabled: boolean = true
) => {
  const [defeats, setDefeats] = useState<Array<{
    sessionId: Hex;
    player: Hex;
    timeTaken: bigint;
    totalDamage: bigint;
  }>>([]);

  useEffect(() => {
    if (!sdk || !encoder || !enabled) return;

    const callback = (defeat: any) => {
      setDefeats(prev => [defeat, ...prev]);
    };

    subscribeToBossDefeats(sdk, encoder, callback);
  }, [sdk, encoder, enabled]);

  return defeats;
};

/**
 * Hook to subscribe to level ups
 */
export const useLevelUps = (
  sdk: SDK | null,
  encoder: SchemaEncoder | null,
  enabled: boolean = true
) => {
  const [levelUps, setLevelUps] = useState<Array<{
    player: Hex;
    newLevel: number;
    timestamp: bigint;
  }>>([]);

  useEffect(() => {
    if (!sdk || !encoder || !enabled) return;

    const callback = (levelUp: any) => {
      setLevelUps(prev => [levelUp, ...prev]);
    };

    subscribeToLevelUps(sdk, encoder, callback);
  }, [sdk, encoder, enabled]);

  return levelUps;
};

/**
 * Hook for real-time odds calculation
 */
export const useMarketOdds = (
  yesPool: bigint,
  noPool: bigint
) => {
  const [odds, setOdds] = useState({
    yes: 2.0,
    no: 2.0,
    yesProb: 50,
    noProb: 50,
  });

  useEffect(() => {
    const totalPool = yesPool + noPool;

    if (totalPool === BigInt(0)) {
      setOdds({
        yes: 2.0,
        no: 2.0,
        yesProb: 50,
        noProb: 50,
      });
      return;
    }

    const yesOdds = Number(totalPool) / Number(yesPool || BigInt(1));
    const noOdds = Number(totalPool) / Number(noPool || BigInt(1));

    const yesProb = (Number(yesPool) / Number(totalPool)) * 100;
    const noProb = (Number(noPool) / Number(totalPool)) * 100;

    setOdds({
      yes: parseFloat(yesOdds.toFixed(2)),
      no: parseFloat(noOdds.toFixed(2)),
      yesProb: parseFloat(yesProb.toFixed(1)),
      noProb: parseFloat(noProb.toFixed(1)),
    });
  }, [yesPool, noPool]);

  return odds;
};