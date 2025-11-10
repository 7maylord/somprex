'use client'

import { useEffect, useState } from 'react'
import { useReadContract } from 'wagmi'
import { ArrowRightLeft, Database } from 'lucide-react'
import MarketCard from './MarketCard'
import type { Market } from '@/lib/types'
import { useTokenTransfers } from '@/hooks/useSDS'
import { PredictionMarketABI } from '@/abis'

const SOMI_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000' as `0x${string}` // Replace with actual

export default function TransferMarkets() {
  const [markets, setMarkets] = useState<Market[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const { data: marketIds } = useReadContract({
    address: (process.env.NEXT_PUBLIC_MARKET_CONTRACT) as `0x${string}`,
    abi: PredictionMarketABI,
    functionName: 'getActiveMarkets',
  })

  const { latestTransfer } = useTokenTransfers(null, null, SOMI_TOKEN_ADDRESS, false) // SDS integration

  useEffect(() => {
    const fetchMarkets = async () => {
      if (!marketIds || !Array.isArray(marketIds) || marketIds.length === 0) {
        setIsLoading(false)
        return
      }

      try {
        const mockMarkets: Market[] = [
          {
            marketId: '0x0003' as `0x${string}`,
            marketType: 1,
            question: 'Will the next SOMI transfer be over 1000 tokens?',
            creator: '0x0000000000000000000000000000000000000000' as `0x${string}`,
            createdAt: BigInt(Date.now() - 2400000),
            resolutionTime: BigInt(Date.now() + 5400000),
            status: 0,
            winningOption: 0,
            totalPool: BigInt('6000000000000000000'),
            optionPools: [BigInt('3500000000000000000'), BigInt('2500000000000000000')],
            dataSourceId: '0x0000' as `0x${string}`,
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
        <h3 className="text-xl font-semibold mb-2">No Transfer Markets Yet</h3>
        <p className="text-gray-400 mb-6">
          Create a prediction market for token transfer amounts!
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Live Transfer Stats */}
      {latestTransfer && (
        <div className="card mb-6 bg-gradient-to-r from-green-900/20 to-emerald-900/20 border-green-500/30">
          <div className="flex items-center space-x-2 mb-2">
            <ArrowRightLeft className="w-5 h-5 text-green-500 animate-pulse" />
            <span className="font-semibold">Latest Transfer</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-400">Amount</div>
              <div className="font-bold">{(Number(latestTransfer.amount) / 1e18).toFixed(2)} SOMI</div>
            </div>
            <div>
              <div className="text-gray-400">Time</div>
              <div className="font-bold">Just now</div>
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