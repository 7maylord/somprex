'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi'
import { ArrowLeft, Sword, Heart, Clock, Trophy, Zap } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { parseEther, decodeEventLog } from 'viem'
import { BossBattleGameABI } from '@/abis'

export default function GamePage() {
  const { isConnected, address } = useAccount()
  const publicClient = usePublicClient()
  const [gameState, setGameState] = useState<'idle' | 'starting' | 'playing' | 'victory' | 'defeat'>('idle')
  const [bossHp, setBossHp] = useState(1000)
  const [playerHp, setPlayerHp] = useState(100)
  const [timeLeft, setTimeLeft] = useState(120)
  const [damage, setDamage] = useState(0)
  const [sessionId, setSessionId] = useState<`0x${string}` | null>(null)
  const [startTime, setStartTime] = useState<number>(0)

  const { writeContract, data: hash, reset: resetWrite } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  // Handle startGame transaction success
  useEffect(() => {
    if (isSuccess && gameState === 'starting' && hash) {
      // Extract sessionId from transaction receipt
      const extractSessionId = async () => {
        try {
          const receipt = await publicClient?.getTransactionReceipt({ hash })

          if (!receipt || !receipt.logs) {
            toast.error('Failed to get session ID')
            setGameState('idle')
            return
          }

          // Find GameStarted event
          for (const log of receipt.logs) {
            try {
              const decoded = decodeEventLog({
                abi: BossBattleGameABI,
                data: log.data,
                topics: log.topics,
              })

              if (decoded.eventName === 'GameStarted') {
                const extractedSessionId = decoded.args.sessionId as `0x${string}`
                console.log('✅ Game started with sessionId:', extractedSessionId)

                setSessionId(extractedSessionId)
                setGameState('playing')
                setStartTime(Date.now())
                setBossHp(1000)
                setPlayerHp(100)
                setTimeLeft(120)
                setDamage(0)
                toast.success('Game started! Defeat the boss!')
                resetWrite()
                return
              }
            } catch (e) {
              // Not the event we're looking for, continue
              continue
            }
          }

          toast.error('Failed to extract session ID from transaction')
          setGameState('idle')
        } catch (error) {
          console.error('Error extracting sessionId:', error)
          toast.error('Failed to start game')
          setGameState('idle')
        }
      }

      extractSessionId()
    }
  }, [isSuccess, gameState, hash, publicClient, resetWrite])

  // Timer countdown
  useEffect(() => {
    if (gameState === 'playing' && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setGameState('defeat')
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [gameState, timeLeft])

  // Check victory
  useEffect(() => {
    if (bossHp <= 0 && gameState === 'playing') {
      setGameState('victory')
      toast.success('🎉 Boss Defeated!')
    }
  }, [bossHp, gameState])

  const startGame = async () => {
    if (!isConnected) {
      toast.error('Please connect your wallet')
      return
    }

    try {
      toast.loading('Starting game...', { id: 'start-game' })
      setGameState('starting')

      writeContract({
        address: (process.env.NEXT_PUBLIC_GAME_CONTRACT) as `0x${string}`,
        abi: BossBattleGameABI,
        functionName: 'startGame',
        args: [1], // boss level
        gas: BigInt(500000), // 500k gas
      })

      toast.dismiss('start-game')
    } catch (error) {
      console.error(error)
      toast.error('Failed to start game')
      setGameState('idle')
    }
  }

  const attack = async () => {
    if (gameState !== 'playing') return
    if (!sessionId) {
      toast.error('No active game session')
      return
    }

    const attackDamage = Math.floor(Math.random() * 100) + 50 // 50-150 damage
    const bossDamage = Math.floor(Math.random() * 20) + 10 // 10-30 damage

    // Update UI optimistically
    const newBossHp = Math.max(0, bossHp - attackDamage)
    const newPlayerHp = Math.max(0, playerHp - bossDamage)

    setBossHp(newBossHp)
    setPlayerHp(newPlayerHp)
    setDamage(prev => prev + attackDamage)

    // Check player defeat
    if (newPlayerHp <= 0) {
      setGameState('defeat')
      toast.error('You were defeated!')
      return
    }

    // Call contract
    try {
      writeContract({
        address: (process.env.NEXT_PUBLIC_GAME_CONTRACT) as `0x${string}`,
        abi: BossBattleGameABI,
        functionName: 'dealDamage',
        args: [sessionId, BigInt(attackDamage)],
        gas: BigInt(300000), // 300k gas
      })

      // Check boss defeat (contract will automatically emit BossDefeated event)
      if (newBossHp <= 0) {
        console.log('🎉 Boss defeated! BossDefeated event will be emitted by contract')
      }
    } catch (error) {
      console.error('Attack failed:', error)
      // Revert UI changes on error
      setBossHp(bossHp)
      setPlayerHp(playerHp)
      setDamage(prev => prev - attackDamage)
      toast.error('Attack failed')
    }
  }

  const resetGame = () => {
    setGameState('idle')
    setBossHp(1000)
    setPlayerHp(100)
    setTimeLeft(120)
    setDamage(0)
    setSessionId(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-800/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Link href="/">
                <button className="btn-secondary flex items-center space-x-2">
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Markets</span>
                </button>
              </Link>
              <h1 className="text-2xl font-bold">Boss Battle</h1>
            </div>
            <appkit-button />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Game Info */}
        <div className="card mb-8 bg-gradient-to-r from-blue-900/30 to-cyan-900/30 border-blue-500/30">
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-2">⚔️ Epic Boss Battle</h2>
            <p className="text-gray-400">
              Defeat the boss and create on-chain events for prediction markets!
            </p>
          </div>
        </div>

        {(gameState === 'idle' || gameState === 'starting') && (
          <div className="card text-center">
            <div className="mb-8">
              <div className="text-8xl mb-4">🐉</div>
              <h3 className="text-2xl font-bold mb-2">Ready to Battle?</h3>
              <p className="text-gray-400 mb-6">
                You have 2 minutes to defeat the boss with 1000 HP
              </p>
            </div>
            <button
              onClick={startGame}
              className="btn-primary text-lg px-8 py-3"
              disabled={gameState === 'starting' || isConfirming}
            >
              <Sword className="w-5 h-5 inline mr-2" />
              {gameState === 'starting' || isConfirming ? 'Starting Game...' : 'Start Battle'}
            </button>
          </div>
        )}

        {gameState === 'playing' && (
          <div className="space-y-6">
            {/* Timer */}
            <div className="card bg-gradient-to-r from-yellow-900/20 to-orange-900/20 border-yellow-500/30">
              <div className="flex items-center justify-center space-x-2 text-2xl font-bold">
                <Clock className="w-6 h-6 text-yellow-500" />
                <span>{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
              </div>
            </div>

            {/* Boss */}
            <div className="card">
              <div className="text-center mb-4">
                <div className="text-6xl mb-4">🐉</div>
                <h3 className="text-xl font-bold mb-2">Shadow Dragon</h3>
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <Heart className="w-5 h-5 text-red-500" />
                  <span className="font-bold">{bossHp} / 1000 HP</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-4">
                  <div
                    className="bg-gradient-to-r from-red-600 to-red-500 h-4 rounded-full transition-all duration-300"
                    style={{ width: `${(bossHp / 1000) * 100}%` }}
                  />
                </div>
              </div>

              <button
                onClick={attack}
                className="btn-danger w-full text-lg py-3 flex items-center justify-center space-x-2"
              >
                <Sword className="w-5 h-5" />
                <span>Attack</span>
              </button>
            </div>

            {/* Player */}
            <div className="card">
              <div className="text-center">
                <div className="text-4xl mb-2">🛡️</div>
                <h3 className="font-bold mb-2">Your HP</h3>
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <Heart className="w-5 h-5 text-green-500" />
                  <span className="font-bold">{playerHp} / 100 HP</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-4">
                  <div
                    className="bg-gradient-to-r from-green-600 to-green-500 h-4 rounded-full transition-all duration-300"
                    style={{ width: `${playerHp}%` }}
                  />
                </div>
                <div className="mt-4 flex items-center justify-center space-x-2 text-sm text-gray-400">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  <span>Total Damage: {damage}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {gameState === 'victory' && (
          <div className="card text-center bg-gradient-to-r from-green-900/30 to-emerald-900/30 border-green-500/30">
            <div className="mb-8">
              <Trophy className="w-24 h-24 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-3xl font-bold mb-2 text-green-400">Victory! 🎉</h3>
              <p className="text-gray-300 mb-4">
                You defeated the boss in {120 - timeLeft} seconds!
              </p>
              <div className="text-lg mb-6">
                <p>Total Damage: <span className="font-bold text-primary-400">{damage}</span></p>
                <p>Time Taken: <span className="font-bold text-primary-400">{120 - timeLeft}s</span></p>
              </div>
              <p className="text-sm text-gray-400 mb-6">
                Your victory has been recorded on-chain and can be used by prediction markets!
              </p>
            </div>
            <div className="flex space-x-4 justify-center">
              <Link href="/">
                <button className="btn-primary">
                  View Markets
                </button>
              </Link>
              <button onClick={resetGame} className="btn-secondary">
                Play Again
              </button>
            </div>
          </div>
        )}

        {gameState === 'defeat' && (
          <div className="card text-center bg-gradient-to-r from-red-900/30 to-orange-900/30 border-red-500/30">
            <div className="mb-8">
              <div className="text-6xl mb-4">💀</div>
              <h3 className="text-3xl font-bold mb-2 text-red-400">Defeated!</h3>
              <p className="text-gray-300 mb-4">
                {playerHp <= 0 ? 'The boss was too strong...' : 'Time ran out!'}
              </p>
              <div className="text-lg mb-6">
                <p>Damage Dealt: <span className="font-bold text-primary-400">{damage}</span></p>
                <p>Boss HP Left: <span className="font-bold text-primary-400">{bossHp}</span></p>
              </div>
            </div>
            <button onClick={resetGame} className="btn-primary">
              Try Again
            </button>
          </div>
        )}

        {/* How to Play */}
        <div className="card mt-8">
          <h3 className="font-bold mb-4">How to Play</h3>
          <ul className="space-y-2 text-gray-400">
            <li className="flex items-start space-x-2">
              <span className="text-primary-500">1.</span>
              <span>Click "Attack" to deal damage to the boss</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-primary-500">2.</span>
              <span>Defeat the boss before time runs out (2 minutes)</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-primary-500">3.</span>
              <span>Boss deals damage back - don't let your HP reach 0!</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-primary-500">4.</span>
              <span>Victory creates on-chain events for prediction markets</span>
            </li>
          </ul>
        </div>
      </main>
    </div>
  )
}