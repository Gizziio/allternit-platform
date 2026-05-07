/**
 * Plugin Reviews System
 * 
 * Provides functionality for submitting, retrieving, and managing plugin reviews.
 * Uses LocalStorage for persistence (can be migrated to a backend API later).
 */

// ============================================================================
// Types
// ============================================================================

export interface PluginReview {
  id: string;
  pluginId: string;
  userId: string;
  userName: string;
  rating: number; // 1-5
  review: string;
  createdAt: string;
  updatedAt?: string;
  helpfulCount: number;
  helpfulUserIds: string[]; // Track which users marked as helpful
}

export interface PluginRatingSummary {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

export type ReviewSortOption = 'newest' | 'highest' | 'helpful';

export interface SubmitReviewInput {
  pluginId: string;
  userId: string;
  userName: string;
  rating: number;
  review: string;
}

// ============================================================================
// Storage Keys
// ============================================================================

const REVIEWS_STORAGE_KEY = 'allternit:plugin-reviews:v1';
const CURRENT_USER_ID_KEY = 'allternit:plugin-reviews:current-user-id';

// ============================================================================
// Utility Functions
// ============================================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function safeJSONParse<T>(raw: string | null, defaultValue: T): T {
  if (!raw) return defaultValue;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// ============================================================================
// Current User Management
// ============================================================================

/**
 * Get or create a current user ID for the session.
 * In a real app, this would come from authentication.
 */
export function getCurrentUserId(): string {
  const storage = getStorage();
  if (!storage) return 'anonymous-user';
  
  let userId = storage.getItem(CURRENT_USER_ID_KEY);
  if (!userId) {
    userId = `user-${generateId()}`;
    storage.setItem(CURRENT_USER_ID_KEY, userId);
  }
  return userId;
}

/**
 * Set the current user ID (for testing or when user logs in)
 */
export function setCurrentUserId(userId: string): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(CURRENT_USER_ID_KEY, userId);
}

// ============================================================================
// Review CRUD Operations
// ============================================================================

function loadAllReviews(): PluginReview[] {
  const storage = getStorage();
  if (!storage) return [];
  return safeJSONParse(storage.getItem(REVIEWS_STORAGE_KEY), []);
}

function saveAllReviews(reviews: PluginReview[]): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(reviews));
  } catch {
    // Ignore storage errors (e.g., quota exceeded)
  }
}

/**
 * Submit a new review for a plugin.
 * If the user has already reviewed this plugin, updates the existing review.
 */
export function submitReview(input: SubmitReviewInput): PluginReview {
  const reviews = loadAllReviews();
  const now = new Date().toISOString();
  
  // Validate rating
  const clampedRating = Math.max(1, Math.min(5, Math.round(input.rating)));
  
  // Check if user already reviewed this plugin
  const existingIndex = reviews.findIndex(
    r => r.pluginId === input.pluginId && r.userId === input.userId
  );
  
  if (existingIndex >= 0) {
    // Update existing review
    const updated: PluginReview = {
      ...reviews[existingIndex],
      rating: clampedRating,
      review: input.review.trim(),
      updatedAt: now,
    };
    reviews[existingIndex] = updated;
    saveAllReviews(reviews);
    return updated;
  }
  
  // Create new review
  const newReview: PluginReview = {
    id: generateId(),
    pluginId: input.pluginId,
    userId: input.userId,
    userName: input.userName.trim() || 'Anonymous',
    rating: clampedRating,
    review: input.review.trim(),
    createdAt: now,
    helpfulCount: 0,
    helpfulUserIds: [],
  };
  
  reviews.push(newReview);
  saveAllReviews(reviews);
  return newReview;
}

/**
 * Get all reviews for a specific plugin.
 */
export function getReviews(
  pluginId: string,
  sortBy: ReviewSortOption = 'newest'
): PluginReview[] {
  const reviews = loadAllReviews().filter(r => r.pluginId === pluginId);
  
  return reviews.sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'highest':
        if (b.rating !== a.rating) return b.rating - a.rating;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'helpful':
        if (b.helpfulCount !== a.helpfulCount) return b.helpfulCount - a.helpfulCount;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      default:
        return 0;
    }
  });
}

/**
 * Get the rating summary for a plugin.
 */
export function getRatingSummary(pluginId: string): PluginRatingSummary {
  const reviews = loadAllReviews().filter(r => r.pluginId === pluginId);
  
  const distribution = {
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0,
  };
  
  let totalRating = 0;
  
  for (const review of reviews) {
    const rating = Math.max(1, Math.min(5, review.rating)) as 1 | 2 | 3 | 4 | 5;
    distribution[rating]++;
    totalRating += review.rating;
  }
  
  return {
    averageRating: reviews.length > 0 ? totalRating / reviews.length : 0,
    totalReviews: reviews.length,
    ratingDistribution: distribution,
  };
}

/**
 * Mark a review as helpful.
 * Returns true if the action was successful, false if user already marked.
 */
export function markHelpful(reviewId: string, userId: string): boolean {
  const reviews = loadAllReviews();
  const review = reviews.find(r => r.id === reviewId);
  
  if (!review) return false;
  if (review.helpfulUserIds.includes(userId)) return false; // Already marked
  
  review.helpfulCount++;
  review.helpfulUserIds.push(userId);
  
  saveAllReviews(reviews);
  return true;
}

/**
 * Unmark a review as helpful.
 * Returns true if the action was successful.
 */
export function unmarkHelpful(reviewId: string, userId: string): boolean {
  const reviews = loadAllReviews();
  const review = reviews.find(r => r.id === reviewId);
  
  if (!review) return false;
  
  const index = review.helpfulUserIds.indexOf(userId);
  if (index === -1) return false; // Not marked as helpful
  
  review.helpfulUserIds.splice(index, 1);
  review.helpfulCount = Math.max(0, review.helpfulCount - 1);
  
  saveAllReviews(reviews);
  return true;
}

/**
 * Check if the current user has already reviewed a plugin.
 */
export function hasUserReviewed(pluginId: string, userId: string): boolean {
  const reviews = loadAllReviews();
  return reviews.some(r => r.pluginId === pluginId && r.userId === userId);
}

/**
 * Get the current user's review for a plugin (if any).
 */
export function getUserReview(pluginId: string, userId: string): PluginReview | null {
  const reviews = loadAllReviews();
  return reviews.find(r => r.pluginId === pluginId && r.userId === userId) || null;
}

/**
 * Delete a review (useful for moderation or user deletion).
 */
export function deleteReview(reviewId: string, userId?: string): boolean {
  const reviews = loadAllReviews();
  const index = reviews.findIndex(r => r.id === reviewId);
  
  if (index === -1) return false;
  
  // If userId provided, only allow deletion if user owns the review
  if (userId && reviews[index].userId !== userId) return false;
  
  reviews.splice(index, 1);
  saveAllReviews(reviews);
  return true;
}

/**
 * Get all reviews by a specific user.
 */
export function getReviewsByUser(userId: string): PluginReview[] {
  return loadAllReviews()
    .filter(r => r.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Get the top-rated plugins based on average rating.
 * Returns array of pluginIds sorted by average rating.
 */
export function getTopRatedPlugins(limit: number = 10): Array<{ pluginId: string; summary: PluginRatingSummary }> {
  const reviews = loadAllReviews();
  const pluginIds = Array.from(new Set(reviews.map(r => r.pluginId)));
  
  const summaries = pluginIds.map(pluginId => ({
    pluginId,
    summary: getRatingSummary(pluginId),
  }));
  
  return summaries
    .filter(s => s.summary.totalReviews > 0)
    .sort((a, b) => {
      // Sort by average rating first, then by total reviews
      if (b.summary.averageRating !== a.summary.averageRating) {
        return b.summary.averageRating - a.summary.averageRating;
      }
      return b.summary.totalReviews - a.summary.totalReviews;
    })
    .slice(0, limit);
}

/**
 * Clear all reviews (useful for testing).
 */
export function clearAllReviews(): void {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(REVIEWS_STORAGE_KEY);
}

/**
 * Export reviews to JSON (for backup or migration).
 */
export function exportReviews(): string {
  return JSON.stringify(loadAllReviews(), null, 2);
}

/**
 * Import reviews from JSON (for restore or migration).
 */
export function importReviews(json: string): boolean {
  try {
    const reviews = JSON.parse(json) as PluginReview[];
    if (!Array.isArray(reviews)) return false;
    
    // Validate structure
    for (const review of reviews) {
      if (!review.id || !review.pluginId || !review.userId || typeof review.rating !== 'number') {
        return false;
      }
    }
    
    saveAllReviews(reviews);
    return true;
  } catch {
    return false;
  }
}
