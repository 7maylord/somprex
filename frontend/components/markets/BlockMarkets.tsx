'use client'

import { useEffect, useState } from 'react'
import { useReadContract } from 'wagmi'
import { Activity, Database } from 'lucide-react'
import MarketCard from './MarketCard'
import type { Market } from '@/lib/types'
import { useBlockData } from '@/hooks/useSDS'
import { PredictionMarketABI } from '@/abis'

export default function BlockMarkets() {
  const [markets, setMarkets] = useState<Market[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const { data: marketIds } = useReadContract({
    address: (process.env.NEXT_PUBLIC_MARKET_CONTRACT) as `0x${string}`,
    abi: PredictionMarketABI,
    functionName: 'getActiveMarkets',
  })

  const { latestBlock } = useBlockData(null, null, false) // SDS integration

  useEffect(() => {
    const fetchMarkets = async () => {
      if (!marketIds || !Array.isArray(marketIds) || marketIds.length === 0) {
        setIsLoading(false)
        return
      }

      try {
        // In production, fetch all market details
        // For now, using mock data filtered by type
        const mockMarkets: Market[] = [
          {
            marketId: '0x0001' as `0x${string}`,
            marketType: 0,
            question: 'Will the next block have more than 100 transactions?',
            creator: '0x0000000000000000000000000000000000000000' as `0x${string}`,
            createdAt: BigInt(Date.now() - 3600000),
            resolutionTime: BigInt(Date.now() + 7200000),
            status: 0,
            winningOption: 0,
            totalPool: BigInt('5000000000000000000'),
            optionPools: [BigInt('3000000000000000000'), BigInt('2000000000000000000')],
            dataSourceId: '0x0000' as `0x${string}`,
            threshold: BigInt(100),
            thresholdToken: '0x0000000000000000000000000000000000000000' as `0x${string}`,
          },
          {
            marketId: '0x0002' as `0x${string}`,
            marketType: 0,
            question: 'Will block time be under 1 second?',
            creator: '0x0000000000000000000000000000000000000000' as `0x${string}`,
            createdAt: BigInt(Date.now() - 1800000),
            resolutionTime: BigInt(Date.now() + 3600000),
            status: 0,
            winningOption: 0,
            totalPool: BigInt('8000000000000000000'),
            optionPools: [BigInt('5000000000000000000'), BigInt('3000000000000000000')],
            dataSourceId: '0x0000' as `0x${string}`,
            threshold: BigInt(1),
            thresholdToken: '0x0000000000000000000000000000000000000000' as `0x${string}`,
          },
        ]

        setMarkets(mockMarkets)
      } catch (error) {
        console.error('Error fetching markets:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchMarkets()
  }, [marketIds])

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card animate-shimmer h-64" />
        ))}
      </div>
    )
  }

  if (markets.length === 0) {
    return (
      <div className="card text-center py-12">
        <Database className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">No Block Markets Yet</h3>
        <p className="text-gray-400 mb-6">
          Be the first to create a prediction market for blockchain metrics!
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Live Block Stats */}
      {latestBlock && (
        <div className="card mb-6 bg-gradient-to-r from-blue-900/20 to-cyan-900/20 border-blue-500/30">
          <div className="flex items-center space-x-2 mb-2">
            <Activity className="w-5 h-5 text-blue-500 animate-pulse" />
            <span className="font-semibold">Live Block Data</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-400">Block #</div>
              <div className="font-bold">{latestBlock.blockNumber.toString()}</div>
            </div>
            <div>
              <div className="text-gray-400">TX Count</div>
              <div className="font-bold">{latestBlock.txCount.toString()}</div>
            </div>
            <div>
              <div className="text-gray-400">Gas Used</div>
              <div className="font-bold">{(Number(latestBlock.gasUsed) / 1e6).toFixed(2)}M</div>
            </div>
          </div>
        </div>
      )}

      {/* Markets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {markets.map((market) => (
          <MarketCard key={market.marketId} market={market} />
        ))}
      </div>
    </div>
  )
}