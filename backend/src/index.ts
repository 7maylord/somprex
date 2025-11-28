import express, { Request, Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { startResolverService, getResolverStats } from './resolverService'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'PredEx Resolver API'
  })
})

// Get resolver status
app.get('/api/status', (req: Request, res: Response) => {
  res.json({
    status: 'running',
    resolver: {
      address: process.env.RESOLVER_PRIVATE_KEY ? 'configured' : 'not configured',
      marketContract: process.env.MARKET_CONTRACT,
      somiToken: process.env.SOMI_TOKEN,
      gameContract: process.env.GAME_CONTRACT,
    }
  })
})

// Get active markets being tracked by resolver
app.get('/api/markets', (req: Request, res: Response) => {
  try {
    const stats = getResolverStats()
    res.json(stats)
  } catch (error) {
    res.status(500).json({ error: 'Failed to get resolver stats' })
  }
})

// Start server
app.listen(PORT, () => {
  console.log('=' .repeat(60))
  console.log('🚀 PredEx Backend API Server')
  console.log('=' .repeat(60))
  console.log(`\n📍 Server running on port ${PORT}`)
  console.log(`   Health check: http://localhost:${PORT}/health`)
  console.log(`   Status: http://localhost:${PORT}/api/status`)
  console.log('\n' + '=' .repeat(60) + '\n')

  // Start the resolver service
  console.log('🔧 Starting Resolver Service...\n')
  startResolverService()
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down server...')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n\n👋 Shutting down server...')
  process.exit(0)
})
