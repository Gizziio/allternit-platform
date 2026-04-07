/**
 * Anthropic API Limits
 *
 * These constants define server-side limits enforced by the Anthropic API.
 * Keep this file dependency-free to prevent circular imports.
 * Last verified: 2025-12-22
 * Source: api/api/schemas/messages/blocks/ and api/api/config.py
 * Future: See issue #13240 for dynamic limits fetching from server.
 */

// =============================================================================
// IMAGE LIMITS
/** Maximum base64-encoded image size (API enforced). */
export const API_IMAGE_MAX_BASE64_SIZE = 5 * 1024 * 1024 // 5 MB

/** Target raw image size to stay under base64 limit after encoding. */
export const IMAGE_TARGET_RAW_SIZE = (API_IMAGE_MAX_BASE64_SIZE * 3) / 4 // 3.75 MB

/** Client-side maximum dimensions for image resizing. */
export const IMAGE_MAX_WIDTH = 2000
export const IMAGE_MAX_HEIGHT = 2000

// PDF LIMITS
/** Maximum raw PDF file size that fits within the API request limit after encoding. */
export const PDF_TARGET_RAW_SIZE = 20 * 1024 * 1024 // 20 MB

/** Maximum number of pages in a PDF accepted by the API. */
export const API_PDF_MAX_PAGES = 100

/** Size threshold above which PDFs are extracted into page images instead of being sent as base64 document blocks. */
export const PDF_EXTRACT_SIZE_THRESHOLD = 3 * 1024 * 1024 // 3 MB

/** Maximum PDF file size for the page extraction path. */
export const PDF_MAX_EXTRACT_SIZE = 100 * 1024 * 1024 // 100 MB

/** Max pages the Read tool will extract in a single call with the pages parameter. */
export const PDF_MAX_PAGES_PER_READ = 20

/** PDFs with more pages than this get the reference treatment on @ mention instead of being inlined into context. */
export const PDF_AT_MENTION_INLINE_THRESHOLD = 10

// MEDIA LIMITS
/** Maximum number of media items (images + PDFs) allowed per API request. */
export const API_MAX_MEDIA_PER_REQUEST = 100
