"""
Error handling and normalization for Allternit Computer Use Gateway.

Maps Playwright and Python exceptions to standardized error codes.
"""

from __future__ import annotations

from typing import Optional
from pydantic import BaseModel


class ErrorDetail(BaseModel):
    """Standardized error detail."""
    code: str
    message: str


# Error code registry
class ErrorCodes:
    # Validation errors (4xx)
    MISSING_ACTION = "MISSING_ACTION"
    MISSING_SESSION_ID = "MISSING_SESSION_ID"
    MISSING_RUN_ID = "MISSING_RUN_ID"
    INVALID_ACTION = "INVALID_ACTION"
    MISSING_TARGET = "MISSING_TARGET"
    MISSING_GOAL = "MISSING_GOAL"
    MISSING_TEXT = "MISSING_TEXT"
    INVALID_SELECTOR = "INVALID_SELECTOR"
    INVALID_URL = "INVALID_URL"
    
    # Session errors
    SESSION_NOT_FOUND = "SESSION_NOT_FOUND"
    SESSION_EXPIRED = "SESSION_EXPIRED"
    SESSION_LIMIT_REACHED = "SESSION_LIMIT_REACHED"
    SESSION_CREATE_FAILED = "SESSION_CREATE_FAILED"
    PAGE_CLOSED = "PAGE_CLOSED"
    
    # Navigation errors
    NAVIGATION_ERROR = "NAVIGATION_ERROR"
    NAVIGATION_TIMEOUT = "NAVIGATION_TIMEOUT"
    DNS_ERROR = "DNS_ERROR"
    CONNECTION_ERROR = "CONNECTION_ERROR"
    SSL_ERROR = "SSL_ERROR"
    HTTP_ERROR = "HTTP_ERROR"
    ABORTED_NAVIGATION = "ABORTED_NAVIGATION"
    
    # Selector errors
    SELECTOR_NOT_FOUND = "SELECTOR_NOT_FOUND"
    SELECTOR_INVALID = "SELECTOR_INVALID"
    SELECTOR_AMBIGUOUS = "SELECTOR_AMBIGUOUS"
    ELEMENT_NOT_VISIBLE = "ELEMENT_NOT_VISIBLE"
    ELEMENT_NOT_INTERACTABLE = "ELEMENT_NOT_INTERACTABLE"
    
    # Action errors
    CLICK_ERROR = "CLICK_ERROR"
    FILL_ERROR = "FILL_ERROR"
    SCREENSHOT_ERROR = "SCREENSHOT_ERROR"
    EXTRACT_ERROR = "EXTRACT_ERROR"
    INSPECT_ERROR = "INSPECT_ERROR"
    DOWNLOAD_ERROR = "DOWNLOAD_ERROR"
    UPLOAD_ERROR = "UPLOAD_ERROR"
    
    # Timeout errors
    TIMEOUT = "TIMEOUT"
    
    # Adapter errors
    ADAPTER_ERROR = "ADAPTER_ERROR"
    ADAPTER_NOT_FOUND = "ADAPTER_NOT_FOUND"
    ADAPTER_INIT_FAILED = "ADAPTER_INIT_FAILED"
    BROWSER_CRASHED = "BROWSER_CRASHED"
    BROWSER_DISCONNECTED = "BROWSER_DISCONNECTED"
    
    # Resource errors
    MEMORY_EXCEEDED = "MEMORY_EXCEEDED"
    DISK_FULL = "DISK_FULL"
    ARTIFACT_TOO_LARGE = "ARTIFACT_TOO_LARGE"


def map_playwright_error(error: Exception, action: str = "") -> ErrorDetail:
    """
    Map Playwright exception to standardized error.
    
    Args:
        error: The Playwright exception
        action: The action being performed (for context)
        
    Returns:
        Standardized ErrorDetail
    """
    message = str(error)
    
    # DNS errors
    if "ERR_NAME_NOT_RESOLVED" in message:
        return ErrorDetail(
            code=ErrorCodes.DNS_ERROR,
            message=f"Could not resolve hostname: {message}"
        )
    
    # Connection errors
    if "ERR_CONNECTION_REFUSED" in message:
        return ErrorDetail(
            code=ErrorCodes.CONNECTION_ERROR,
            message=f"Connection refused: {message}"
        )
    if "ERR_CONNECTION_RESET" in message:
        return ErrorDetail(
            code=ErrorCodes.CONNECTION_ERROR,
            message=f"Connection reset: {message}"
        )
    if "ERR_CONNECTION_TIMED_OUT" in message:
        return ErrorDetail(
            code=ErrorCodes.CONNECTION_ERROR,
            message=f"Connection timed out: {message}"
        )
    
    # SSL errors
    if "ERR_SSL_PROTOCOL_ERROR" in message:
        return ErrorDetail(
            code=ErrorCodes.SSL_ERROR,
            message=f"SSL/TLS error: {message}"
        )
    if "ERR_CERT_AUTHORITY_INVALID" in message:
        return ErrorDetail(
            code=ErrorCodes.SSL_ERROR,
            message=f"Certificate error: {message}"
        )
    
    # HTTP errors
    if "ERR_ABORTED" in message:
        return ErrorDetail(
            code=ErrorCodes.ABORTED_NAVIGATION,
            message=f"Navigation was aborted: {message}"
        )
    if "ERR_HTTP_RESPONSE_CODE_FAILURE" in message:
        return ErrorDetail(
            code=ErrorCodes.HTTP_ERROR,
            message=f"HTTP error response: {message}"
        )
    
    # Timeout errors
    if "Timeout" in message or "timeout" in message:
        if action == "goto":
            return ErrorDetail(
                code=ErrorCodes.NAVIGATION_TIMEOUT,
                message=f"Navigation timed out: {message}"
            )
        elif action in ["click", "fill"]:
            return ErrorDetail(
                code=ErrorCodes.SELECTOR_NOT_FOUND,
                message=f"Element not found (timeout): {message}"
            )
        else:
            return ErrorDetail(
                code=ErrorCodes.TIMEOUT,
                message=f"Action timed out: {message}"
            )
    
    # Browser disconnection
    if "Target closed" in message or "Browser has been closed" in message:
        return ErrorDetail(
            code=ErrorCodes.BROWSER_DISCONNECTED,
            message=f"Browser connection lost: {message}"
        )
    
    # Element not found
    if "Could not find element" in message or "waiting for selector" in message:
        return ErrorDetail(
            code=ErrorCodes.SELECTOR_NOT_FOUND,
            message=f"Element not found: {message}"
        )
    
    # Element not interactable
    if "Element is not attached to the DOM" in message:
        return ErrorDetail(
            code=ErrorCodes.ELEMENT_NOT_INTERACTABLE,
            message=f"Element no longer in DOM: {message}"
        )
    if "element is not visible" in message.lower():
        return ErrorDetail(
            code=ErrorCodes.ELEMENT_NOT_VISIBLE,
            message=f"Element not visible: {message}"
        )
    
    # Screenshot errors
    if "screenshot" in message.lower():
        return ErrorDetail(
            code=ErrorCodes.SCREENSHOT_ERROR,
            message=f"Screenshot failed: {message}"
        )
    
    # Navigation errors (generic)
    if "goto" in message.lower() or "navigation" in message.lower():
        return ErrorDetail(
            code=ErrorCodes.NAVIGATION_ERROR,
            message=f"Navigation failed: {message}"
        )
    
    # Session errors
    if "Session" in message and "not found" in message:
        return ErrorDetail(
            code=ErrorCodes.SESSION_NOT_FOUND,
            message=message
        )
    
    # Default to adapter error
    return ErrorDetail(
        code=ErrorCodes.ADAPTER_ERROR,
        message=f"Browser automation error: {message}"
    )


def map_python_error(error: Exception) -> ErrorDetail:
    """
    Map Python exception to standardized error.
    
    Args:
        error: The Python exception
        
    Returns:
        Standardized ErrorDetail
    """
    error_type = type(error).__name__
    message = str(error)
    
    # Timeout
    if "Timeout" in error_type or "timeout" in message.lower():
        return ErrorDetail(
            code=ErrorCodes.TIMEOUT,
            message=f"Operation timed out: {message}"
        )
    
    # Memory
    if "MemoryError" in error_type or "memory" in message.lower():
        return ErrorDetail(
            code=ErrorCodes.MEMORY_EXCEEDED,
            message=f"Memory limit exceeded: {message}"
        )
    
    # Disk
    if "OSError" in error_type and ("disk" in message.lower() or "space" in message.lower()):
        return ErrorDetail(
            code=ErrorCodes.DISK_FULL,
            message=f"Disk space error: {message}"
        )
    
    # Key/Index errors (usually session not found)
    if error_type in ["KeyError", "IndexError"]:
        return ErrorDetail(
            code=ErrorCodes.SESSION_NOT_FOUND,
            message=f"Session not found: {message}"
        )
    
    # Default
    return ErrorDetail(
        code=ErrorCodes.ADAPTER_ERROR,
        message=f"Internal error ({error_type}): {message}"
    )


def is_retryable_error(code: str) -> bool:
    """
    Determine if an error is retryable.
    
    Args:
        code: The error code
        
    Returns:
        True if the error might succeed on retry
    """
    retryable_codes = {
        ErrorCodes.TIMEOUT,
        ErrorCodes.NAVIGATION_TIMEOUT,
        ErrorCodes.BROWSER_DISCONNECTED,
        ErrorCodes.CONNECTION_ERROR,
        ErrorCodes.ADAPTER_ERROR,
    }
    return code in retryable_codes


def get_user_message(code: str, original_message: str) -> str:
    """
    Get user-friendly error message.
    
    Args:
        code: The error code
        original_message: The original technical message
        
    Returns:
        Human-friendly message
    """
    messages = {
        ErrorCodes.DNS_ERROR: "Could not find the website. Check the URL and try again.",
        ErrorCodes.CONNECTION_ERROR: "Could not connect to the website. It may be down or blocking requests.",
        ErrorCodes.SSL_ERROR: "Secure connection failed. The website's certificate may be invalid.",
        ErrorCodes.NAVIGATION_TIMEOUT: "The website took too long to load. Try again or check if the site is slow.",
        ErrorCodes.SELECTOR_NOT_FOUND: "Could not find the element on the page. The page structure may have changed.",
        ErrorCodes.SESSION_NOT_FOUND: "No active browser session. Navigate to a page first.",
        ErrorCodes.TIMEOUT: "The action took too long to complete. Try again with a longer timeout.",
        ErrorCodes.SCREENSHOT_ERROR: "Could not capture screenshot. The page may be in an invalid state.",
        ErrorCodes.BROWSER_DISCONNECTED: "Browser connection lost. Retrying...",
        ErrorCodes.MEMORY_EXCEEDED: "Browser ran out of memory. Try a simpler page or restart.",
    }
    
    return messages.get(code, original_message)
