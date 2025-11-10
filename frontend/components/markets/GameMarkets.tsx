'use client'

import { useEffect, useState } from 'react'
import { useReadContract } from 'wagmi'
import { Gamepad2, Database, Swords } from 'lucide-react'
import Link from 'next/link'
import MarketCard from './MarketCard'
import type { Market } from '@/lib/types'
import { useBossDefeats } from '@/hooks/useSDS'
import { PredictionMarketABI } from '@/abis'

export default function GameMarkets() {
  const [markets, setMarkets] = useState<Market[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const { data: marketIds } = useReadContract({
    address: (process.env.NEXT_PUBLIC_MARKET_CONTRACT) as `0x${string}`,
    abi: PredictionMarketABI,
    functionName: 'getActiveMarkets',
  })

  const defeats = useBossDefeats(null, null, false) // SDS integration

  useEffect(() => {
    const fetchMarkets = async () => {
      if (!marketIds || !Array.isArray(marketIds) || marketIds.length === 0) {
        setIsLoading(false)
        return
      }

      try {
        const mockMarkets: Market[] = [
          {
            marketId: '0x0004' as `0x${string}`,
            marketType: 2,
            question: 'Will the next boss be defeated in under 60 seconds?',
            creator: '0x0000000000000000000000000000000000000000' as `0x${string}`,
            createdAt: BigInt(Date.now() - 1200000),
            resolutionTime: BigInt(Date.now() + 4800000),
            status: 0,
            winningOption: 0,
            totalPool: BigInt('10000000000000000000'),
            optionPools: [BigInt('6000000000000000000'), BigInt('4000000000000000000')],
            dataSourceId: '0x0000' as `0x${string}`,
          },
          {
            marketId: '0x0005' as `0x${string}`,
            marketType: 2,
            question: 'Will a player level up in the next game session?',
            creator: '0x0000000000000000000000000000000000000000' as `0x${string}`,
            createdAt: BigInt(Date.now() - 600000),
            resolutionTime: BigInt(Date.now() + 3000000),
            status: 0,
            winningOption: 0,
            totalPool: BigInt('4000000000000000000'),
            optionPools: [BigInt('2200000000000000000'), BigInt('1800000000000000000')],
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
        <h3 className="text-xl font-semibold mb-2">No Game Markets Yet</h3>
        <p className="text-gray-400 mb-6">
          Create a prediction market for in-game events!
        </p>
        <Link href="/game">
          <button className="btn-primary flex items-center space-x-2 mx-auto">
            <Gamepad2 className="w-5 h-5" />
            <span>Play Boss Battle</span>
          </button>
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Call to Action */}
      <div className="card mb-6 bg-gradient-to-r from-purple-900/20 to-pink-900/20 border-purple-500/30">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <Swords className="w-5 h-5 text-purple-500" />
              <span className="font-semibold">Generate Events</span>
            </div>
            <p className="text-sm text-gray-400">
              Play the boss battle to create on-chain events for these markets
            </p>
          </div>
          <Link href="/game">
            <button className="btn-primary flex items-center space-x-2">
              <Gamepad2 className="w-4 h-4" />
              <span>Play Now</span>
            </button>
          </Link>
        </div>
      </div>

      {/* Latest Defeats */}
      {defeats.length > 0 && (
        <div className="card mb-6">
          <h3 className="font-semibold mb-3">🏆 Recent Boss Defeats</h3>
          <div className="space-y-2">
            {defeats.slice(0, 3).map((defeat, i) => (
              <div
                key={i}
                className="bg-gray-700/50 rounded-lg p-3 flex justify-between items-center text-sm"
              >
                <span className="text-gray-400">
                  Player defeated boss in {Number(defeat.timeTaken)}s
                </span>
                <span className="font-bold text-primary-400">
                  {Number(defeat.totalDamage)} damage
                </span>
              </div>
            ))}
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