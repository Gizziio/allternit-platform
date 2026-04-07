/**
 * CLI error handling utilities
 */

import { Box, Text } from 'ink'
import React from 'react'

export class GizziCLIError extends Error {
  code: string
  exitCode: number
  
  constructor(message: string, code: string, exitCode = 1) {
    super(message)
    this.name = 'GizziCLIError'
    this.code = code
    this.exitCode = exitCode
  }
}

export class UserError extends GizziCLIError {
  constructor(message: string) {
    super(message, 'USER_ERROR', 1)
    this.name = 'UserError'
  }
}

export class ConfigError extends GizziCLIError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR', 2)
    this.name = 'ConfigError'
  }
}

export class NetworkError extends GizziCLIError {
  constructor(message: string) {
    super(message, 'NETWORK_ERROR', 3)
    this.name = 'NetworkError'
  }
}

export class AuthError extends GizziCLIError {
  constructor(message: string) {
    super(message, 'AUTH_ERROR', 4)
    this.name = 'AuthError'
  }
}

export class PermissionError extends GizziCLIError {
  constructor(message: string) {
    super(message, 'PERMISSION_ERROR', 5)
    this.name = 'PermissionError'
  }
}

export class ToolError extends GizziCLIError {
  constructor(message: string) {
    super(message, 'TOOL_ERROR', 6)
    this.name = 'ToolError'
  }
}

export function isCLIError(error: unknown): error is GizziCLIError {
  return error instanceof GizziCLIError
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

export function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error
  }
  return new Error(String(error))
}

export function getErrorCode(error: unknown): string {
  if (isCLIError(error)) {
    return error.code
  }
  return 'UNKNOWN_ERROR'
}

export function getExitCode(error: unknown): number {
  if (isCLIError(error)) {
    return error.exitCode
  }
  return 1
}

export function handleError(error: unknown): never {
  const message = getErrorMessage(error)
  const code = getErrorCode(error)
  const exitCode = getExitCode(error)
  
  console.error(`Error [${code}]: ${message}`)
  
  if (process.env.DEBUG) {
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:')
      console.error(error.stack)
    }
  }
  
  process.exit(exitCode)
}

// Error display component for Ink
export function ErrorDisplay({ error }: { error: Error | string }): React.ReactElement {
  const message = typeof error === 'string' ? error : error.message
  const stack = typeof error === 'string' ? null : error.stack
  
  return (
    <Box flexDirection="column" padding={1}>
      <Text color="red" bold>Error</Text>
      <Text color="red">{message}</Text>
      {stack && process.env.DEBUG && (
        <Text color="gray" dimColor>{stack}</Text>
      )}
    </Box>
  )
}

// Error boundary for CLI commands
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  errorHandler?: (error: unknown) => void
): Promise<T | undefined> {
  try {
    return await fn()
  } catch (error) {
    if (errorHandler) {
      errorHandler(error)
    } else {
      handleError(error)
    }
    return undefined
  }
}

// Validation helpers
export function assertDefined<T>(value: T | undefined | null, name: string): asserts value is T {
  if (value === undefined || value === null) {
    throw new UserError(`${name} is required`)
  }
}

export function assertString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new UserError(`${name} must be a string`)
  }
}

export function assertNumber(value: unknown, name: string): asserts value is number {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new UserError(`${name} must be a number`)
  }
}

export function assertArray<T>(value: unknown, name: string): asserts value is T[] {
  if (!Array.isArray(value)) {
    throw new UserError(`${name} must be an array`)
  }
}

// Wrap async functions with error handling
export function wrapAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  errorMessage?: string
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  return async (...args) => {
    try {
      return await fn(...args)
    } catch (error) {
      if (error instanceof GizziCLIError) {
        throw error
      }
      throw new GizziCLIError(
        errorMessage || getErrorMessage(error),
        'WRAPPED_ERROR'
      )
    }
  }
}

// Default export
export default {
  GizziCLIError,
  UserError,
  ConfigError,
  NetworkError,
  AuthError,
  PermissionError,
  ToolError,
  isCLIError,
  getErrorMessage,
  getErrorCode,
  getExitCode,
  handleError,
  ErrorDisplay,
  withErrorHandling,
  assertDefined,
  assertString,
  assertNumber,
  assertArray,
  wrapAsync,
}
