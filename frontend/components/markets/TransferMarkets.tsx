'use client'

import { useEffect, useState } from 'react'
import { useReadContract, usePublicClient } from 'wagmi'
import { ArrowRightLeft, Database } from 'lucide-react'
import MarketCard from './MarketCard'
import type { Market } from '@/lib/types'
import { PredictionMarketABI } from '@/abis'

const SOMI_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_SOMI_TOKEN as `0x${string}` // Replace with actual

export default function TransferMarkets() {
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
      console.log('TransferMarkets - marketIds:', marketIds)
      console.log('TransferMarkets - publicClient:', publicClient)

      if (!marketIds || !Array.isArray(marketIds) || marketIds.length === 0 || !publicClient) {
        console.log('TransferMarkets - Early return:', {
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
            console.log(`TransferMarkets - Fetching market ${marketId}`)
            const marketData = await publicClient.readContract({
              address: process.env.NEXT_PUBLIC_MARKET_CONTRACT as `0x${string}`,
              abi: PredictionMarketABI,
              functionName: 'markets',
              args: [marketId],
            }) as any

            console.log(`TransferMarkets - Market ${marketId} raw data:`, marketData)

            // Markets returns: [marketId, marketType, question, creator, createdAt, resolutionTime, status, winningOption, totalPool, optionPools[2], dataSourceId, threshold, thresholdToken]
            // Note: optionPools is a single array [YES, NO], not two separate values
            const [, marketType, question, creator, createdAt, resolutionTime, status, winningOption, totalPool, optionPools, dataSourceId, threshold, thresholdToken] = marketData

            console.log(`TransferMarkets - Market ${marketId} parsed:`, {
              marketType,
              status,
              question
            })

            // Only include TRANSFER markets (marketType === 1) that are ACTIVE or RESOLVED
            if (marketType === 1 && (status === 0 || status === 2)) {
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
              console.log(`TransferMarkets - Added TRANSFER market ${marketId}`)
            }
          } catch (err) {
            console.error(`Failed to fetch market ${marketId}:`, err)
          }
        }

        console.log('TransferMarkets - Total fetched markets:', fetchedMarkets.length)
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
        <h3 className="text-xl font-semibold mb-2">No Transfer Markets Yet</h3>
        <p className="text-gray-400 mb-6">
          Create a prediction market for token transfer amounts!
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