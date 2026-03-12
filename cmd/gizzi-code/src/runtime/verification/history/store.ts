/**
 * Confidence History Store
 * 
 * Persists and queries visual verification confidence scores over time.
 * Enables trend analysis and reporting.
 */

import { Log } from "@/shared/util/log";
import { Bus } from "@/shared/bus";

const log = Log.create({ service: "verification.history" });

// ============================================================================
// Types
// ============================================================================

export interface ConfidenceRecord {
  id: string;
  wihId: string;
  sessionId?: string;
  timestamp: number;
  confidence: number;
  threshold: number;
  passed: boolean;
  artifactTypes: string[];
  providerType: string;
  metadata?: {
    agent?: string;
    project?: string;
    branch?: string;
    commitSha?: string;
  };
}

export interface TrendAnalysis {
  period: { start: number; end: number };
  totalVerifications: number;
  passCount: number;
  failCount: number;
  averageConfidence: number;
  confidenceTrend: "improving" | "declining" | "stable";
  confidenceByType: Record<string, { avg: number; count: number }>;
}

// ============================================================================
// In-Memory Storage (for simplicity, can be swapped for SQLite)
// ============================================================================

export class InMemoryHistoryStorage {
  private records: ConfidenceRecord[] = [];
  private maxSize: number;

  constructor(maxSize: number = 10000) {
    this.maxSize = maxSize;
  }

  async save(record: ConfidenceRecord): Promise<void> {
    this.records.push(record);
    
    // Keep only recent records if limit exceeded
    if (this.records.length > this.maxSize) {
      this.records = this.records.slice(-this.maxSize);
    }
  }

  async query(filters: {
    wihId?: string;
    sessionId?: string;
    startTime?: number;
    endTime?: number;
    passed?: boolean;
    minConfidence?: number;
    limit?: number;
  }): Promise<ConfidenceRecord[]> {
    let results = this.records;

    if (filters.wihId) {
      results = results.filter(r => r.wihId === filters.wihId);
    }

    if (filters.sessionId) {
      results = results.filter(r => r.sessionId === filters.sessionId);
    }

    if (filters.startTime) {
      results = results.filter(r => r.timestamp >= filters.startTime!);
    }

    if (filters.endTime) {
      results = results.filter(r => r.timestamp <= filters.endTime!);
    }

    if (filters.passed !== undefined) {
      results = results.filter(r => r.passed === filters.passed);
    }

    if (filters.minConfidence) {
      results = results.filter(r => r.confidence >= filters.minConfidence!);
    }

    // Sort by timestamp descending
    results = results.sort((a, b) => b.timestamp - a.timestamp);

    if (filters.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  async getTrends(period: { start: number; end: number }): Promise<TrendAnalysis> {
    const records = this.records.filter(
      r => r.timestamp >= period.start && r.timestamp <= period.end
    );

    const total = records.length;
    const passed = records.filter(r => r.passed).length;
    const failed = total - passed;

    const avgConfidence = total > 0
      ? records.reduce((sum, r) => sum + r.confidence, 0) / total
      : 0;

    // Calculate trend
    const midPoint = (period.start + period.end) / 2;
    const firstHalf = records.filter(r => r.timestamp < midPoint);
    const secondHalf = records.filter(r => r.timestamp >= midPoint);

    const firstAvg = firstHalf.length > 0
      ? firstHalf.reduce((sum, r) => sum + r.confidence, 0) / firstHalf.length
      : 0;
    const secondAvg = secondHalf.length > 0
      ? secondHalf.reduce((sum, r) => sum + r.confidence, 0) / secondHalf.length
      : 0;

    let confidenceTrend: "improving" | "declining" | "stable" = "stable";
    if (firstAvg > 0 && secondAvg > 0) {
      const diff = secondAvg - firstAvg;
      if (diff > 0.05) confidenceTrend = "improving";
      else if (diff < -0.05) confidenceTrend = "declining";
    }

    // Confidence by type
    const confidenceByType: Record<string, { avg: number; count: number }> = {};
    const typeGroups: Record<string, number[]> = {};

    for (const record of records) {
      const key = record.artifactTypes.join(",");
      if (!typeGroups[key]) typeGroups[key] = [];
      typeGroups[key].push(record.confidence);
    }

    for (const [key, confidences] of Object.entries(typeGroups)) {
      confidenceByType[key] = {
        avg: confidences.reduce((a, b) => a + b, 0) / confidences.length,
        count: confidences.length,
      };
    }

    return {
      period,
      totalVerifications: total,
      passCount: passed,
      failCount: failed,
      averageConfidence: avgConfidence,
      confidenceTrend,
      confidenceByType,
    };
  }

  async cleanup(maxAgeDays: number): Promise<number> {
    const cutoff = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
    const initialSize = this.records.length;
    
    this.records = this.records.filter(r => r.timestamp >= cutoff);
    
    return initialSize - this.records.length;
  }
}

// ============================================================================
// Service
// ============================================================================

export class ConfidenceHistoryService {
  private storage = new InMemoryHistoryStorage();

  async record(evidence: {
    wihId: string;
    sessionId?: string;
    confidence: number;
    threshold: number;
    passed: boolean;
    artifactTypes: string[];
    providerType: string;
    metadata?: any;
  }): Promise<void> {
    const record: ConfidenceRecord = {
      id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      wihId: evidence.wihId,
      sessionId: evidence.sessionId,
      timestamp: Date.now(),
      confidence: evidence.confidence,
      threshold: evidence.threshold,
      passed: evidence.passed,
      artifactTypes: evidence.artifactTypes,
      providerType: evidence.providerType,
      metadata: evidence.metadata,
    };

    await this.storage.save(record);

    Bus.publish("visual.verification.recorded", {
      wihId: evidence.wihId,
      confidence: evidence.confidence,
      passed: evidence.passed,
    });
  }

  async getHistory(
    wihId?: string,
    options?: { limit?: number; days?: number }
  ): Promise<ConfidenceRecord[]> {
    const endTime = Date.now();
    const startTime = options?.days 
      ? endTime - (options.days * 24 * 60 * 60 * 1000)
      : 0;

    return this.storage.query({
      wihId,
      startTime,
      endTime,
      limit: options?.limit || 100,
    });
  }

  async getTrends(days: number = 30): Promise<TrendAnalysis> {
    const end = Date.now();
    const start = end - (days * 24 * 60 * 60 * 1000);

    return this.storage.getTrends({ start, end });
  }

  async getStats(): Promise<{
    total: number;
    passed: number;
    failed: number;
    averageConfidence: number;
  }> {
    const trends = await this.getTrends(365);

    return {
      total: trends.totalVerifications,
      passed: trends.passCount,
      failed: trends.failCount,
      averageConfidence: trends.averageConfidence,
    };
  }

  async cleanup(maxAgeDays: number = 90): Promise<number> {
    return this.storage.cleanup(maxAgeDays);
  }
}

// Singleton
let globalHistoryService: ConfidenceHistoryService | null = null;

export function getHistoryService(): ConfidenceHistoryService {
  if (!globalHistoryService) {
    globalHistoryService = new ConfidenceHistoryService();
  }
  return globalHistoryService;
}
