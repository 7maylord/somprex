/**
 * Somnia Data Streams Schema Definitions for PredEx
 *
 * These schemas define the structure of data published to Somnia Data Streams
 * for different market types (BLOCK, TRANSFER, GAME)
 */

export const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`

// Schema for BLOCK markets
// Tracks block-related data: block number, transaction count, timestamp
export const BLOCK_MARKET_SCHEMA = 'uint256 blockNumber, uint256 txCount, uint256 timestamp, bytes32 marketId'

// Schema for TRANSFER markets
// Tracks token transfer data: from, to, amount, token address, timestamp
export const TRANSFER_MARKET_SCHEMA = 'address from, address to, uint256 value, address token, uint256 timestamp, bytes32 marketId'

// Schema for GAME markets
// Tracks game session data: player, sessionId, timeTaken, totalDamage, timestamp
export const GAME_MARKET_SCHEMA = 'address player, bytes32 sessionId, uint256 timeTaken, uint256 totalDamage, uint256 timestamp, bytes32 marketId'

/**
 * Market type enum matching the contract
 */
export enum MarketType {
  BLOCK = 0,
  TRANSFER = 1,
  GAME = 2,
}

/**
 * Get the schema string for a given market type
 */
export function getSchemaForMarketType(marketType: MarketType): string {
  switch (marketType) {
    case MarketType.BLOCK:
      return BLOCK_MARKET_SCHEMA
    case MarketType.TRANSFER:
      return TRANSFER_MARKET_SCHEMA
    case MarketType.GAME:
      return GAME_MARKET_SCHEMA
    default:
      throw new Error(`Unknown market type: ${marketType}`)
  }
}

/**
 * Get a human-readable name for the schema
 */
export function getSchemaName(marketType: MarketType): string {
  switch (marketType) {
    case MarketType.BLOCK:
      return 'BlockMarket'
    case MarketType.TRANSFER:
      return 'TransferMarket'
    case MarketType.GAME:
      return 'GameMarket'
    default:
      return 'Unknown'
  }
}
