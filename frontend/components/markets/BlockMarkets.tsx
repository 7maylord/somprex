'use client'

import { useEffect, useState } from 'react'
import { useReadContract, usePublicClient } from 'wagmi'
import { Activity, Database } from 'lucide-react'
import MarketCard from './MarketCard'
import type { Market } from '@/lib/types'
import { PredictionMarketABI } from '@/abis'

export default function BlockMarkets() {
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
      console.log('BlockMarkets - marketIds:', marketIds)
      console.log('BlockMarkets - publicClient:', publicClient)

      if (!marketIds || !Array.isArray(marketIds) || marketIds.length === 0 || !publicClient) {
        console.log('BlockMarkets - Early return:', {
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
            console.log(`BlockMarkets - Fetching market ${marketId}`)
            const marketData = await publicClient.readContract({
              address: process.env.NEXT_PUBLIC_MARKET_CONTRACT as `0x${string}`,
              abi: PredictionMarketABI,
              functionName: 'markets',
              args: [marketId],
            }) as any

            console.log(`BlockMarkets - Market ${marketId} raw data:`, marketData)

            // Markets returns: [marketId, marketType, question, creator, createdAt, resolutionTime, status, winningOption, totalPool, optionPools[2], dataSourceId, threshold, thresholdToken]
            // Note: optionPools is a single array [YES, NO], not two separate values
            const [, marketType, question, creator, createdAt, resolutionTime, status, winningOption, totalPool, optionPools, dataSourceId, threshold, thresholdToken] = marketData

            console.log(`BlockMarkets - Market ${marketId} parsed:`, {
              marketType,
              status,
              question
            })

            // Only include BLOCK markets (marketType === 0) that are ACTIVE or RESOLVED
            if (marketType === 0 && (status === 0 || status === 2)) {
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
              console.log(`BlockMarkets - Added BLOCK market ${marketId}`)
            }
          } catch (err) {
            console.error(`Failed to fetch market ${marketId}:`, err)
          }
        }

        console.log('BlockMarkets - Total fetched markets:', fetchedMarkets.length)
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
        <h3 className="text-xl font-semibold mb-2">No Block Markets Yet</h3>
        <p className="text-gray-400 mb-6">
          Be the first to create a prediction market for blockchain metrics!
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {markets.map((market) => (
        <MarketCard key={market.marketId} market={market} />
      ))}
    </div>
  )
}