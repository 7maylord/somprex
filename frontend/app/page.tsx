'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { TrendingUp, Zap, Trophy, Plus } from 'lucide-react'
import Link from 'next/link'
import BlockMarkets from '@/components/markets/BlockMarkets'
import TransferMarkets from '@/components/markets/TransferMarkets'
import GameMarkets from '@/components/markets/GameMarkets'
import CreateMarketModal from '@/components/CreateMarketModal'
import SomiBalance from '@/components/SomiBalance'
import SomiFaucet from '@/components/SomiFaucet'

export default function Home() {
  const { isConnected } = useAccount()
  const [activeTab, setActiveTab] = useState<'block' | 'transfer' | 'game'>('block')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-800/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-8 h-8 text-primary-500" />
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
                  SomPrex
                </h1>
              </div>
              <span className="badge badge-primary">Powered by Somnia</span>
            </div>

            <div className="flex items-center space-x-4">
              <SomiBalance />
              <Link href="/game">
                <button className="btn-secondary flex items-center space-x-2">
                  <Trophy className="w-4 h-4" />
                  <span>Boss Battle</span>
                </button>
              </Link>
              <appkit-button />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="card mb-8 bg-gradient-to-r from-primary-900/20 to-blue-900/20 border-primary-500/30">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold mb-2">
                Prediction Markets Powered by Data Streams
              </h2>
              <p className="text-gray-400 text-lg">
                Bet on blockchain events with instant, oracle-free resolution
              </p>
              <div className="flex flex-wrap gap-4 mt-4">
                <div className="flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  <span className="text-sm">Sub-second resolution</span>
                </div>
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  <span className="text-sm">Real-time odds</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Trophy className="w-5 h-5 text-blue-500" />
                  <span className="text-sm">3 market types</span>
                </div>
              </div>
            </div>
            {isConnected && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="btn-primary flex items-center space-x-2 mt-4 md:mt-0"
              >
                <Plus className="w-5 h-5" />
                <span>Create Market</span>
              </button>
            )}
          </div>
        </div>

        {/* Stats and Faucet */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Markets</p>
                <p className="text-3xl font-bold mt-1">42</p>
              </div>
              <TrendingUp className="w-12 h-12 text-primary-500 opacity-20" />
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Volume</p>
                <p className="text-3xl font-bold mt-1">1,234 SOMI</p>
              </div>
              <Zap className="w-12 h-12 text-yellow-500 opacity-20" />
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Active Bettors</p>
                <p className="text-3xl font-bold mt-1">156</p>
              </div>
              <Trophy className="w-12 h-12 text-blue-500 opacity-20" />
            </div>
          </div>
          <div className="md:row-span-1">
            <SomiFaucet />
          </div>
        </div>

        {/* Market Tabs */}
        <div className="mb-6">
          <div className="flex space-x-4 border-b border-gray-700">
            <button
              onClick={() => setActiveTab('block')}
              className={`pb-4 px-4 font-semibold transition-colors ${
                activeTab === 'block'
                  ? 'border-b-2 border-primary-500 text-primary-500'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              ⛓️ Block Markets
            </button>
            <button
              onClick={() => setActiveTab('transfer')}
              className={`pb-4 px-4 font-semibold transition-colors ${
                activeTab === 'transfer'
                  ? 'border-b-2 border-primary-500 text-primary-500'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              💰 Transfer Markets
            </button>
            <button
              onClick={() => setActiveTab('game')}
              className={`pb-4 px-4 font-semibold transition-colors ${
                activeTab === 'game'
                  ? 'border-b-2 border-primary-500 text-primary-500'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              🎮 Game Markets
            </button>
          </div>
        </div>

        {/* Market Content */}
        <div className="min-h-[400px]">
          {activeTab === 'block' && <BlockMarkets />}
          {activeTab === 'transfer' && <TransferMarkets />}
          {activeTab === 'game' && <GameMarkets />}
        </div>
      </main>

      {/* Create Market Modal */}
      {isCreateModalOpen && (
        <CreateMarketModal onClose={() => setIsCreateModalOpen(false)} />
      )}

      {/* Footer */}
      <footer className="border-t border-gray-700 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-400">
            <p className="mb-2">
              Powered by{' '}
              <a
                href="https://somnia.network"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-500 hover:text-primary-400"
              >
                Somnia Data Streams
              </a>
            </p>
            <p className="text-sm">Oracle-free prediction markets with sub-second resolution</p>
          </div>
        </div>
      </footer>
    </div>
  )
}