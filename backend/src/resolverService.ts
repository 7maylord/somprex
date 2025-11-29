import { createPublicClient, createWalletClient, http, webSocket, parseAbiItem, keccak256 } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { defineChain } from 'viem'
import { SDK } from '@somnia-chain/streams'
import { SchemaEncoder } from '@ethereum-attestation-service/eas-sdk'
import PredictionMarketABI from '../abis/PredictionMarket.json'
import { getSchemaForMarketType, MarketType } from './dataStreams'
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
const WS_URL = process.env.SOMNIA_WS_URL || RPC_URL.replace('https://', 'wss://')
const PRIVATE_KEY = process.env.RESOLVER_PRIVATE_KEY as `0x${string}`

if (!MARKET_CONTRACT || !SOMI_TOKEN || !RPC_URL || !PRIVATE_KEY) {
  console.error('❌ Missing required environment variables!')
  console.error('Required: MARKET_CONTRACT, SOMI_TOKEN, SOMNIA_RPC_URL, RESOLVER_PRIVATE_KEY')
  process.exit(1)
}

// Initialize Viem clients
const account = privateKeyToAccount(PRIVATE_KEY)

// HTTP client for contract interactions
const publicClient = createPublicClient({
  chain: somniaTestnet,
  transport: http(RPC_URL),
  pollingInterval: 1000
})

// WebSocket client for Data Streams subscriptions
const wsPublicClient = createPublicClient({
  chain: somniaTestnet,
  transport: webSocket(WS_URL),
})

const walletClient = createWalletClient({
  chain: somniaTestnet,
  transport: http(RPC_URL),
  account
})

// Initialize Somnia Data Streams SDK
const dataStreamsSDK = new SDK({
  public: wsPublicClient,
  wallet: walletClient,
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
  dataSourceId: `0x${string}` // Somnia Data Streams identifier
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
        const marketData = await publicClient.readContract({
          address: MARKET_CONTRACT,
          abi: PredictionMarketABI.abi,
          functionName: 'markets',
          args: [marketId],
        }) as any

        // Destructure the array returned from Solidity
        // NOTE: Viem may return struct fields in a different order - using explicit indices
        const marketType = marketData[1]
        const question = marketData[2]
        const creator = marketData[3]
        const resolutionTime = marketData[5]
        const status = marketData[6]
        // Swapping these two - viem seems to return them in reverse order
        const threshold = marketData[10]  // This is actually showing as dataSourceId value
        const dataSourceId = marketData[11]  // This is actually showing as threshold value
        const thresholdToken = marketData[12]

        // Only track ACTIVE markets (status = 0)
        if (status === 0) {
          activeMarkets.set(marketId, {
            marketId,
            marketType,
            question,
            threshold,
            thresholdToken,
            resolutionTime,
            creator,
            dataSourceId,
          })

          console.log(`   ✓ Tracking market: ${question}`)
          console.log(`     Type: ${marketType} | Threshold: ${threshold ? threshold.toString() : 'undefined'} | DataStream: ${dataSourceId}`)

          // Subscribe to Data Streams for this market
          const trackedMarket = activeMarkets.get(marketId)
          if (trackedMarket) {
            await subscribeToDataStream(trackedMarket)
          }
        }
      } catch (error) {
        console.error(`   ✗ Failed to load market ${marketId}:`, error)
      }
    }

    console.log(`\n✅ Loaded ${activeMarkets.size} active markets\n`)
  } catch (error) {
    console.error('❌ Failed to load markets from contract:', error)
  }
}

// ===== SOMNIA DATA STREAMS SUBSCRIPTIONS =====

async function subscribeToDataStream(market: TrackedMarket) {
  // Only subscribe if market has a valid dataSourceId
  if (!market.dataSourceId || market.dataSourceId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
    console.log(`   ⏭️  Skipping Data Streams subscription (no dataSourceId)`)
    return
  }

  // DISABLED: WebSocket subscriptions are failing with network errors
  // The resolver works fine without them using HTTP polling instead
  console.log(`   ⏭️  Data Streams WebSocket subscription disabled (using HTTP polling instead)`)
  return

  try {
    console.log(`📡 Subscribing to Data Stream: ${market.dataSourceId}`)

    // Subscribe to the data stream for real-time updates
    await dataStreamsSDK.streams.subscribe({
      somniaStreamsEventId: market.dataSourceId,
      ethCalls: [], // No additional eth calls needed
      onlyPushChanges: false, // Push all events, not just changes
      onData: async (event: any) => {
        console.log(`\n📊 Data Stream update for market: ${market.question}`)
        console.log(`   Event data:`, event)

        // Check if market is ready for resolution
        if (!isReadyForResolution(market)) {
          console.log(`   ⏰ Market not yet ready for resolution`)
          return
        }

        // Determine winning option based on market type and event data
        let winningOption: number | null = null

        // For TRANSFER markets: check if transfer amount meets threshold
        if (market.marketType === 1 && event.value) {
          const transferAmount = BigInt(event.value)
          const question = market.question.toLowerCase()

          if (question.includes('more than') || question.includes('over') || question.includes('>')) {
            winningOption = transferAmount > market.threshold ? 0 : 1
          } else if (question.includes('less than') || question.includes('under') || question.includes('<')) {
            winningOption = transferAmount < market.threshold ? 0 : 1
          }
        }

        // For GAME markets: check if time/damage meets threshold
        if (market.marketType === 2 && event.timeTaken) {
          const timeTaken = BigInt(event.timeTaken)
          const question = market.question.toLowerCase()

          if (question.includes('less than') || question.includes('under') || question.includes('<')) {
            winningOption = timeTaken < market.threshold ? 0 : 1
          } else if (question.includes('more than') || question.includes('over') || question.includes('>')) {
            winningOption = timeTaken > market.threshold ? 0 : 1
          }
        }

        if (winningOption !== null) {
          console.log(`   → Result: ${winningOption === 0 ? 'YES' : 'NO'} wins`)
          await callResolveMarket(market.marketId, winningOption)
        }
      },
      onError: (error: any) => {
        console.error(`❌ Data Stream subscription error for ${market.marketId}:`, error)
      }
    })

    console.log(`✅ Subscribed to Data Stream for market: ${market.question}`)
  } catch (error) {
    console.error(`❌ Failed to subscribe to Data Stream:`, error)
  }
}

// ===== DATA STREAMS EVENT PUBLISHING =====

/**
 * Publish event data to Somnia Data Streams using setAndEmitEvents
 */
async function publishToDataStream(
  market: TrackedMarket,
  eventData: { [key: string]: any }
) {
  // Skip if no valid dataSourceId
  if (!market.dataSourceId || market.dataSourceId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
    return
  }

  try {
    const schema = getSchemaForMarketType(market.marketType as MarketType)
    const encoder = new SchemaEncoder(schema)

    // Encode data based on market type
    let encodedData: any

    if (market.marketType === MarketType.BLOCK && eventData.blockNumber && eventData.txCount) {
      encodedData = encoder.encodeData([
        { name: 'blockNumber', value: eventData.blockNumber, type: 'uint256' },
        { name: 'txCount', value: eventData.txCount, type: 'uint256' },
        { name: 'timestamp', value: eventData.timestamp || BigInt(Math.floor(Date.now() / 1000)), type: 'uint256' },
        { name: 'marketId', value: market.marketId, type: 'bytes32' },
      ])
    } else if (market.marketType === MarketType.TRANSFER && eventData.from && eventData.to && eventData.value) {
      encodedData = encoder.encodeData([
        { name: 'from', value: eventData.from, type: 'address' },
        { name: 'to', value: eventData.to, type: 'address' },
        { name: 'value', value: eventData.value, type: 'uint256' },
        { name: 'token', value: eventData.token || market.thresholdToken, type: 'address' },
        { name: 'timestamp', value: eventData.timestamp || BigInt(Math.floor(Date.now() / 1000)), type: 'uint256' },
        { name: 'marketId', value: market.marketId, type: 'bytes32' },
      ])
    } else if (market.marketType === MarketType.GAME && eventData.player && eventData.sessionId) {
      encodedData = encoder.encodeData([
        { name: 'player', value: eventData.player, type: 'address' },
        { name: 'sessionId', value: eventData.sessionId, type: 'bytes32' },
        { name: 'timeTaken', value: eventData.timeTaken, type: 'uint256' },
        { name: 'totalDamage', value: eventData.totalDamage, type: 'uint256' },
        { name: 'timestamp', value: eventData.timestamp || BigInt(Math.floor(Date.now() / 1000)), type: 'uint256' },
        { name: 'marketId', value: market.marketId, type: 'bytes32' },
      ])
    } else {
      console.log('⏭️  Skipping Data Streams publish (incomplete event data)')
      return
    }

    // Generate a unique data ID
    const dataId = keccak256(
      new TextEncoder().encode(`${market.marketId}-${Date.now()}`)
    )

    console.log(`📤 Publishing to Data Stream: ${market.dataSourceId}`)

    // Publish data and emit event atomically
    const txHash = await dataStreamsSDK.streams.setAndEmitEvents(
      [{ id: dataId, schemaId: market.dataSourceId, data: encodedData }],
      [{ id: 'MarketEvent', argumentTopics: [market.marketId], data: '0x' }]
    )

    console.log(`✅ Data Stream event published! Tx: ${txHash}`)
  } catch (error) {
    console.error(`❌ Failed to publish to Data Stream:`, error)
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
          const marketData = await publicClient.readContract({
            address: MARKET_CONTRACT,
            abi: PredictionMarketABI.abi,
            functionName: 'markets',
            args: [args.marketId],
          }) as any

          // NOTE: Viem may return struct fields in a different order - using explicit indices
          const marketType = marketData[1]
          const question = marketData[2]
          const creator = marketData[3]
          const resolutionTime = marketData[5]
          // Swapping these two - viem seems to return them in reverse order
          const threshold = marketData[10]
          const dataSourceId = marketData[11]
          const thresholdToken = marketData[12]

          activeMarkets.set(args.marketId, {
            marketId: args.marketId,
            marketType,
            question,
            threshold,
            thresholdToken,
            resolutionTime,
            creator,
            dataSourceId,
          })

          console.log(`   ✅ Now tracking this market`)

          // Subscribe to Data Streams for this new market
          const trackedMarket = activeMarkets.get(args.marketId)
          if (trackedMarket) {
            await subscribeToDataStream(trackedMarket)
          }
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
          if (market.marketType !== 1) continue

          // Publish to Data Streams regardless of resolution status
          await publishToDataStream(market, {
            from,
            to,
            value,
            token: SOMI_TOKEN,
            timestamp: BigInt(Math.floor(Date.now() / 1000)),
          })

          // Only resolve if ready
          if (!isReadyForResolution(market)) continue

          console.log(`\n🔍 Checking TRANSFER market: ${market.question}`)
          console.log(`   Transfer amount (wei): ${value.toString()}`)
          console.log(`   Transfer amount (SOMI): ${(Number(value) / 1e18).toFixed(2)}`)
          console.log(`   Threshold: ${market.threshold ? market.threshold.toString() : 'undefined'}`)

          // Convert threshold to wei for comparison (threshold is stored as plain number)
          const thresholdInWei = BigInt(market.threshold) * BigInt(10 ** 18)
          console.log(`   Threshold (wei): ${thresholdInWei.toString()}`)

          const question = market.question.toLowerCase()
          let winningOption: number

          if (question.includes('more than') || question.includes('over') || question.includes('>')) {
            winningOption = value > thresholdInWei ? 0 : 1
          } else if (question.includes('less than') || question.includes('under') || question.includes('<')) {
            winningOption = value < thresholdInWei ? 0 : 1
          } else {
            winningOption = value > thresholdInWei ? 0 : 1
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
          if (market.marketType !== 2) continue

          // Publish to Data Streams regardless of resolution status
          await publishToDataStream(market, {
            player,
            sessionId,
            timeTaken,
            totalDamage,
            timestamp: BigInt(Math.floor(Date.now() / 1000)),
          })

          // Only resolve if ready
          if (!isReadyForResolution(market)) continue

          console.log(`\n🔍 Checking GAME market: ${market.question}`)
          console.log(`   Time taken: ${timeTaken.toString()}`)
          console.log(`   Threshold: ${market.threshold ? market.threshold.toString() : 'undefined'}`)

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
      if (market.marketType !== 0) continue

      // Publish to Data Streams regardless of resolution status
      await publishToDataStream(market, {
        blockNumber,
        txCount: BigInt(txCount),
        timestamp: latestBlock.timestamp,
      })

      // Only resolve if ready
      if (!isReadyForResolution(market)) continue

      console.log(`\n🔍 Checking BLOCK market: ${market.question}`)
      console.log(`   Block ${blockNumber} has ${txCount} transactions`)
      console.log(`   Threshold: ${market.threshold ? market.threshold.toString() : 'undefined'} transactions`)

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

export async function startResolverService() {
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

  } catch (error) {
    console.error('❌ Resolver service failed:', error)
    throw error
  }
}

// Export active markets count for API endpoints
export function getResolverStats() {
  return {
    activeMarkets: activeMarkets.size,
    markets: Array.from(activeMarkets.values()).map(m => ({
      marketId: m.marketId,
      question: m.question,
      marketType: m.marketType,
      threshold: m.threshold.toString(),
      resolutionTime: Number(m.resolutionTime),
      dataSourceId: m.dataSourceId,
    }))
  }
}
