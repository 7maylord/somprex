'use client'

import { useState, useEffect } from 'react'
import { usePublicClient, useWalletClient } from 'wagmi'
import { SDK } from '@somnia-chain/streams'
import {
  MarketType,
  getSchemaForMarketType,
  getSchemaName,
  ZERO_BYTES32
} from '@/lib/dataStreams'

/**
 * Hook for managing Somnia Data Streams schemas
 */
export function useDataStreams() {
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const [sdk, setSDK] = useState<SDK | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize SDK when wallet is connected
  useEffect(() => {
    if (walletClient && publicClient) {
      try {
        // WebSocket URL for Data Streams subscriptions
        const wsUrl = 'wss://dream-rpc.somnia.network/ws'
        console.log('Initializing Data Streams SDK with WebSocket:', wsUrl)

        const dataStreamsSDK = new SDK({
          public: publicClient as any,
          wallet: walletClient as any,
        })

        setSDK(dataStreamsSDK)
        setIsInitialized(true)
      } catch (error) {
        console.error('Failed to initialize Data Streams SDK:', error)
      }
    }
  }, [walletClient, publicClient])

  /**
   * Compute the schema ID for a given market type
   */
  const computeSchemaId = async (marketType: MarketType): Promise<`0x${string}` | null> => {
    if (!sdk) {
      console.error('SDK not initialized')
      return null
    }

    try {
      const schema = getSchemaForMarketType(marketType)
      const schemaId = await sdk.streams.computeSchemaId(schema)
      console.log(`Computed schema ID for ${getSchemaName(marketType)}:`, schemaId)
      return schemaId as `0x${string}`
    } catch (error) {
      console.error(`Failed to compute schema ID for ${getSchemaName(marketType)}:`, error)
      return null
    }
  }

  /**
   * Check if a schema is already registered
   */
  const isSchemaRegistered = async (schemaId: `0x${string}`): Promise<boolean> => {
    if (!sdk) return false

    try {
      const registered = await sdk.streams.isDataSchemaRegistered(schemaId)
      return registered ?? false
    } catch (error) {
      console.error('Failed to check schema registration:', error)
      return false
    }
  }

  /**
   * Register a schema on-chain
   */
  const registerSchema = async (marketType: MarketType): Promise<`0x${string}` | null> => {
    if (!sdk) {
      console.error('SDK not initialized')
      return null
    }

    try {
      const schema = getSchemaForMarketType(marketType)
      const schemaName = getSchemaName(marketType)
      const schemaId = await sdk.streams.computeSchemaId(schema)

      if (!schemaId) {
        console.error('Failed to compute schema ID')
        return null
      }

      // Check if already registered
      const registered = await sdk.streams.isDataSchemaRegistered(schemaId)
      if (registered) {
        console.log(`Schema ${schemaName} already registered with ID:`, schemaId)
        return schemaId as `0x${string}`
      }

      console.log(`Registering schema ${schemaName}...`)

      // Register the schema
      const txHash = await sdk.streams.registerDataSchemas(
        [
          {
            id: schemaName,
            schema,
            parentSchemaId: ZERO_BYTES32,
          },
        ],
        true // ignoreAlreadyRegistered
      )

      if (!txHash || txHash instanceof Error) {
        console.error('Failed to get transaction hash for schema registration')
        return null
      }

      console.log(`Schema registration tx:`, txHash)

      // Wait for confirmation
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: txHash })
        console.log(`✅ Schema ${schemaName} registered successfully!`)
      }

      // Return the computed schema ID
      const finalSchemaId = await sdk.streams.computeSchemaId(schema)
      if (!finalSchemaId) {
        console.error('Failed to get final schema ID after registration')
        return null
      }
      return finalSchemaId as `0x${string}`
    } catch (error) {
      console.error(`Failed to register schema for ${getSchemaName(marketType)}:`, error)
      return null
    }
  }

  /**
   * Get or register schema ID for a market type
   * This ensures the schema is registered before creating a market
   */
  const getOrRegisterSchemaId = async (marketType: MarketType): Promise<`0x${string}` | null> => {
    if (!sdk) {
      console.error('SDK not initialized')
      return null
    }

    try {
      // First compute the schema ID
      const schemaId = await computeSchemaId(marketType)
      if (!schemaId) return null

      // Check if already registered
      const registered = await isSchemaRegistered(schemaId)

      if (registered) {
        console.log(`Schema for ${getSchemaName(marketType)} already registered`)
        return schemaId
      }

      // Register if not already registered
      return await registerSchema(marketType)
    } catch (error) {
      console.error('Failed to get or register schema:', error)
      return null
    }
  }

  return {
    sdk,
    isInitialized,
    computeSchemaId,
    isSchemaRegistered,
    registerSchema,
    getOrRegisterSchemaId,
  }
}
