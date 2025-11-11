import { createPublicClient, createWalletClient, http, parseAbiItem } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { defineChain } from 'viem'
import PredictionMarketABI from '../abis/PredictionMarket.json'
import dotenv from 'dotenv'

dotenv.config()

// Define Somnia Testnet chain
const somniaTestnet = defineChain({
  id: 50312,
  name: 'Somnia Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'SOMI',
    symbol: 'SOMI',
  },
  rpcUrls: {
    default: {
      http: ['https://dream-rpc.somnia.network'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Somnia Explorer',
      url: 'https://shannon-explorer.somnia.network',
    },
  },
})

// Configuration
const MARKET_CONTRACT = process.env.MARKET_CONTRACT as `0x${string}`
const SOMI_TOKEN = process.env.SOMI_TOKEN as `0x${string}`
const GAME_CONTRACT = process.env.GAME_CONTRACT as `0x${string}`
const RPC_URL = process.env.SOMNIA_RPC_URL!
const PRIVATE_KEY = process.env.RESOLVER_PRIVATE_KEY as `0x${string}`

if (!MARKET_CONTRACT || !SOMI_TOKEN || !RPC_URL || !PRIVATE_KEY) {
  console.error('❌ Missing required environment variables!')
  console.error('Required: MARKET_CONTRACT, SOMI_TOKEN, SOMNIA_RPC_URL, RESOLVER_PRIVATE_KEY')
  process.exit(1)
}

// Initialize Viem clients
const account = privateKeyToAccount(PRIVATE_KEY)

const publicClient = createPublicClient({
  chain: somniaTestnet,
  transport: http(RPC_URL),
  pollingInterval: 1000 // Poll every 1 second for new events
})

const walletClient = createWalletClient({
  chain: somniaTestnet,
  transport: http(RPC_URL),
  account
})

// Track active markets
interface TrackedMarket {
  marketId: `0x${string}`
  marketType: number // 0=BLOCK, 1=TRANSFER, 2=GAME
  question: string
  threshold: bigint
  thresholdToken: `0x${string}`
  resolutionTime: bigint
  creator: `0x${string}`
}

const activeMarkets = new Map<string, TrackedMarket>()

// ===== HELPER FUNCTIONS =====

function isReadyForResolution(market: TrackedMarket): boolean {
  const now = BigInt(Math.floor(Date.now() / 1000))
  return now >= market.resolutionTime
}

async function callResolveMarket(marketId: `0x${string}`, winningOption: number) {
  try {
    console.log(`\n✅ Resolving market ${marketId} with option ${winningOption}`)

    const { request } = await publicClient.simulateContract({
      address: MARKET_CONTRACT,
      abi: PredictionMarketABI.abi,
      functionName: 'resolveMarket',
      args: [marketId, winningOption],
      account
    })

    const hash = await walletClient.writeContract(request)
    console.log(`📝 Resolution tx: ${hash}`)

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    console.log(`✅ Market resolved! Block: ${receipt.blockNumber}`)

    // Remove from active markets
    activeMarkets.delete(marketId)

  } catch (error: any) {
    console.error(`❌ Failed to resolve market ${marketId}:`, error.message || error)
  }
}

// ===== MARKET TRACKING =====

async function loadActiveMarketsFromContract() {
  console.log('📊 Loading active markets from contract...')

  try {
    // Get all market IDs
    const marketIds = await publicClient.readContract({
      address: MARKET_CONTRACT,
      abi: PredictionMarketABI.abi,
      functionName: 'getActiveMarkets',
    }) as `0x${string}`[]

    console.log(`   Found ${marketIds.length} markets on contract`)

    // Load each market's details
    for (const marketId of marketIds) {
      try {
        const market = await publicClient.readContract({
          address: MARKET_CONTRACT,
          abi: PredictionMarketABI.abi,
          functionName: 'markets',
          args: [marketId],
        }) as any

        // Only track ACTIVE markets (status = 0)
        if (market.status === 0) {
          activeMarkets.set(marketId, {
            marketId,
            marketType: market.marketType,
            question: market.question,
            threshold: market.threshold,
            thresholdToken: market.thresholdToken,
            resolutionTime: market.resolutionTime,
            creator: market.creator,
          })

          console.log(`   ✓ Tracking market: ${market.question}`)
          console.log(`     Type: ${market.marketType} | Threshold: ${market.threshold.toString()}`)
        }
      } catch (error) {
        console.error(`   ✗ Failed to load market ${marketId}`)
      }
    }

    console.log(`\n✅ Loaded ${activeMarkets.size} active markets\n`)
  } catch (error) {
    console.error('❌ Failed to load markets from contract:', error)
  }
}

// ===== EVENT SUBSCRIPTIONS =====

async function subscribeToMarketCreation() {
  console.log('📡 Setting up MarketCreated event listener...')

  const marketCreatedEvent = parseAbiItem(
    'event MarketCreated(bytes32 indexed marketId, uint8 marketType, string question, address indexed creator, bytes32 dataSourceId, uint256 threshold, address thresholdToken)'
  )

  const unwatch = publicClient.watchContractEvent({
    address: MARKET_CONTRACT as `0x${string}`,
    abi: [marketCreatedEvent],
    eventName: 'MarketCreated',
    onLogs: async (logs) => {
      for (const log of logs) {
        const args = (log as any).args as any

        console.log(`\n📝 New market created!`)
        console.log(`   Market ID: ${args.marketId}`)
        console.log(`   Type: ${args.marketType}`)
        console.log(`   Question: ${args.question}`)
        console.log(`   Threshold: ${args.threshold?.toString()}`)
        console.log(`   Creator: ${args.creator}`)

        // Get full market details from contract
        try {
          const market = await publicClient.readContract({
            address: MARKET_CONTRACT,
            abi: PredictionMarketABI.abi,
            functionName: 'markets',
            args: [args.marketId],
          }) as any

          activeMarkets.set(args.marketId, {
            marketId: args.marketId,
            marketType: market.marketType,
            question: market.question,
            threshold: market.threshold,
            thresholdToken: market.thresholdToken,
            resolutionTime: market.resolutionTime,
            creator: market.creator,
          })

          console.log(`   ✅ Now tracking this market`)
        } catch (error) {
          console.error(`   ❌ Failed to fetch market details`)
        }
      }
    }
  })

  console.log('✅ MarketCreated event listener active\n')
}

async function subscribeToTransfers() {
  console.log('💰 Setting up SOMI transfer event listener...')

  const transferEvent = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')

  const unwatch = publicClient.watchContractEvent({
    address: SOMI_TOKEN as `0x${string}`,
    abi: [transferEvent],
    eventName: 'Transfer',
    onLogs: async (logs) => {
      for (const log of logs) {
        const { from, to, value } = (log as any).args as { from: string; to: string; value: bigint }

        console.log(`\n💸 Transfer detected: ${value.toString()} SOMI from ${from} to ${to}`)

        // Check all TRANSFER markets
        for (const [marketId, market] of activeMarkets.entries()) {
          if (market.marketType !== 1 || !isReadyForResolution(market)) continue

          console.log(`\n🔍 Checking TRANSFER market: ${market.question}`)
          console.log(`   Transfer amount: ${value.toString()}`)
          console.log(`   Threshold: ${market.threshold.toString()}`)

          const question = market.question.toLowerCase()
          let winningOption: number

          if (question.includes('more than') || question.includes('over') || question.includes('>')) {
            winningOption = value > market.threshold ? 0 : 1
          } else if (question.includes('less than') || question.includes('under') || question.includes('<')) {
            winningOption = value < market.threshold ? 0 : 1
          } else {
            winningOption = value > market.threshold ? 0 : 1
          }

          console.log(`   → Result: ${winningOption === 0 ? 'YES' : 'NO'} wins`)

          await callResolveMarket(marketId as `0x${string}`, winningOption)
        }
      }
    }
  })

  console.log('✅ Transfer event listener active\n')
}

async function subscribeToGameEvents() {
  console.log('🎮 Setting up BossDefeated event listener...')

  const bossDefeatedEvent = parseAbiItem('event BossDefeated(bytes32 indexed sessionId, address indexed player, uint256 timeTaken, uint256 totalDamage)')

  const unwatch = publicClient.watchContractEvent({
    address: GAME_CONTRACT as `0x${string}`,
    abi: [bossDefeatedEvent],
    eventName: 'BossDefeated',
    onLogs: async (logs) => {
      for (const log of logs) {
        const { sessionId, player, timeTaken, totalDamage } = (log as any).args as {
          sessionId: string
          player: string
          timeTaken: bigint
          totalDamage: bigint
        }

        console.log(`\n🎉 Boss defeated!`)
        console.log(`   Session: ${sessionId}`)
        console.log(`   Player: ${player}`)
        console.log(`   Time: ${timeTaken.toString()} seconds`)
        console.log(`   Damage: ${totalDamage.toString()}`)

        // Check all GAME markets
        for (const [marketId, market] of activeMarkets.entries()) {
          if (market.marketType !== 2 || !isReadyForResolution(market)) continue

          console.log(`\n🔍 Checking GAME market: ${market.question}`)
          console.log(`   Time taken: ${timeTaken.toString()}`)
          console.log(`   Threshold: ${market.threshold.toString()}`)

          const question = market.question.toLowerCase()
          let winningOption: number

          if (question.includes('less than') || question.includes('under') || question.includes('<')) {
            winningOption = timeTaken < market.threshold ? 0 : 1
          } else if (question.includes('more than') || question.includes('over') || question.includes('>')) {
            winningOption = timeTaken > market.threshold ? 0 : 1
          } else {
            // Default: assume "less than" for time-based questions
            winningOption = timeTaken < market.threshold ? 0 : 1
          }

          console.log(`   → Result: ${winningOption === 0 ? 'YES' : 'NO'} wins`)

          await callResolveMarket(marketId as `0x${string}`, winningOption)
        }
      }
    }
  })

  console.log('✅ Game event listener active\n')
}

// ===== BLOCK-BASED RESOLUTION (Simple Polling) =====

async function checkBlockMarkets() {
  try {
    const latestBlock = await publicClient.getBlock()
    const blockNumber = latestBlock.number
    const txCount = latestBlock.transactions.length

    for (const [marketId, market] of activeMarkets.entries()) {
      if (market.marketType !== 0 || !isReadyForResolution(market)) continue

      console.log(`\n🔍 Checking BLOCK market: ${market.question}`)
      console.log(`   Block ${blockNumber} has ${txCount} transactions`)
      console.log(`   Threshold: ${market.threshold.toString()} transactions`)

      // Parse question to determine if it's "more than" or "less than"
      const question = market.question.toLowerCase()
      let winningOption: number

      if (question.includes('more than') || question.includes('over') || question.includes('>')) {
        // YES if txCount > threshold
        winningOption = BigInt(txCount) > market.threshold ? 0 : 1
      } else if (question.includes('less than') || question.includes('under') || question.includes('<')) {
        // YES if txCount < threshold
        winningOption = BigInt(txCount) < market.threshold ? 0 : 1
      } else {
        // Default: assume "more than"
        winningOption = BigInt(txCount) > market.threshold ? 0 : 1
      }

      console.log(`   → Result: ${winningOption === 0 ? 'YES' : 'NO'} wins`)

      await callResolveMarket(marketId as `0x${string}`, winningOption)
    }
  } catch (error) {
    console.error('❌ Error checking block markets:', error)
  }
}

// ===== PERIODIC RESOLUTION CHECK =====

function startPeriodicCheck() {
  console.log('⏰ Starting periodic resolution check (every 5 seconds)...\n')

  setInterval(async () => {
    const now = Math.floor(Date.now() / 1000)
    console.log(`\n⏰ Periodic check at ${new Date().toISOString()}`)
    console.log(`   Active markets: ${activeMarkets.size}`)

    // Check for markets that need resolution
    for (const [marketId, market] of activeMarkets.entries()) {
      if (isReadyForResolution(market)) {
        console.log(`   🔔 Market ready for resolution: ${market.question}`)

        // For BLOCK markets, check immediately
        if (market.marketType === 0) {
          await checkBlockMarkets()
        }
      }
    }
  }, 5000) // Every 5 seconds
}

// ===== MAIN =====

async function main() {
  console.log('=' .repeat(60))
  console.log('🚀 PredEx Auto-Resolver Service')
  console.log('=' .repeat(60))
  console.log(`\n📍 Configuration:`)
  console.log(`   Network: Somnia Testnet (Chain ID: 50312)`)
  console.log(`   RPC: ${RPC_URL}`)
  console.log(`   Resolver Account: ${account.address}`)
  console.log(`   Market Contract: ${MARKET_CONTRACT}`)
  console.log(`   SOMI Token: ${SOMI_TOKEN}`)
  console.log(`   Game Contract: ${GAME_CONTRACT}`)
  console.log('\n' + '=' .repeat(60) + '\n')

  try {
    // 1. Load existing active markets
    await loadActiveMarketsFromContract()

    // 2. Subscribe to new market creation
    await subscribeToMarketCreation()

    // 3. Subscribe to transfer events (for TRANSFER markets)
    await subscribeToTransfers()

    // 4. Subscribe to game events (for GAME markets)
    await subscribeToGameEvents()

    // 5. Start periodic check for BLOCK markets
    startPeriodicCheck()

    console.log('✅ All systems active!')
    console.log('👀 Watching for markets to resolve...\n')
    console.log('Press Ctrl+C to stop\n')

  } catch (error) {
    console.error('❌ Resolver service failed:', error)
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down resolver service...')
  console.log(`   Tracked ${activeMarkets.size} markets at shutdown`)
  process.exit(0)
})

// Start the service
main().catch((error) => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})
