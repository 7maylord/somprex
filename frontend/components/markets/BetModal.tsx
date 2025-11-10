'use client'

import { useState, useEffect } from 'react'
import { X, TrendingUp, AlertCircle, Coins } from 'lucide-react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import { toast } from 'sonner'
import type { Market, Odds } from '@/lib/types'
import { formatOdds, formatTokenAmount, calculatePotentialWinnings } from '@/utils/format'
import { PredictionMarketABI, SomiTokenABI } from '@/abis'

interface BetModalProps {
  market: Market
  odds: Odds
  onClose: () => void
}

export default function BetModal({ market, odds, onClose }: BetModalProps) {
  const { address, isConnected } = useAccount()
  const [selectedOption, setSelectedOption] = useState<0 | 1>(0)
  const [betAmount, setBetAmount] = useState('')
  const [needsApproval, setNeedsApproval] = useState(true)

  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  // Read SOMI balance
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: process.env.NEXT_PUBLIC_SOMI_TOKEN as `0x${string}`,
    abi: SomiTokenABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  })

  // Read allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: process.env.NEXT_PUBLIC_SOMI_TOKEN as `0x${string}`,
    abi: SomiTokenABI,
    functionName: 'allowance',
    args: address ? [address, process.env.NEXT_PUBLIC_MARKET_CONTRACT as `0x${string}`] : undefined,
  })

  // Check if approval is needed when bet amount changes
  useEffect(() => {
    if (betAmount && allowance !== undefined) {
      const amountInWei = parseEther(betAmount)
      setNeedsApproval(allowance < amountInWei)
    }
  }, [betAmount, allowance])

  // Handle transaction success
  useEffect(() => {
    if (isSuccess) {
      if (needsApproval) {
        toast.success('Approval successful! Now place your bet.', { id: 'bet-tx' })
        // Refetch allowance after approval
        refetchAllowance()
        reset()
      } else {
        toast.success('Bet placed successfully! 🎉', { id: 'bet-tx' })
        setTimeout(() => onClose(), 2000)
      }
    }
  }, [isSuccess, needsApproval, onClose, refetchAllowance, reset])

  // Handle transaction error
  useEffect(() => {
    if (error) {
      console.error('Transaction error:', error)

      let errorMsg = 'Transaction failed'
      if (error.message) {
        if (error.message.includes('Market does not exist')) {
          errorMsg = 'Market not found'
        } else if (error.message.includes('Market not active')) {
          errorMsg = 'Market is no longer active'
        } else if (error.message.includes('Bet too small')) {
          errorMsg = 'Bet amount too small (min: 0.01 SOMI)'
        } else if (error.message.includes('Bet too large')) {
          errorMsg = 'Bet amount too large (max: 100 SOMI)'
        } else if (error.message.includes('rejected')) {
          errorMsg = 'Transaction rejected by user'
        } else if (error.message.includes('insufficient')) {
          errorMsg = 'Insufficient balance or allowance'
        } else {
          errorMsg = error.message.slice(0, 100)
        }
      }

      toast.error(errorMsg, { id: 'bet-tx' })
    }
  }, [error])

  const handleApprove = async () => {
    if (!isConnected || !address) {
      toast.error('Please connect your wallet')
      return
    }

    if (!betAmount || parseFloat(betAmount) <= 0) {
      toast.error('Please enter a valid bet amount')
      return
    }

    try {
      const amountInWei = parseEther(betAmount)

      console.log('Approving SOMI tokens:', {
        amount: betAmount,
        amountWei: amountInWei.toString(),
        spender: process.env.NEXT_PUBLIC_MARKET_CONTRACT
      })

      toast.loading('Approving tokens...', { id: 'bet-tx' })

      writeContract({
        address: process.env.NEXT_PUBLIC_SOMI_TOKEN as `0x${string}`,
        abi: SomiTokenABI,
        functionName: 'approve',
        args: [process.env.NEXT_PUBLIC_MARKET_CONTRACT as `0x${string}`, amountInWei],
        gas: BigInt(100000), // 100k gas for approval
      })
    } catch (err: any) {
      console.error('Approval error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to approve tokens'
      toast.error(errorMessage, { id: 'bet-tx' })
    }
  }

  const handlePlaceBet = async () => {
    if (!isConnected || !address) {
      toast.error('Please connect your wallet')
      return
    }

    if (!betAmount || parseFloat(betAmount) <= 0) {
      toast.error('Please enter a valid bet amount')
      return
    }

    const amount = parseFloat(betAmount)
    if (amount < 0.01) {
      toast.error('Minimum bet is 0.01 SOMI')
      return
    }

    if (amount > 100) {
      toast.error('Maximum bet is 100 SOMI')
      return
    }

    // Check balance
    if (balance !== undefined) {
      const amountInWei = parseEther(betAmount)
      if (balance < amountInWei) {
        toast.error('Insufficient SOMI balance')
        return
      }
    }

    try {
      const amountInWei = parseEther(betAmount)

      console.log('Placing bet:', {
        marketId: market.marketId,
        option: selectedOption === 0 ? 'YES' : 'NO',
        amount: betAmount,
        amountWei: amountInWei.toString(),
        contractAddress: process.env.NEXT_PUBLIC_MARKET_CONTRACT
      })

      toast.loading('Placing bet...', { id: 'bet-tx' })

      writeContract({
        address: process.env.NEXT_PUBLIC_MARKET_CONTRACT as `0x${string}`,
        abi: PredictionMarketABI,
        functionName: 'placeBet',
        args: [market.marketId, selectedOption, amountInWei],
        gas: BigInt(1000000), // 1M gas for placeBet
      })
    } catch (err: any) {
      console.error('Bet error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to place bet'
      toast.error(errorMessage, { id: 'bet-tx' })
    }
  }

  const potentialWinnings = betAmount
    ? calculatePotentialWinnings(
        parseEther(betAmount),
        selectedOption === 0 ? odds.yes : odds.no
      )
    : BigInt(0)

  const balanceFormatted = balance ? formatEther(balance) : '0'
  const hasInsufficientBalance = balance !== undefined && betAmount && parseEther(betAmount) > balance

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card max-w-md w-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Place Your Bet</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* SOMI Balance */}
        <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-3 mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Coins className="w-5 h-5 text-primary-500" />
            <span className="text-sm text-gray-400">Your SOMI Balance:</span>
          </div>
          <div className="text-lg font-bold text-primary-400">
            {parseFloat(balanceFormatted).toFixed(2)} SOMI
          </div>
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
            className={`input w-full text-lg ${hasInsufficientBalance ? 'border-red-500' : ''}`}
          />
          <div className="flex justify-between mt-2 text-sm text-gray-400">
            <span>Min: 0.01 SOMI</span>
            <span>Max: 100 SOMI</span>
          </div>
          {hasInsufficientBalance && (
            <p className="text-red-500 text-sm mt-2">Insufficient balance</p>
          )}
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
            {needsApproval
              ? 'You need to approve SOMI tokens before placing your bet. This is a two-step process.'
              : 'Betting is final. Make sure you understand the market before placing your bet.'}
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
          {needsApproval ? (
            <button
              onClick={handleApprove}
              className="btn-primary flex-1"
              disabled={
                isPending ||
                isConfirming ||
                !betAmount ||
                parseFloat(betAmount) <= 0 ||
                hasInsufficientBalance
              }
            >
              {isPending || isConfirming ? 'Approving...' : '1. Approve SOMI'}
            </button>
          ) : (
            <button
              onClick={handlePlaceBet}
              className="btn-primary flex-1"
              disabled={
                isPending ||
                isConfirming ||
                !betAmount ||
                parseFloat(betAmount) <= 0 ||
                hasInsufficientBalance
              }
            >
              {isPending || isConfirming ? 'Confirming...' : '2. Place Bet'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
