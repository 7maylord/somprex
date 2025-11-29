'use client'

import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { somniaTestnet } from '@/lib/chains'

const queryClient = new QueryClient()

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID'

const metadata = {
  name: 'SomPrex',
  description: 'Real-Time Oracle-Free Prediction Markets Powered by Somnia Data Streams',
  url: 'https://somprex.somnia.network',
  icons: ['https://avatars.githubusercontent.com/u/37784886']
}

const wagmiAdapter = new WagmiAdapter({
  networks: [somniaTestnet as any],
  projectId,
  ssr: true,
})

createAppKit({
  adapters: [wagmiAdapter],
  networks: [somniaTestnet as any],
  projectId,
  metadata,
  features: {
    analytics: true,
  },
})

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}