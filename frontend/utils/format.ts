import { type Hex } from 'viem';

/**
 * Format wallet address  
 */
export const formatAddress = (address: Hex): string => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

/**
 * Format time remaining  
 */
export const formatTimeRemaining = (timestamp: bigint): string => {
  const now = Date.now();
  // Contract returns timestamp in seconds, convert to milliseconds
  const timeLeft = (Number(timestamp) * 1000) - now;

  if (timeLeft <= 0) return 'Expired';

  const seconds = Math.floor(timeLeft / 1000);
  
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  
  return `${Math.floor(seconds / 86400)}d`;
};

/**
 * Format token amount  
 */
export const formatTokenAmount = (amount: bigint, decimals: number = 18): string => {
  const divisor = BigInt(10 ** decimals);
  const wholePart = amount / divisor;
  const fractionalPart = amount % divisor;
  
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  const trimmedFractional = fractionalStr.slice(0, 4).replace(/0+$/, '');
  
  if (!trimmedFractional) return wholePart.toString();
  
  return `${wholePart}.${trimmedFractional}`;
};

/**
 * Parse token amount string to bigint  
 */
export const parseTokenAmount = (amount: string, decimals: number = 18): bigint => {
  const [whole = '0', fractional = '0'] = amount.split('.');
  const paddedFractional = fractional.padEnd(decimals, '0').slice(0, decimals);
  
  return BigInt(whole) * BigInt(10 ** decimals) + BigInt(paddedFractional);
};

/**
 * Format odds multiplier  
 */
export const formatOdds = (odds: number): string => {
  return `${odds.toFixed(2)}x`;
};

/**
 * Format percentage  
 */
export const formatPercentage = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

/**
 * Generate market ID  
 */
export const generateMarketId = (
  creator: Hex,
  timestamp: number,
  question: string
): Hex => {
  const combined = `${creator}-${timestamp}-${question}`;
  // Simple hash - in production use keccak256
  return `0x${Buffer.from(combined).toString('hex').slice(0, 64).padEnd(64, '0')}` as Hex;
};

/**
 * Check if market is active  
 */
export const isMarketActive = (
  status: number,
  resolutionTime: bigint
): boolean => {
  // Contract returns timestamp in seconds, convert to milliseconds
  return status === 0 && Date.now() < Number(resolutionTime) * 1000;
};

/**
 * Check if market is resolved  
 */
export const isMarketResolved = (status: number): boolean => {
  return status === 2;
};

/**
 * Calculate potential winnings  
 */
export const calculatePotentialWinnings = (
  betAmount: bigint,
  odds: number
): bigint => {
  const winnings = Number(betAmount) * odds;
  return BigInt(Math.floor(winnings));
};

/**
 * Get market type label  
 */
export const getMarketTypeLabel = (marketType: number): string => {
  const labels = ['Block', 'Transfer', 'Game'];
  return labels[marketType] || 'Unknown';
};

/**
 * Get status label  
 */
export const getStatusLabel = (status: number): string => {
  const labels = ['Active', 'Locked', 'Resolved', 'Cancelled'];
  return labels[status] || 'Unknown';
};

/**
 * Format relative time  
 */
export const formatRelativeTime = (timestamp: bigint): string => {
  const now = Date.now();
  const diff = now - Number(timestamp);
  const seconds = Math.floor(diff / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  
  return `${Math.floor(seconds / 86400)}d ago`;
};