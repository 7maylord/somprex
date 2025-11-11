'use client'

import { useState, useMemo } from 'react'
import { Clock, TrendingUp, Users } from 'lucide-react'
import { formatTimeRemaining, formatTokenAmount, formatOdds, formatPercentage, getMarketTypeLabel } from '@/utils/format'
import type { Market } from '@/lib/types'
import BetModal from './BetModal'

interface MarketCardProps {
  market: Market
}

export default function MarketCard({ market }: MarketCardProps) {
  const [isBetModalOpen, setIsBetModalOpen] = useState(false)

  // Calculate odds locally instead of using SDS hook
  const odds = useMemo(() => {
    const yesPool = Number(market.optionPools[0])
    const noPool = Number(market.optionPools[1])
    const total = yesPool + noPool

    if (total === 0) {
      return { yes: 2.0, no: 2.0, yesProb: 0.5, noProb: 0.5 }
    }

    const yesProb = yesPool / total
    const noProb = noPool / total

    return {
      yes: yesProb > 0 ? 1 / yesProb : 999,
      no: noProb > 0 ? 1 / noProb : 999,
      yesProb,
      noProb
    }
  }, [market.optionPools])

  const isActive = market.status === 0 && Date.now() < Number(market.resolutionTime)
  const isResolved = market.status === 2

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
        <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
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
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-blue-500" />
            <div>
              <div className="text-gray-400 text-xs">Bets</div>
              <div className="font-semibold">--</div>
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
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-center">
            <div className="text-sm font-semibold">
              Winner: {market.winningOption === 0 ? '✅ YES' : '❌ NO'}
            </div>
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