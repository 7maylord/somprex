'use client'

import { Coins } from 'lucide-react'
import { useAccount, useReadContract } from 'wagmi'
import { formatEther } from 'viem'
import { SomiTokenABI } from '@/abis'

export default function SomiBalance() {
  const { address, isConnected } = useAccount()

  // Read SOMI balance
  const { data: balance } = useReadContract({
    address: process.env.NEXT_PUBLIC_SOMI_TOKEN as `0x${string}`,
    abi: SomiTokenABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      refetchInterval: 10000, // Refetch every 10 seconds
    },
  })

  if (!isConnected) {
    return null
  }

  const balanceFormatted = balance ? parseFloat(formatEther(balance)).toFixed(2) : '0.00'

  return (
    <div className="flex items-center space-x-2 bg-primary-500/10 border border-primary-500/30 rounded-lg px-4 py-2">
      <Coins className="w-4 h-4 text-primary-500" />
      <span className="text-sm font-medium text-gray-300">
        {balanceFormatted} SOMI
      </span>
    </div>
  )
}
