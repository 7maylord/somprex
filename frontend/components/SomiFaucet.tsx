'use client'

import { useState, useEffect } from 'react'
import { Coins, Clock, CheckCircle } from 'lucide-react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { formatEther } from 'viem'
import { toast } from 'sonner'
import { SomiTokenABI } from '@/abis'

export default function SomiFaucet() {
  const { address, isConnected } = useAccount()
  const [timeRemaining, setTimeRemaining] = useState<number>(0)

  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isSuccess } = useWaitForTransactionReceipt({ hash })

  // Read SOMI balance
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: process.env.NEXT_PUBLIC_SOMI_TOKEN as `0x${string}`,
    abi: SomiTokenABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  })

  // Check if can claim from faucet
  const { data: canClaim, refetch: refetchCanClaim } = useReadContract({
    address: process.env.NEXT_PUBLIC_SOMI_TOKEN as `0x${string}`,
    abi: SomiTokenABI,
    functionName: 'canClaimFromFaucet',
    args: address ? [address] : undefined,
  })

  // Get time until next claim
  const { data: timeUntilNext, refetch: refetchTime } = useReadContract({
    address: process.env.NEXT_PUBLIC_SOMI_TOKEN as `0x${string}`,
    abi: SomiTokenABI,
    functionName: 'timeUntilNextClaim',
    args: address ? [address] : undefined,
  })

  // Update countdown timer
  useEffect(() => {
    if (timeUntilNext !== undefined) {
      setTimeRemaining(Number(timeUntilNext))
    }
  }, [timeUntilNext])

  // Countdown effect
  useEffect(() => {
    if (timeRemaining > 0) {
      const timer = setTimeout(() => {
        setTimeRemaining(prev => Math.max(0, prev - 1))
      }, 1000)
      return () => clearTimeout(timer)
    } else {
      // Refetch when timer hits zero
      refetchCanClaim()
    }
  }, [timeRemaining, refetchCanClaim])

  // Handle successful claim
  useEffect(() => {
    if (isSuccess) {
      toast.success('Successfully claimed 100 SOMI! 🎉')
      refetchBalance()
      refetchCanClaim()
      refetchTime()
    }
  }, [isSuccess, refetchBalance, refetchCanClaim, refetchTime])

  const handleClaim = async () => {
    if (!isConnected) {
      toast.error('Please connect your wallet')
      return
    }

    try {
      toast.loading('Claiming SOMI tokens...', { id: 'faucet-claim' })

      writeContract({
        address: process.env.NEXT_PUBLIC_SOMI_TOKEN as `0x${string}`,
        abi: SomiTokenABI,
        functionName: 'claimFromFaucet',
        gas: BigInt(150000), // 150k gas for faucet claim
      })
    } catch (err: any) {
      console.error('Faucet claim error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to claim tokens'
      toast.error(errorMessage, { id: 'faucet-claim' })
    }
  }

  const handleMint = async () => {
    if (!isConnected || !address) {
      toast.error('Please connect your wallet')
      return
    }

    try {
      toast.loading('Minting SOMI tokens...', { id: 'mint-somi' })

      // Mint 1000 SOMI
      const amount = BigInt('1000000000000000000000') // 1000 * 10^18

      writeContract({
        address: process.env.NEXT_PUBLIC_SOMI_TOKEN as `0x${string}`,
        abi: SomiTokenABI,
        functionName: 'mint',
        args: [address, amount],
        gas: BigInt(100000),
      })
    } catch (err: any) {
      console.error('Mint error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to mint tokens'
      toast.error(errorMessage, { id: 'mint-somi' })
    }
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    } else {
      return `${secs}s`
    }
  }

  const balanceFormatted = balance ? formatEther(balance as bigint) : '0'

  return (
    <div className="card">
      <div className="flex items-center space-x-3 mb-4">
        <Coins className="w-6 h-6 text-primary-500" />
        <h3 className="text-xl font-bold">SOMI Faucet</h3>
      </div>

      <p className="text-gray-400 text-sm mb-6">
        Get free SOMI tokens to test the prediction market.
      </p>

      {/* Faucet Claim */}
      <div className="space-y-4">
        {/* Instant Mint (for testing) */}
        <button
          onClick={handleMint}
          disabled={isPending || !isConnected}
          className="btn-secondary w-full"
        >
          {isPending ? 'Minting...' : 'Mint SOMI'}
        </button>
      </div>

      {!isConnected && (
        <p className="text-yellow-500 text-sm mt-4 text-center">
          Connect your wallet to claim tokens
        </p>
      )}
    </div>
  )
}
