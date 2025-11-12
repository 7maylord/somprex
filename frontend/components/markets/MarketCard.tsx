'use client'

import { useState, useMemo } from 'react'
import { Clock, TrendingUp, Trophy } from 'lucide-react'
import { formatTimeRemaining, formatTokenAmount, formatOdds, formatPercentage, getMarketTypeLabel } from '@/utils/format'
import type { Market } from '@/lib/types'
import BetModal from './BetModal'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { PredictionMarketABI } from '@/abis'
import { toast } from 'sonner'

interface MarketCardProps {
  market: Market
}

export default function MarketCard({ market }: MarketCardProps) {
  const [isBetModalOpen, setIsBetModalOpen] = useState(false)
  const [now] = useState(() => Date.now())
  const { address, isConnected } = useAccount()
  const { writeContract, data: claimHash, isPending: isClaimPending } = useWriteContract()
  const { isSuccess: isClaimSuccess } = useWaitForTransactionReceipt({ hash: claimHash })

  const handleClaim = async () => {
    console.log('🎯 handleClaim called')
    console.log('  isConnected:', isConnected)
    console.log('  address:', address)
    console.log('  market:', market)
    console.log('  marketId:', market.marketId)
    console.log('  market status:', market.status)
    console.log('  isResolved:', market.status === 2)

    if (!isConnected || !address) {
      console.log('❌ Not connected or no address')
      toast.error('Please connect your wallet')
      return
    }

    try {
      console.log('📝 Calling claimWinnings...')
      console.log('  Contract:', process.env.NEXT_PUBLIC_MARKET_CONTRACT)
      console.log('  Market ID:', market.marketId)
      console.log('  Gas:', BigInt(5000000))

      toast.loading('Claiming winnings...', { id: 'claim-tx' })

      writeContract({
        address: process.env.NEXT_PUBLIC_MARKET_CONTRACT as `0x${string}`,
        abi: PredictionMarketABI,
        functionName: 'claimWinnings',
        args: [market.marketId],
        gas: BigInt(5000000),
      })

      console.log('✅ writeContract called successfully')
    } catch (err: any) {
      console.error('❌ Claim error:', err)
      console.error('  Error type:', typeof err)
      console.error('  Error message:', err.message)
      console.error('  Error stack:', err.stack)
      const errorMessage = err instanceof Error ? err.message : 'Failed to claim winnings'
      toast.error(errorMessage, { id: 'claim-tx' })
    }
  }

  // Handle successful claim
  if (isClaimSuccess) {
    toast.success('Winnings claimed successfully! 🎉', { id: 'claim-tx' })
  }

  // Calculate odds locally instead of using SDS hook
  const odds = useMemo(() => {
    const yesPool = Number(market.optionPools[0])
    const noPool = Number(market.optionPools[1])
    const total = yesPool + noPool

    console.log('MarketCard odds calculation:', {
      marketId: market.marketId,
      yesPool,
      noPool,
      total,
      optionPools: market.optionPools
    })

    // No bets yet - show even odds
    if (total === 0) {
      return { yes: 2.0, no: 2.0, yesProb: 50, noProb: 50 }
    }

    // Only one side has bets - show implied odds
    // If only YES has bets, YES bettors break even (1x), NO would win entire pool
    // If only NO has bets, NO bettors break even (1x), YES would win entire pool
    if (yesPool === 0) {
      return {
        yes: 2.0, // Small implied odds when no one has bet
        no: 1.0, // Break even
        yesProb: 0,
        noProb: 100
      }
    }

    if (noPool === 0) {
      return {
        yes: 1.0, // Break even
        no: 2.0, // Small implied odds when no one has bet
        yesProb: 100,
        noProb: 0
      }
    }

    // Both sides have bets - calculate parimutuel odds
    const yesProb = (yesPool / total) * 100
    const noProb = (noPool / total) * 100

    const calculatedOdds = {
      yes: total / yesPool,
      no: total / noPool,
      yesProb,
      noProb
    }

    console.log('MarketCard calculated odds:', calculatedOdds)

    return calculatedOdds
  }, [market.optionPools, market.marketId])

  const isActive = market.status === 0 && now < Number(market.resolutionTime) * 1000
  const isResolved = market.status === 2
  const isExpired = now >= Number(market.resolutionTime) * 1000

  console.log('MarketCard status check:', {
    marketId: market.marketId,
    status: market.status,
    isActive,
    isResolved,
    isExpired,
    resolutionTime: market.resolutionTime,
    now,
    timeUntilResolution: Number(market.resolutionTime) * 1000 - now
  })

  return (
    <>
      <div className="card hover:border-primary-500/50 transition-all cursor-pointer group">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <span className="badge badge-primary">{getMarketTypeLabel(market.marketType)}</span>
              {isActive && <span className="badge badge-success">Active</span>}
              {isResolved && <span className="badge badge-warning">Resolved</span>}
            </div>
            <h3 className="text-lg font-semibold mb-2 group-hover:text-primary-400 transition-colors">
              {market.question}
            </h3>
          </div>
        </div>

        {/* Odds Display */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">YES</div>
            <div className="text-2xl font-bold text-green-400">{formatOdds(odds.yes)}</div>
            <div className="text-xs text-gray-500">{formatPercentage(odds.yesProb)}</div>
          </div>
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">NO</div>
            <div className="text-2xl font-bold text-red-400">{formatOdds(odds.no)}</div>
            <div className="text-xs text-gray-500">{formatPercentage(odds.noProb)}</div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-primary-500" />
            <div>
              <div className="text-gray-400 text-xs">Pool</div>
              <div className="font-semibold">{formatTokenAmount(market.totalPool)} SOMI</div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-yellow-500" />
            <div>
              <div className="text-gray-400 text-xs">Ends</div>
              <div className="font-semibold">{formatTimeRemaining(market.resolutionTime)}</div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        {isActive && (
          <button
            onClick={() => setIsBetModalOpen(true)}
            className="btn-primary w-full"
          >
            Place Bet
          </button>
        )}

        {isResolved && (
          <div className="space-y-3">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-center">
              <div className="text-sm font-semibold">
                Winner: {market.winningOption === 0 ? '✅ YES' : '❌ NO'}
              </div>
            </div>
            <button
              onClick={handleClaim}
              disabled={isClaimPending || !isConnected}
              className="btn-primary w-full flex items-center justify-center space-x-2"
            >
              <Trophy className="w-4 h-4" />
              <span>{isClaimPending ? 'Claiming...' : 'Claim Winnings'}</span>
            </button>
          </div>
        )}
      </div>

      {isBetModalOpen && (
        <BetModal
          market={market}
          odds={odds}
          onClose={() => setIsBetModalOpen(false)}
        />
      )}
    </>
  )
}