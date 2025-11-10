'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { useAccount, useWriteContract } from 'wagmi'
import { toast } from 'sonner'
import { MarketType } from '@/lib/types'
import { PredictionMarketABI } from '@/abis'
import { generateMarketId } from '@/utils/format'

interface CreateMarketModalProps {
  onClose: () => void
}

export default function CreateMarketModal({ onClose }: CreateMarketModalProps) {
  const { address } = useAccount()
  const [marketType, setMarketType] = useState<MarketType>(MarketType.BLOCK)
  const [question, setQuestion] = useState('')
  const [duration, setDuration] = useState(24) // hours
  const [threshold, setThreshold] = useState('')

  const { writeContract, isPending } = useWriteContract()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!question.trim()) {
      toast.error('Please enter a question')
      return
    }

    try {
      if (!address) {
        toast.error('Please connect your wallet')
        return
      }

      const marketId = generateMarketId(address, Date.now(), question)
      const resolutionTime = BigInt(Date.now() + duration * 3600 * 1000)
      const dataSourceId = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`
      
      writeContract({
        address: (process.env.NEXT_PUBLIC_MARKET_CONTRACT) as `0x${string}`,
        abi: PredictionMarketABI,
        functionName: 'createMarket',
        args: [marketId, marketType, question, resolutionTime, dataSourceId],
      })

      toast.success('Market created successfully!')
      onClose()
    } catch (error) {
      console.error(error)
      toast.error('Failed to create market')
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
            <label className="block text-sm font-medium mb-2">Duration (hours)</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              min="1"
              max="168"
              className="input w-full"
              required
            />
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
              {marketType === MarketType.BLOCK && '🔷 This market resolves based on blockchain metrics'}
              {marketType === MarketType.TRANSFER && '🔷 This market resolves based on token transfers'}
              {marketType === MarketType.GAME && '🔷 This market resolves based on game events'}
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