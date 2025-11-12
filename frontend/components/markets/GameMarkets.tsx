'use client'

import { useEffect, useState } from 'react'
import { useReadContract, usePublicClient } from 'wagmi'
import { Gamepad2, Database, Swords } from 'lucide-react'
import Link from 'next/link'
import MarketCard from './MarketCard'
import type { Market } from '@/lib/types'
import { PredictionMarketABI } from '@/abis'

export default function GameMarkets() {
  const [markets, setMarkets] = useState<Market[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const publicClient = usePublicClient()

  const { data: marketIds } = useReadContract({
    address: (process.env.NEXT_PUBLIC_MARKET_CONTRACT) as `0x${string}`,
    abi: PredictionMarketABI,
    functionName: 'getActiveMarkets',
  })

  useEffect(() => {
    const fetchMarkets = async () => {
      console.log('GameMarkets - marketIds:', marketIds)
      console.log('GameMarkets - publicClient:', publicClient)

      if (!marketIds || !Array.isArray(marketIds) || marketIds.length === 0 || !publicClient) {
        console.log('GameMarkets - Early return:', {
          hasMarketIds: !!marketIds,
          isArray: Array.isArray(marketIds),
          length: Array.isArray(marketIds) ? marketIds.length : 0,
          hasPublicClient: !!publicClient
        })
        setIsLoading(false)
        return
      }

      try {
        const fetchedMarkets: Market[] = []

        // Fetch each market's details
        for (const marketId of marketIds) {
          try {
            console.log(`GameMarkets - Fetching market ${marketId}`)
            const marketData = await publicClient.readContract({
              address: process.env.NEXT_PUBLIC_MARKET_CONTRACT as `0x${string}`,
              abi: PredictionMarketABI,
              functionName: 'markets',
              args: [marketId],
            }) as any

            console.log(`GameMarkets - Market ${marketId} raw data:`, marketData)

            // Markets returns: [marketId, marketType, question, creator, createdAt, resolutionTime, status, winningOption, totalPool, optionPool0, optionPool1, dataSourceId, threshold, thresholdToken]
            // Note: optionPools array [YES, NO] is flattened into two separate values
            const [, marketType, question, creator, createdAt, resolutionTime, status, winningOption, totalPool, optionPool0, optionPool1, dataSourceId, threshold, thresholdToken] = marketData

            const optionPools: [bigint, bigint] = [optionPool0 as bigint, optionPool1 as bigint]

            console.log(`GameMarkets - Market ${marketId} parsed:`, {
              marketType,
              status,
              question
            })

            // Only include GAME markets (marketType === 2)
            if (marketType === 2 && status === 0) {
              fetchedMarkets.push({
                marketId: marketId as `0x${string}`,
                marketType,
                question,
                creator,
                createdAt,
                resolutionTime,
                status,
                winningOption,
                totalPool,
                optionPools,
                dataSourceId,
                threshold,
                thresholdToken,
              })
              console.log(`GameMarkets - Added GAME market ${marketId}`)
            }
          } catch (err) {
            console.error(`Failed to fetch market ${marketId}:`, err)
          }
        }

        console.log('GameMarkets - Total fetched markets:', fetchedMarkets.length)
        setMarkets(fetchedMarkets)
      } catch (error) {
        console.error('Error fetching markets:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchMarkets()
  }, [marketIds, publicClient])

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
      <div className="card mb-6 bg-gradient-to-r from-blue-900/20 to-cyan-900/20 border-blue-500/30">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <Swords className="w-5 h-5 text-blue-500" />
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

      {/* Markets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {markets.map((market) => (
          <MarketCard key={market.marketId} market={market} />
        ))}
      </div>
    </div>
  )
}