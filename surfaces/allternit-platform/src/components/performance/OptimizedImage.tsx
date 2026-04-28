/**
 * OptimizedImage - Performance-optimized image component
 * 
 * Features:
 * - Lazy loading with Intersection Observer
 * - Blur-up placeholder effect
 * - WebP/AVIF format detection
 * - Responsive srcset support
 * - Loading state management
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ImageSkeleton } from './ViewSkeleton';

export interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  /** Enable lazy loading (default: true) */
  lazy?: boolean;
  /** Placeholder color while loading */
  placeholderColor?: string;
  /** Blur hash or base64 placeholder */
  blurHash?: string;
  /** Object fit style */
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  /** Custom className */
  className?: string;
  /** Container className */
  containerClassName?: string;
  /** Callback when image loads */
  onLoad?: () => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Srcset for responsive images */
  srcSet?: string;
  /** Sizes attribute for responsive images */
  sizes?: string;
  /** Priority loading (disables lazy) */
  priority?: boolean;
  /** Rounded corners */
  rounded?: boolean | string;
}

/**
 * Detects WebP support
 */
function useWebPSupport(): boolean {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const check = async () => {
      const canvas = document.createElement('canvas');
      if (canvas.getContext && canvas.getContext('2d')) {
        const isSupported = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
        setSupported(isSupported);
      }
    };
    check();
  }, []);

  return supported;
}

/**
 * Detects AVIF support
 */
function useAvifSupport(): boolean {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const check = async () => {
      const img = new Image();
      img.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=';
      img.onload = () => setSupported(true);
      img.onerror = () => setSupported(false);
    };
    check();
  }, []);

  return supported;
}

/**
 * OptimizedImage - Loads images efficiently with lazy loading and format optimization
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  lazy = true,
  placeholderColor = 'var(--ui-text-primary)',
  blurHash,
  objectFit = 'cover',
  className = '',
  containerClassName = '',
  onLoad,
  onError,
  srcSet,
  sizes,
  priority = false,
  rounded = false,
}: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [isInViewport, setIsInViewport] = useState(priority || !lazy);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const supportsWebP = useWebPSupport();
  const supportsAVIF = useAvifSupport();

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || !lazy || isInViewport) return;

    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInViewport(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '100px',
        threshold: 0,
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [lazy, priority, isInViewport]);

  // Handle image load
  const handleLoad = useCallback(() => {
    setLoaded(true);
    setError(false);
    onLoad?.();
  }, [onLoad]);

  // Handle image error
  const handleError = useCallback(() => {
    setError(true);
    onError?.(new Error(`Failed to load image: ${src}`));
  }, [src, onError]);

  // Get optimized src based on browser support
  const optimizedSrc = useCallback(() => {
    // If src already has format suffix, use as-is
    if (src.endsWith('.avif') || src.endsWith('.webp')) {
      return src;
    }

    // Try AVIF first (smallest size)
    if (supportsAVIF) {
      const avifSrc = src.replace(/\.(jpg|jpeg|png)$/i, '.avif');
      if (avifSrc !== src) return avifSrc;
    }

    // Fall back to WebP
    if (supportsWebP) {
      const webpSrc = src.replace(/\.(jpg|jpeg|png)$/i, '.webp');
      if (webpSrc !== src) return webpSrc;
    }

    return src;
  }, [src, supportsWebP, supportsAVIF]);

  // Rounded styles
  const roundedStyle = typeof rounded === 'string' 
    ? rounded 
    : rounded ? 'rounded-lg' : '';

  // Placeholder styles
  const placeholderStyle: React.CSSProperties = {
    backgroundColor: placeholderColor,
    filter: blurHash ? 'blur(20px)' : undefined,
    transform: blurHash ? 'scale(1.1)' : undefined,
  };

  if (error) {
    return (
      <div
        ref={containerRef}
        className={`relative overflow-hidden bg-muted flex items-center justify-center ${roundedStyle} ${containerClassName}`}
        style={{ width, height, aspectRatio: width && height ? `${width}/${height}` : undefined }}
      >
        <svg
          className="w-8 h-8 text-muted-foreground/50"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${roundedStyle} ${containerClassName}`}
      style={{
        width,
        height,
        aspectRatio: width && height ? `${width}/${height}` : undefined,
        backgroundColor: placeholderColor,
      }}
    >
      {/* Placeholder / Skeleton */}
      {!loaded && (
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={placeholderStyle}
        >
          {!blurHash && <ImageSkeleton aspectRatio={width && height ? `${width}/${height}` : '16/9'} />}
        </div>
      )}

      {/* Actual Image */}
      {isInViewport && (
        <img
          ref={imgRef}
          src={optimizedSrc()}
          alt={alt}
          width={width}
          height={height}
          srcSet={srcSet}
          sizes={sizes}
          loading={priority ? 'eager' : 'lazy'}
          decoding={priority ? 'sync' : 'async'}
          onLoad={handleLoad}
          onError={handleError}
          className={`transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} ${className}`}
          style={{
            objectFit,
            width: '100%',
            height: '100%',
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// Responsive Image Component
// ============================================================================

export interface ResponsiveImageProps extends Omit<OptimizedImageProps, 'srcSet' | 'sizes'> {
  /** Available widths for srcset generation */
  widths?: number[];
  /** Base URL for image (without extension) */
  baseSrc: string;
}

/**
 * ResponsiveImage - Automatically generates srcset for responsive images
 */
export function ResponsiveImage({
  baseSrc,
  widths = [320, 640, 960, 1280, 1920],
  ...props
}: ResponsiveImageProps) {
  const supportsWebP = useWebPSupport();

  const { srcSet, sizes } = useMemo(() => {
    const extension = supportsWebP ? 'webp' : 'jpg';
    const srcSetString = widths
      .map((w) => `${baseSrc}-${w}.${extension} ${w}w`)
      .join(', ');
    
    const sizesString = widths
      .map((w, i) => {
        if (i === widths.length - 1) return `${w}px`;
        const nextWidth = widths[i + 1];
        return `(max-width: ${nextWidth}px) ${w}px`;
      })
      .reverse()
      .join(', ');

    return { srcSet: srcSetString, sizes: sizesString };
  }, [baseSrc, widths, supportsWebP]);

  return (
    <OptimizedImage
      {...props}
      src={`${baseSrc}-960.${supportsWebP ? 'webp' : 'jpg'}`}
      srcSet={srcSet}
      sizes={sizes}
    />
  );
}

// ============================================================================
// Image Preloader Hook
// ============================================================================

/**
 * Hook to preload images
 */
export function useImagePreloader() {
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());

  const preload = useCallback((src: string): Promise<void> => {
    if (loadedImages.has(src)) return Promise.resolve();
    if (loadingImages.has(src)) {
      // Wait for existing load
      return new Promise((resolve) => {
        const check = setInterval(() => {
          if (loadedImages.has(src)) {
            clearInterval(check);
            resolve();
          }
        }, 100);
      });
    }

    setLoadingImages(prev => new Set(prev).add(src));

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        setLoadedImages(prev => new Set(prev).add(src));
        setLoadingImages(prev => {
          const next = new Set(prev);
          next.delete(src);
          return next;
        });
        resolve();
      };
      img.onerror = reject;
    });
  }, [loadedImages, loadingImages]);

  const preloadMultiple = useCallback(async (srcs: string[]): Promise<void> => {
    await Promise.all(srcs.map(preload));
  }, [preload]);

  return { preload, preloadMultiple, isLoaded: (src: string) => loadedImages.has(src) };
}

// ============================================================================
// Background Image Component
// ============================================================================

export interface BackgroundImageProps {
  src: string;
  children?: React.ReactNode;
  className?: string;
  lazy?: boolean;
  overlay?: boolean;
  overlayClassName?: string;
}

/**
 * BackgroundImage - Lazy-loaded background image
 */
export function BackgroundImage({
  src,
  children,
  className = '',
  lazy = true,
  overlay = false,
  overlayClassName = 'bg-black/50',
}: BackgroundImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [isInViewport, setIsInViewport] = useState(!lazy);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lazy || isInViewport) return;

    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [lazy, isInViewport]);

  useEffect(() => {
    if (!isInViewport) return;

    const img = new Image();
    img.src = src;
    img.onload = () => setLoaded(true);
  }, [src, isInViewport]);

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={{
        backgroundImage: loaded ? `url(${src})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        transition: 'opacity 0.3s',
        opacity: loaded ? 1 : 0.5,
      }}
    >
      {overlay && <div className={`absolute inset-0 ${overlayClassName}`} />}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
