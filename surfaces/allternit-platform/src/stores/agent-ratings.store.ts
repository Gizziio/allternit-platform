"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AgentReview {
  id: string;
  agentId: string;
  userId: string;
  userName: string;
  rating: number; // 1-5
  comment?: string;
  timestamp: string;
}

export interface AgentBenchmarkResult {
  agentId: string;
  agentName: string;
  benchmarkId: string;
  benchmarkName: string;
  score: number; // 0-100
  durationMs: number;
  timestamp: string;
}

interface AgentRatingsState {
  reviews: Record<string, AgentReview[]>; // agentId -> reviews
  benchmarks: AgentBenchmarkResult[];

  // Actions
  addReview: (review: Omit<AgentReview, "id" | "timestamp">) => void;
  getAgentRating: (agentId: string) => { rating: number; count: number } | null;
  addBenchmarkResult: (result: Omit<AgentBenchmarkResult, "timestamp">) => void;
  getLeaderboard: (benchmarkId?: string) => Array<{
    agentId: string;
    agentName: string;
    avgScore: number;
    totalRuns: number;
    avgRating: number;
    reviewCount: number;
  }>;
}

const DEMO_REVIEWS: Record<string, AgentReview[]> = {
  'agent-researcher': [
    { id: 'r1', agentId: 'agent-researcher', userId: 'u1', userName: 'Alex', rating: 5, comment: 'Incredible depth on technical topics.', timestamp: '2026-04-01T10:00:00Z' },
    { id: 'r2', agentId: 'agent-researcher', userId: 'u2', userName: 'Sam', rating: 4, comment: 'Very thorough, sometimes verbose.', timestamp: '2026-04-10T14:30:00Z' },
  ],
  'agent-coder': [
    { id: 'r3', agentId: 'agent-coder', userId: 'u3', userName: 'Jordan', rating: 5, comment: 'Writes clean, production-ready code.', timestamp: '2026-04-05T09:15:00Z' },
    { id: 'r4', agentId: 'agent-coder', userId: 'u4', userName: 'Taylor', rating: 5, comment: 'Best coding assistant I\'ve used.', timestamp: '2026-04-12T11:00:00Z' },
    { id: 'r5', agentId: 'agent-coder', userId: 'u5', userName: 'Morgan', rating: 4, comment: 'Great for React, decent for Python.', timestamp: '2026-04-18T16:45:00Z' },
  ],
  'agent-planner': [
    { id: 'r6', agentId: 'agent-planner', userId: 'u6', userName: 'Casey', rating: 4, comment: 'Good at breaking down complex projects.', timestamp: '2026-04-08T08:20:00Z' },
  ],
};

const DEMO_BENCHMARKS: AgentBenchmarkResult[] = [
  { agentId: 'agent-researcher', agentName: 'Researcher', benchmarkId: 'bench-1', benchmarkName: 'Web Research', score: 87, durationMs: 12400, timestamp: '2026-04-15T10:00:00Z' },
  { agentId: 'agent-coder', agentName: 'Coder', benchmarkId: 'bench-1', benchmarkName: 'Web Research', score: 62, durationMs: 8900, timestamp: '2026-04-15T10:05:00Z' },
  { agentId: 'agent-planner', agentName: 'Planner', benchmarkId: 'bench-1', benchmarkName: 'Web Research', score: 71, durationMs: 10200, timestamp: '2026-04-15T10:10:00Z' },
  { agentId: 'agent-coder', agentName: 'Coder', benchmarkId: 'bench-2', benchmarkName: 'Code Generation', score: 94, durationMs: 5600, timestamp: '2026-04-16T14:00:00Z' },
  { agentId: 'agent-researcher', agentName: 'Researcher', benchmarkId: 'bench-2', benchmarkName: 'Code Generation', score: 45, durationMs: 7800, timestamp: '2026-04-16T14:05:00Z' },
  { agentId: 'agent-planner', agentName: 'Planner', benchmarkId: 'bench-2', benchmarkName: 'Code Generation', score: 58, durationMs: 9200, timestamp: '2026-04-16T14:10:00Z' },
  { agentId: 'agent-coder', agentName: 'Coder', benchmarkId: 'bench-3', benchmarkName: 'Debugging', score: 91, durationMs: 4300, timestamp: '2026-04-17T09:00:00Z' },
  { agentId: 'agent-researcher', agentName: 'Researcher', benchmarkId: 'bench-3', benchmarkName: 'Debugging', score: 52, durationMs: 11200, timestamp: '2026-04-17T09:05:00Z' },
];

export const useAgentRatingsStore = create<AgentRatingsState>()(
  persist(
    (set, get) => ({
      reviews: DEMO_REVIEWS,
      benchmarks: DEMO_BENCHMARKS,

      addReview: (reviewData) => {
        const review: AgentReview = {
          ...reviewData,
          id: `review_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          timestamp: new Date().toISOString(),
        };
        set((state) => ({
          reviews: {
            ...state.reviews,
            [review.agentId]: [...(state.reviews[review.agentId] || []), review],
          },
        }));
      },

      getAgentRating: (agentId) => {
        const agentReviews = get().reviews[agentId] || [];
        if (agentReviews.length === 0) return null;
        const avg =
          agentReviews.reduce((sum, r) => sum + r.rating, 0) /
          agentReviews.length;
        return { rating: Math.round(avg * 10) / 10, count: agentReviews.length };
      },

      addBenchmarkResult: (resultData) => {
        const result: AgentBenchmarkResult = {
          ...resultData,
          timestamp: new Date().toISOString(),
        };
        set((state) => ({
          benchmarks: [...state.benchmarks, result],
        }));
      },

      getLeaderboard: (benchmarkId) => {
        const { benchmarks, reviews } = get();
        const agentMap = new Map<
          string,
          {
            agentId: string;
            agentName: string;
            scores: number[];
            totalRuns: number;
            ratings: number[];
          }
        >();

        // Aggregate benchmark scores
        benchmarks
          .filter((b) => !benchmarkId || b.benchmarkId === benchmarkId)
          .forEach((b) => {
            const existing = agentMap.get(b.agentId);
            if (existing) {
              existing.scores.push(b.score);
              existing.totalRuns++;
            } else {
              agentMap.set(b.agentId, {
                agentId: b.agentId,
                agentName: b.agentName,
                scores: [b.score],
                totalRuns: 1,
                ratings: [],
              });
            }
          });

        // Aggregate ratings
        Object.entries(reviews).forEach(([agentId, agentReviews]) => {
          const existing = agentMap.get(agentId);
          if (existing) {
            existing.ratings = agentReviews.map((r) => r.rating);
          } else if (agentReviews.length > 0) {
            agentMap.set(agentId, {
              agentId,
              agentName: agentReviews[0]?.userName || agentId,
              scores: [],
              totalRuns: 0,
              ratings: agentReviews.map((r) => r.rating),
            });
          }
        });

        return Array.from(agentMap.values())
          .map((entry) => ({
            agentId: entry.agentId,
            agentName: entry.agentName,
            avgScore:
              entry.scores.length > 0
                ? Math.round(
                    (entry.scores.reduce((a, b) => a + b, 0) /
                      entry.scores.length) *
                      10
                  ) / 10
                : 0,
            totalRuns: entry.totalRuns,
            avgRating:
              entry.ratings.length > 0
                ? Math.round(
                    (entry.ratings.reduce((a, b) => a + b, 0) /
                      entry.ratings.length) *
                      10
                  ) / 10
                : 0,
            reviewCount: entry.ratings.length,
          }))
          .sort((a, b) => b.avgScore - a.avgScore || b.avgRating - a.avgRating);
      },
    }),
    { name: "allternit-agent-ratings" }
  )
);
