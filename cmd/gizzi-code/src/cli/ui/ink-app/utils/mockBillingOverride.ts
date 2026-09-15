// Separate tiny module to hold mock billing override state.
// Kept apart from billing.ts so mockRateLimits.ts can set it without creating
// a circular import (billing -> auth -> mockRateLimits -> billing).

let mockBillingAccessOverride: boolean | null = null

export function setMockBillingAccessOverride(value: boolean | null): void {
  mockBillingAccessOverride = value
}

export function getMockBillingAccessOverride(): boolean | null {
  return mockBillingAccessOverride
}
