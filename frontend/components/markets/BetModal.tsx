'use client'

import { useState } from 'react'
import { X, TrendingUp, AlertCircle } from 'lucide-react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther } from 'viem'
import { toast } from 'sonner'
import type { Market, Odds } from '@/lib/types'
import { formatOdds, formatTokenAmount, calculatePotentialWinnings } from '@/utils/format'
import { PredictionMarketABI } from '@/abis'

interface BetModalProps {
  market: Market
  odds: Odds
  onClose: () => void
}

export default function BetModal({ market, odds, onClose }: BetModalProps) {
  const { address, isConnected } = useAccount()
  const [selectedOption, setSelectedOption] = useState<0 | 1>(0)
  const [betAmount, setBetAmount] = useState('')

  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const handlePlaceBet = async () => {
    if (!isConnected) {
      toast.error('Please connect your wallet')
      return
    }

    if (!betAmount || parseFloat(betAmount) <= 0) {
      toast.error('Please enter a valid bet amount')
      return
    }

    try {
      const amountInWei = parseEther(betAmount)

      writeContract({
        address: (process.env.NEXT_PUBLIC_MARKET_CONTRACT) as `0x${string}`,
        abi: PredictionMarketABI,
        functionName: 'placeBet',
        args: [market.marketId, selectedOption],
        value: amountInWei,
      })

      toast.loading('Placing bet...', { id: 'bet-tx' })
    } catch (err: any) {
      console.error('Bet error:', err)
      toast.error(err.message || 'Failed to place bet')
    }
  }

  // Handle transaction confirmation
  if (isSuccess) {
    toast.success('Bet placed successfully! 🎉', { id: 'bet-tx' })
    setTimeout(() => onClose(), 2000)
  }

  if (error) {
    toast.error('Transaction failed', { id: 'bet-tx' })
  }

  const potentialWinnings = betAmount
    ? calculatePotentialWinnings(
        parseEther(betAmount),
        selectedOption === 0 ? odds.yes : odds.no
      )
    : BigInt(0)

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card max-w-md w-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Place Your Bet</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Market Question */}
        <div className="bg-gray-700/50 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-400 mb-2">Market Question:</p>
          <p className="font-semibold">{market.question}</p>
        </div>

        {/* Option Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-3">Select Outcome:</label>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setSelectedOption(0)}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedOption === 0
                  ? 'border-green-500 bg-green-500/20'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <div className="text-2xl mb-2">✅</div>
              <div className="font-bold mb-1">YES</div>
              <div className="text-2xl font-bold text-green-400">{formatOdds(odds.yes)}</div>
              <div className="text-xs text-gray-400 mt-1">{odds.yesProb.toFixed(1)}% chance</div>
            </button>
            <button
              onClick={() => setSelectedOption(1)}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedOption === 1
                  ? 'border-red-500 bg-red-500/20'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <div className="text-2xl mb-2">❌</div>
              <div className="font-bold mb-1">NO</div>
              <div className="text-2xl font-bold text-red-400">{formatOdds(odds.no)}</div>
              <div className="text-xs text-gray-400 mt-1">{odds.noProb.toFixed(1)}% chance</div>
            </button>
          </div>
        </div>

        {/* Bet Amount */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Bet Amount (SOMI):</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            max="100"
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            placeholder="0.00"
            className="input w-full text-lg"
          />
          <div className="flex justify-between mt-2 text-sm text-gray-400">
            <span>Min: 0.01 SOMI</span>
            <span>Max: 100 SOMI</span>
          </div>
        </div>

        {/* Potential Winnings */}
        {betAmount && parseFloat(betAmount) > 0 && (
          <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-primary-500" />
                <span className="text-sm text-gray-400">Potential Winnings:</span>
              </div>
              <div className="text-xl font-bold text-primary-400">
                {formatTokenAmount(potentialWinnings)} SOMI
              </div>
            </div>
          </div>
        )}

        {/* Warning */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-6 flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-300">
            Betting is final. Make sure you understand the market before placing your bet.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-4">
          <button
            onClick={onClose}
            className="btn-secondary flex-1"
            disabled={isPending || isConfirming}
          >
            Cancel
          </button>
          <button
            onClick={handlePlaceBet}
            className="btn-primary flex-1"
            disabled={
              isPending ||
              isConfirming ||
              !betAmount ||
              parseFloat(betAmount) <= 0
            }
          >
            {isPending || isConfirming ? 'Confirming...' : 'Place Bet'}
          </button>
        </div>
      </div>
    </div>
  )
}