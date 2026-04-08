/**
 * PluginReviews Component
 * 
 * Displays rating summary, review list, and allows users to write reviews.
 * Integrated with the PluginManager UI using Allternit dark theme.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  ThumbsUp,
  Chat,
  X,
  CaretDown,
  Star,
  CircleNotch,
} from '@phosphor-icons/react';
import {
  getReviews,
  getRatingSummary,
  submitReview,
  markHelpful,
  unmarkHelpful,
  getCurrentUserId,
  hasUserReviewed,
  getUserReview,
  type PluginReview,
  type ReviewSortOption,
} from '../plugins/reviews';
import { StarRating, RatingBar } from './StarRating';

// ============================================================================
// Theme (matching PluginManager)
// ============================================================================

const THEME = {
  bg: '#0c0a09',
  bgElevated: '#1c1917',
  accent: '#d4b08c',
  accentMuted: 'rgba(212, 176, 140, 0.15)',
  accentGlow: 'rgba(212, 176, 140, 0.3)',
  textPrimary: '#e7e5e4',
  textSecondary: '#a8a29e',
  textTertiary: '#78716c',
  border: 'rgba(212, 176, 140, 0.1)',
  borderStrong: 'rgba(212, 176, 140, 0.2)',
  success: '#22c55e',
  danger: '#ef4444',
  warning: '#f59e0b',
};

// ============================================================================
// Types
// ============================================================================

export interface PluginReviewsProps {
  pluginId: string;
  pluginName?: string;
}

// ============================================================================
// Helper Components
// ============================================================================

function Button({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon: Icon,
  size = 'md',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ComponentType<Record<string, unknown>>;
  size?: 'sm' | 'md';
}) {
  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 6,
    border: 'none',
    fontSize: size === 'sm' ? 12 : 13,
    fontWeight: 500,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled || loading ? 0.6 : 1,
    transition: 'all 0.15s ease',
    padding: size === 'sm' ? '6px 12px' : '8px 16px',
  };
  
  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: THEME.accent,
      color: THEME.bg,
    },
    secondary: {
      backgroundColor: 'rgba(255,255,255,0.08)',
      color: THEME.textPrimary,
      border: `1px solid ${THEME.borderStrong}`,
    },
    ghost: {
      backgroundColor: 'transparent',
      color: THEME.textSecondary,
    },
    danger: {
      backgroundColor: 'rgba(239, 68, 68, 0.12)',
      color: '#fca5a5',
      border: `1px solid rgba(239, 68, 68, 0.35)`,
    },
  };
  
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{ ...baseStyles, ...variantStyles[variant] }}
    >
      {loading && <CircleNotch size={14} style={{ animation: 'spin 1s linear infinite' }} />}
      {!loading && Icon && <Icon size={14} />}
      {children}
    </button>
  );
}

function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 520,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: number;
}) {
  if (!isOpen) return null;
  
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        backgroundColor: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth,
          backgroundColor: THEME.bgElevated,
          border: `1px solid ${THEME.borderStrong}`,
          borderRadius: 12,
          padding: 24,
          maxHeight: 'calc(100vh - 40px)',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: THEME.textPrimary, fontWeight: 600 }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: THEME.textTertiary,
              padding: 4,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// Review Card Component
// ============================================================================

function ReviewCard({
  review,
  currentUserId,
  onHelpfulToggle,
}: {
  review: PluginReview;
  currentUserId: string;
  onHelpfulToggle: (reviewId: string, isHelpful: boolean) => void;
}) {
  const isUserReview = review.userId === currentUserId;
  const isHelpful = review.helpfulUserIds.includes(currentUserId);
  
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };
  
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 10,
        border: `1px solid ${THEME.border}`,
        backgroundColor: isUserReview ? 'rgba(212, 176, 140, 0.05)' : 'rgba(255,255,255,0.02)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: THEME.accentMuted,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 600,
              color: THEME.accent,
            }}
          >
            {review.userName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: THEME.textPrimary }}>
              {review.userName}
              {isUserReview && (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 10,
                    padding: '2px 6px',
                    borderRadius: 4,
                    backgroundColor: THEME.accentMuted,
                    color: THEME.accent,
                  }}
                >
                  You
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: THEME.textTertiary }}>
              {formatDate(review.createdAt)}
              {review.updatedAt && ' · Edited'}
            </div>
          </div>
        </div>
        <StarRating rating={review.rating} size={14} />
      </div>
      
      <p
        style={{
          margin: '12px 0',
          fontSize: 13,
          color: THEME.textSecondary,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
        }}
      >
        {review.review}
      </p>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => onHelpfulToggle(review.id, !isHelpful)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            borderRadius: 4,
            border: 'none',
            backgroundColor: isHelpful ? THEME.accentMuted : 'transparent',
            color: isHelpful ? THEME.accent : THEME.textTertiary,
            fontSize: 12,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <ThumbsUp size={12} />
          Helpful
          {review.helpfulCount > 0 && (
            <span style={{ marginLeft: 2 }}>({review.helpfulCount})</span>
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Write Review Modal
// ============================================================================

function WriteReviewModal({
  isOpen,
  onClose,
  pluginId,
  pluginName,
  onSubmit,
  existingReview,
}: {
  isOpen: boolean;
  onClose: () => void;
  pluginId: string;
  pluginName?: string;
  onSubmit: () => void;
  existingReview: PluginReview | null;
}) {
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [review, setReview] = useState(existingReview?.review || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Reset form when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setRating(existingReview?.rating || 0);
      setReview(existingReview?.review || '');
      setError(null);
    }
  }, [isOpen, existingReview]);
  
  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }
    
    if (review.trim().length < 3) {
      setError('Review must be at least 3 characters');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const userId = getCurrentUserId();
      submitReview({
        pluginId,
        userId,
        userName: 'User', // In a real app, get from user profile
        rating,
        review: review.trim(),
      });
      onSubmit();
      onClose();
    } catch (err) {
      setError('Failed to submit review. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const ratingLabels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
  
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={existingReview ? 'Edit Your Review' : `Review ${pluginName || 'Plugin'}`}
    >
      <div style={{ marginBottom: 20 }}>
        <label
          style={{
            display: 'block',
            fontSize: 12,
            color: THEME.textSecondary,
            marginBottom: 8,
          }}
        >
          Your Rating
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <StarRating
            rating={rating}
            interactive
            onChange={setRating}
            size={28}
          />
          {rating > 0 && (
            <span style={{ fontSize: 14, color: THEME.accent, fontWeight: 500 }}>
              {ratingLabels[rating]}
            </span>
          )}
        </div>
      </div>
      
      <div style={{ marginBottom: 20 }}>
        <label
          style={{
            display: 'block',
            fontSize: 12,
            color: THEME.textSecondary,
            marginBottom: 8,
          }}
        >
          Your Review
        </label>
        <textarea
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder="Share your experience with this plugin..."
          style={{
            width: '100%',
            minHeight: 120,
            padding: 12,
            borderRadius: 8,
            border: `1px solid ${THEME.border}`,
            backgroundColor: 'rgba(255,255,255,0.03)',
            color: THEME.textPrimary,
            fontSize: 13,
            lineHeight: 1.5,
            resize: 'vertical',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            color: review.length < 3 ? THEME.danger : THEME.textTertiary,
          }}
        >
          {review.length} characters (minimum 3)
        </div>
      </div>
      
      {error && (
        <div
          style={{
            marginBottom: 16,
            padding: 10,
            borderRadius: 6,
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: `1px solid rgba(239, 68, 68, 0.35)`,
            color: '#fca5a5',
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button onClick={onClose} variant="ghost">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="primary"
          loading={isSubmitting}
          disabled={rating === 0 || review.trim().length < 3}
        >
          {existingReview ? 'Update Review' : 'Submit Review'}
        </Button>
      </div>
    </Modal>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PluginReviews({ pluginId, pluginName }: PluginReviewsProps) {
  const [sortBy, setSortBy] = useState<ReviewSortOption>('newest');
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const currentUserId = useMemo(() => getCurrentUserId(), []);
  
  // Get data
  const reviews = useMemo(
    () => getReviews(pluginId, sortBy),
    [pluginId, sortBy, refreshKey]
  );
  const summary = useMemo(() => getRatingSummary(pluginId), [pluginId, refreshKey]);
  const userHasReviewed = useMemo(
    () => hasUserReviewed(pluginId, currentUserId),
    [pluginId, currentUserId, refreshKey]
  );
  const userReview = useMemo(
    () => getUserReview(pluginId, currentUserId),
    [pluginId, currentUserId, refreshKey]
  );
  
  const handleHelpfulToggle = useCallback((reviewId: string, isHelpful: boolean) => {
    if (isHelpful) {
      markHelpful(reviewId, currentUserId);
    } else {
      unmarkHelpful(reviewId, currentUserId);
    }
    setRefreshKey((k) => k + 1);
  }, [currentUserId]);
  
  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);
  
  const sortOptions: { value: ReviewSortOption; label: string }[] = [
    { value: 'newest', label: 'Newest' },
    { value: 'highest', label: 'Highest Rated' },
    { value: 'helpful', label: 'Most Helpful' },
  ];
  
  return (
    <div
      style={{
        backgroundColor: THEME.bgElevated,
        border: `1px solid ${THEME.border}`,
        borderRadius: 12,
        padding: 20,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Chat size={18} color={THEME.accent} />
          <h3 style={{ margin: 0, fontSize: 16, color: THEME.textPrimary, fontWeight: 600 }}>
            Reviews
          </h3>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 999,
              backgroundColor: 'rgba(255,255,255,0.08)',
              color: THEME.textSecondary,
              fontSize: 12,
            }}
          >
            {summary.totalReviews}
          </span>
        </div>
        <Button
          onClick={() => setIsWriteModalOpen(true)}
          variant={userHasReviewed ? 'secondary' : 'primary'}
          size="sm"
          icon={userHasReviewed ? undefined : Star}
        >
          {userHasReviewed ? 'Edit Review' : 'Write a Review'}
        </Button>
      </div>
      
      {summary.totalReviews > 0 ? (
        <>
          {/* Rating Summary */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: 24,
              padding: 16,
              backgroundColor: 'rgba(0,0,0,0.2)',
              borderRadius: 10,
              marginBottom: 20,
            }}
          >
            {/* Left: Average Rating */}
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: 42,
                  fontWeight: 700,
                  color: THEME.textPrimary,
                  lineHeight: 1,
                }}
              >
                {summary.averageRating.toFixed(1)}
              </div>
              <div style={{ marginTop: 4 }}>
                <StarRating rating={Math.round(summary.averageRating)} size={16} />
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  color: THEME.textTertiary,
                }}
              >
                {summary.totalReviews} review{summary.totalReviews !== 1 ? 's' : ''}
              </div>
            </div>
            
            {/* Right: Distribution Bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center' }}>
              {[5, 4, 3, 2, 1].map((star) => (
                <RatingBar
                  key={star}
                  starCount={star}
                  count={summary.ratingDistribution[star as 1 | 2 | 3 | 4 | 5]}
                  total={summary.totalReviews}
                  size="sm"
                />
              ))}
            </div>
          </div>
          
          {/* Sort Dropdown */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 13, color: THEME.textSecondary }}>
              {reviews.length} review{reviews.length !== 1 ? 's' : ''}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: THEME.textTertiary }}>Sort by:</span>
              <div style={{ position: 'relative' }}>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as ReviewSortOption)}
                  style={{
                    appearance: 'none',
                    padding: '6px 28px 6px 12px',
                    borderRadius: 6,
                    border: `1px solid ${THEME.border}`,
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    color: THEME.textPrimary,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  {sortOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <CaretDown
                  size={14}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    color: THEME.textTertiary,
                  }}
                />
              </div>
            </div>
          </div>
          
          {/* Reviews List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                currentUserId={currentUserId}
                onHelpfulToggle={handleHelpfulToggle}
              />
            ))}
          </div>
        </>
      ) : (
        /* Empty State */
        <div
          style={{
            textAlign: 'center',
            padding: '40px 20px',
          }}
        >
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              backgroundColor: THEME.accentMuted,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <Star size={28} color={THEME.accent} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: THEME.textPrimary, marginBottom: 8 }}>
            No reviews yet
          </div>
          <div style={{ fontSize: 13, color: THEME.textSecondary, marginBottom: 16 }}>
            Be the first to review this plugin and help others decide.
          </div>
          <Button onClick={() => setIsWriteModalOpen(true)} variant="primary" icon={Star}>
            Write a Review
          </Button>
        </div>
      )}
      
      {/* Write Review Modal */}
      <WriteReviewModal
        isOpen={isWriteModalOpen}
        onClose={() => setIsWriteModalOpen(false)}
        pluginId={pluginId}
        pluginName={pluginName}
        onSubmit={handleRefresh}
        existingReview={userReview}
      />
    </div>
  );
}

export default PluginReviews;
