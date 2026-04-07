/**
 * Error Handling Utilities for Cowork Mode
 * 
 * Provides:
 * - User-friendly error messages
 * - Error recovery suggestions
 * - Graceful degradation
 * - Error logging
 */

import { Log } from "@/runtime/util/log"

export type ErrorCategory = 
  | "browser"
  | "viewport"
  | "renderer"
  | "network"
  | "permission"
  | "unknown"

export interface UserFriendlyError {
  category: ErrorCategory
  message: string
  suggestion: string
  canRecover: boolean
  originalError?: Error
}

/**
 * Convert technical errors to user-friendly messages
 */
export function toUserFriendlyError(error: unknown): UserFriendlyError {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    
    // Browser-related errors
    if (message.includes("browser") || message.includes("chrome")) {
      return {
        category: "browser",
        message: "Browser operation failed",
        suggestion: "Make sure Chrome is installed and try again",
        canRecover: true,
        originalError: error,
      }
    }
    
    if (message.includes("launch") || message.includes("start")) {
      return {
        category: "browser",
        message: "Failed to launch browser",
        suggestion: "Press 'o' to try again, or open browser manually",
        canRecover: true,
        originalError: error,
      }
    }
    
    if (message.includes("navigate") || message.includes("url")) {
      return {
        category: "browser",
        message: "Navigation failed",
        suggestion: "Check the URL and try again",
        canRecover: true,
        originalError: error,
      }
    }
    
    if (message.includes("screenshot")) {
      return {
        category: "browser",
        message: "Screenshot failed",
        suggestion: "Make sure browser is open and try again",
        canRecover: true,
        originalError: error,
      }
    }
    
    // Network errors
    if (message.includes("network") || message.includes("fetch") || message.includes("connection")) {
      return {
        category: "network",
        message: "Network error",
        suggestion: "Check your internet connection",
        canRecover: true,
        originalError: error,
      }
    }
    
    // Permission errors
    if (message.includes("permission") || message.includes("denied") || message.includes("access")) {
      return {
        category: "permission",
        message: "Permission denied",
        suggestion: "Check file permissions or run with appropriate access",
        canRecover: false,
        originalError: error,
      }
    }
    
    // Renderer errors
    if (message.includes("render") || message.includes("display")) {
      return {
        category: "renderer",
        message: "Display error",
        suggestion: "Try refreshing or switching to browser view",
        canRecover: true,
        originalError: error,
      }
    }
  }
  
  // Unknown error
  return {
    category: "unknown",
    message: "An unexpected error occurred",
    suggestion: "Try again or restart the application",
    canRecover: true,
    originalError: error instanceof Error ? error : new Error(String(error)),
  }
}

/**
 * Display error in viewport
 */
export function displayErrorInViewport(error: unknown) {
  const friendly = toUserFriendlyError(error)
  
  Log.Default.error("viewport", {
    category: friendly.category,
    message: friendly.message,
    suggestion: friendly.suggestion,
  })
  
  // In full implementation, would update viewport state to show error
  console.error("Viewport error:", friendly)
  
  return friendly
}

/**
 * Attempt to recover from error
 */
export async function attemptRecovery(error: UserFriendlyError): Promise<boolean> {
  switch (error.category) {
    case "browser":
      // Browser service not available
      return false
    
    case "network":
      // Wait and retry
      await new Promise(resolve => setTimeout(resolve, 1000))
      return true
    
    case "renderer":
      // Clear and re-render
      return true
    
    default:
      return false
  }
}

/**
 * Error boundary handler for components
 */
export function handleErrorBoundary(error: unknown, context: string) {
  const friendly = toUserFriendlyError(error)
  
  Log.Default.error(context, {
    error: friendly.message,
    suggestion: friendly.suggestion,
    canRecover: friendly.canRecover,
  })
  
  // Attempt recovery if possible
  if (friendly.canRecover) {
    attemptRecovery(friendly).catch(recoveryError => {
      Log.Default.error("recovery-failed", { recoveryError })
    })
  }
  
  return friendly
}

/**
 * Format error for display
 */
export function formatErrorForDisplay(error: UserFriendlyError): string {
  return `⚠️ ${error.message}\n💡 ${error.suggestion}`
}
