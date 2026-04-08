/**
 * Confidence & Reliability Calculator
 * 
 * Calculates confidence and reliability scores from visual state history.
 */

import { VisualStateHistoryEntry, VisualState } from '../types';

export interface ConfidenceMetrics {
  /** Overall confidence score (0-1) */
  confidence: number;
  /** Reliability score based on error rates (0-1) */
  reliability: number;
  /** Trend direction: 'improving', 'stable', 'declining' */
  trend: 'improving' | 'stable' | 'declining';
  /** Volatility measure (0-1) */
  volatility: number;
}

/**
 * Calculate confidence from history
 * Based on success rate of recent tasks
 */
export function calculateConfidence(
  history: VisualStateHistoryEntry[],
  windowSize: number = 10
): number {
  if (history.length === 0) {
    return 0.5; // Neutral default
  }

  // Get recent entries
  const recent = history.slice(-windowSize);
  
  // Calculate average confidence from states
  const avgConfidence = recent.reduce((sum, entry) => 
    sum + entry.state.confidence, 0
  ) / recent.length;

  // Weight by reliability
  const avgReliability = recent.reduce((sum, entry) => 
    sum + entry.state.reliability, 0
  ) / recent.length;

  // Combined score
  return (avgConfidence * 0.7 + avgReliability * 0.3);
}

/**
 * Calculate reliability from history
 * Based on error rates and consistency
 */
export function calculateReliability(
  history: VisualStateHistoryEntry[],
  windowSize: number = 20
): number {
  if (history.length < 2) {
    return 0.5;
  }

  const recent = history.slice(-windowSize);

  // Count error states
  const errorCount = recent.filter(entry => 
    entry.state.mood === 'error'
  ).length;

  // Count warning states
  const warningCount = recent.filter(entry => 
    entry.state.mood === 'warning'
  ).length;

  // Calculate error rate
  const errorRate = (errorCount + warningCount * 0.5) / recent.length;

  // Reliability is inverse of error rate
  return Math.max(0, 1 - errorRate);
}

/**
 * Calculate trend direction
 */
export function calculateTrend(
  history: VisualStateHistoryEntry[],
  windowSize: number = 10
): 'improving' | 'stable' | 'declining' {
  if (history.length < windowSize * 2) {
    return 'stable';
  }

  const recent = history.slice(-windowSize);
  const previous = history.slice(-windowSize * 2, -windowSize);

  const recentConfidence = recent.reduce((sum, e) => sum + e.state.confidence, 0) / recent.length;
  const previousConfidence = previous.reduce((sum, e) => sum + e.state.confidence, 0) / previous.length;

  const difference = recentConfidence - previousConfidence;

  if (difference > 0.1) {
    return 'improving';
  } else if (difference < -0.1) {
    return 'declining';
  }
  return 'stable';
}

/**
 * Calculate volatility (consistency of states)
 */
export function calculateVolatility(
  history: VisualStateHistoryEntry[],
  windowSize: number = 10
): number {
  if (history.length < 2) {
    return 0;
  }

  const recent = history.slice(-windowSize);
  const confidences = recent.map(e => e.state.confidence);

  // Calculate standard deviation
  const mean = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
  const squaredDiffs = confidences.map(c => Math.pow(c - mean, 2));
  const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / squaredDiffs.length;
  const stdDev = Math.sqrt(variance);

  // Normalize to 0-1 range (assuming max reasonable stdDev is 0.5)
  return Math.min(1, stdDev * 2);
}

/**
 * Calculate all metrics at once
 */
export function calculateMetrics(
  history: VisualStateHistoryEntry[]
): ConfidenceMetrics {
  return {
    confidence: calculateConfidence(history),
    reliability: calculateReliability(history),
    trend: calculateTrend(history),
    volatility: calculateVolatility(history),
  };
}

/**
 * Get color for confidence level
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return '#4CAF50'; // Green
  if (confidence >= 0.6) return '#8BC34A'; // Light green
  if (confidence >= 0.4) return '#FFC107'; // Yellow
  if (confidence >= 0.2) return '#FF9800'; // Orange
  return '#F44336'; // Red
}

/**
 * Get color for reliability level
 */
export function getReliabilityColor(reliability: number): string {
  if (reliability >= 0.9) return '#2196F3'; // Blue
  if (reliability >= 0.7) return '#00BCD4'; // Cyan
  if (reliability >= 0.5) return '#FFC107'; // Yellow
  if (reliability >= 0.3) return '#FF5722'; // Deep orange
  return '#F44336'; // Red
}
