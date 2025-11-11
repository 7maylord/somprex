'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi'
import { toast } from 'sonner'
import { keccak256, encodePacked } from 'viem'
import { MarketType } from '@/lib/types'
import { PredictionMarketABI } from '@/abis'

interface CreateMarketModalProps {
  onClose: () => void
}

export default function CreateMarketModal({ onClose }: CreateMarketModalProps) {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const [marketType, setMarketType] = useState<MarketType>(MarketType.BLOCK)
  const [question, setQuestion] = useState('')
  const [duration, setDuration] = useState(2) // duration value
  const [timeUnit, setTimeUnit] = useState<'minutes' | 'hours'>('minutes') // time unit selector
  const [threshold, setThreshold] = useState('')

  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isSuccess } = useWaitForTransactionReceipt({ hash })

  // Handle successful transaction
  useEffect(() => {
    if (isSuccess) {
      toast.success('Market created successfully! 🎉', { id: 'create-market' })
      setTimeout(() => onClose(), 1500)
    }
  }, [isSuccess, onClose])

  // Handle transaction error
  useEffect(() => {
    if (error) {
      console.error('Transaction error details:', error)

      // Parse error message
      let errorMsg = 'Transaction failed'
      if (error.message) {
        if (error.message.includes('Market already exists')) {
          errorMsg = 'This market already exists. Try a different question.'
        } else if (error.message.includes('Invalid resolution time')) {
          errorMsg = 'Resolution time must be in the future'
        } else if (error.message.includes('rejected')) {
          errorMsg = 'Transaction rejected by user'
        } else if (error.message.includes('insufficient funds')) {
          errorMsg = 'Insufficient SOMI for gas fees'
        } else {
          errorMsg = error.message.slice(0, 100) // Truncate long messages
        }
      }

      toast.error(errorMsg, { id: 'create-market' })
    }
  }, [error])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isConnected) {
      toast.error('Please connect your wallet')
      return
    }

    if (!question.trim()) {
      toast.error('Please enter a question')
      return
    }

    if (!address) {
      toast.error('Wallet address not found')
      return
    }

    try {
      toast.loading('Preparing transaction...', { id: 'create-market' })

      // Get current block to use blockchain time instead of Date.now()
      // This is critical because Somnia's block.timestamp differs from real-world time
      const block = await publicClient?.getBlock()
      if (!block) {
        throw new Error('Failed to fetch current block')
      }

      const currentBlockTime = Number(block.timestamp)

      // Generate unique market ID using keccak256
      const timestamp = BigInt(currentBlockTime)
      const marketId = keccak256(
        encodePacked(
          ['address', 'uint256', 'string'],
          [address, timestamp, question]
        )
      )

      // Calculate resolution time based on BLOCKCHAIN time, not system time
      // Convert duration to seconds based on selected time unit
      const durationInSeconds = timeUnit === 'minutes' ? duration * 60 : duration * 3600
      const resolutionTimeSeconds = currentBlockTime + durationInSeconds
      const resolutionTime = BigInt(resolutionTimeSeconds)

      // Use zero address for dataSourceId (can be updated based on market type)
      const dataSourceId = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`

      // Threshold: optional, defaults to 0 for GAME markets
      const thresholdValue = threshold ? BigInt(threshold) : BigInt(0)

      // ThresholdToken: for TRANSFER markets, use SOMI token address, otherwise zero address
      const thresholdTokenAddress = marketType === MarketType.TRANSFER
        ? (process.env.NEXT_PUBLIC_SOMI_TOKEN as `0x${string}`)
        : '0x0000000000000000000000000000000000000000' as `0x${string}`

      console.log('Creating market with:', {
        marketId,
        marketType,
        question,
        currentBlockTime,
        resolutionTime: resolutionTimeSeconds,
        durationHours: duration,
        timeDifferenceSeconds: resolutionTimeSeconds - currentBlockTime,
        dataSourceId,
        threshold: thresholdValue.toString(),
        thresholdToken: thresholdTokenAddress,
        contractAddress: process.env.NEXT_PUBLIC_MARKET_CONTRACT
      })

      toast.loading('Creating market...', { id: 'create-market' })

      writeContract({
        address: process.env.NEXT_PUBLIC_MARKET_CONTRACT as `0x${string}`,
        abi: PredictionMarketABI,
        functionName: 'createMarket',
        args: [marketId, marketType, question, resolutionTime, dataSourceId, thresholdValue, thresholdTokenAddress],
        gas: BigInt(5000000), // 5M gas limit for Somnia testnet
      })

    } catch (err) {
      console.error('Create market error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to create market'
      toast.error(errorMessage, { id: 'create-market' })
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Create Prediction Market</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Market Type */}
          <div>
            <label className="block text-sm font-medium mb-2">Market Type</label>
            <div className="grid grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => setMarketType(MarketType.BLOCK)}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  marketType === MarketType.BLOCK
                    ? 'border-primary-500 bg-primary-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="text-2xl mb-2">⛓️</div>
                <div className="font-semibold">Block</div>
              </button>
              <button
                type="button"
                onClick={() => setMarketType(MarketType.TRANSFER)}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  marketType === MarketType.TRANSFER
                    ? 'border-primary-500 bg-primary-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="text-2xl mb-2">💰</div>
                <div className="font-semibold">Transfer</div>
              </button>
              <button
                type="button"
                onClick={() => setMarketType(MarketType.GAME)}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  marketType === MarketType.GAME
                    ? 'border-primary-500 bg-primary-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="text-2xl mb-2">🎮</div>
                <div className="font-semibold">Game</div>
              </button>
            </div>
          </div>

          {/* Question */}
          <div>
            <label className="block text-sm font-medium mb-2">Market Question</label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g., Will the next block have more than 100 transactions?"
              className="input w-full"
              required
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Resolution Time (when market can be resolved)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                min="1"
                max={timeUnit === 'minutes' ? 1440 : 168}
                className="input flex-1"
                placeholder={timeUnit === 'minutes' ? 'e.g., 2' : 'e.g., 24'}
                required
              />
              <select
                value={timeUnit}
                onChange={(e) => setTimeUnit(e.target.value as 'minutes' | 'hours')}
                className="input w-32"
              >
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
              </select>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Market will resolve {duration} {timeUnit} from now
            </p>
          </div>

          {/* Threshold (for block/transfer markets) */}
          {(marketType === MarketType.BLOCK || marketType === MarketType.TRANSFER) && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Threshold {marketType === MarketType.BLOCK ? '(transactions)' : '(SOMI)'}
              </label>
              <input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="e.g., 100"
                className="input w-full"
                required
              />
            </div>
          )}

          {/* Info */}
          <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-4">
            <p className="text-sm text-gray-300">
              {marketType === MarketType.BLOCK && '🔷 Resolution: Checks latest block transaction count after resolution time'}
              {marketType === MarketType.TRANSFER && '🔷 Resolution: Triggers on first SOMI transfer AFTER resolution time'}
              {marketType === MarketType.GAME && '🔷 Resolution: Triggers on first boss defeat AFTER resolution time'}
            </p>
          </div>

          {/* Buttons */}
          <div className="flex space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={isPending}
            >
              {isPending ? 'Creating...' : 'Create Market'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}