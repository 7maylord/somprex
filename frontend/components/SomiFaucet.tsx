'use client'

import { useEffect } from 'react'
import { Coins } from 'lucide-react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { formatEther } from 'viem'
import { toast } from 'sonner'
import { SomiTokenABI } from '@/abis'

export default function SomiFaucet() {
  const { address, isConnected } = useAccount()

  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isSuccess } = useWaitForTransactionReceipt({ hash })

  // Read SOMI balance
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: process.env.NEXT_PUBLIC_SOMI_TOKEN as `0x${string}`,
    abi: SomiTokenABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  })

  // Handle successful mint
  useEffect(() => {
    if (isSuccess) {
      toast.success('Successfully minted 1000 SOMI! 🎉', { id: 'mint-somi' })
      refetchBalance()
    }
  }, [isSuccess, refetchBalance])


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
