/**
 * ACP (Agent Client Protocol) Validators
 *
 * Validation utilities for ACP entities.
 * Uses lightweight validation compatible with official ACP types.
 */
// ============================================================================
// Type Guards
// ============================================================================
export function isSessionId(value) {
    return typeof value === 'string' && value.length > 0;
}
export function isContent(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const c = value;
    return typeof c.type === 'string' &&
        ['text', 'image', 'audio', 'resource', 'embeddedResource'].includes(c.type);
}
export function isToolCall(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const t = value;
    return typeof t.toolCallId === 'string' && typeof t.title === 'string';
}
// ============================================================================
// Session Validation
// ============================================================================
export function validateACPMessage(value) {
    if (!isContent(value)) {
        return {
            success: false,
            error: 'Invalid ACP message content',
            issues: ['Content must have a valid type (text, image, audio, resource, embeddedResource)'],
        };
    }
    return { success: true, data: value };
}
export function validateACPSession(value) {
    if (typeof value !== 'object' || value === null) {
        return {
            success: false,
            error: 'Session must be an object',
        };
    }
    const s = value;
    const issues = [];
    if (typeof s.id !== 'string')
        issues.push('id must be a string');
    if (typeof s.agentId !== 'string')
        issues.push('agentId must be a string');
    if (!['initializing', 'active', 'paused', 'completed', 'error'].includes(s.status)) {
        issues.push('status must be one of: initializing, active, paused, completed, error');
    }
    if (typeof s.model !== 'object' || s.model === null) {
        issues.push('model must be an object');
    }
    else {
        const m = s.model;
        if (typeof m.provider !== 'string')
            issues.push('model.provider must be a string');
        if (typeof m.model !== 'string')
            issues.push('model.model must be a string');
    }
    if (issues.length > 0) {
        return {
            success: false,
            error: 'Invalid ACP session',
            issues,
        };
    }
    return { success: true, data: value };
}
export function validateACPRegistryEntry(value) {
    if (typeof value !== 'object' || value === null) {
        return {
            success: false,
            error: 'Registry entry must be an object',
        };
    }
    const e = value;
    const issues = [];
    if (typeof e.id !== 'string')
        issues.push('id must be a string');
    if (typeof e.name !== 'string')
        issues.push('name must be a string');
    if (typeof e.version !== 'string')
        issues.push('version must be a string');
    if (typeof e.description !== 'string')
        issues.push('description must be a string');
    if (!Array.isArray(e.capabilities))
        issues.push('capabilities must be an array');
    if (typeof e.auth !== 'object' || e.auth === null) {
        issues.push('auth must be an object');
    }
    if (!Array.isArray(e.models))
        issues.push('models must be an array');
    if (issues.length > 0) {
        return {
            success: false,
            error: 'Invalid ACP registry entry',
            issues,
        };
    }
    return { success: true, data: value };
}
// ============================================================================
// Strict Validation (throws on error)
// ============================================================================
export function assertValidACPMessage(value) {
    const result = validateACPMessage(value);
    if (!result.success) {
        throw new Error(result.error + (result.issues ? ': ' + result.issues.join(', ') : ''));
    }
    return result.data;
}
export function assertValidACPSession(value) {
    const result = validateACPSession(value);
    if (!result.success) {
        throw new Error(result.error + (result.issues ? ': ' + result.issues.join(', ') : ''));
    }
    return result.data;
}
export function assertValidACPRegistryEntry(value) {
    const result = validateACPRegistryEntry(value);
    if (!result.success) {
        throw new Error(result.error + (result.issues ? ': ' + result.issues.join(', ') : ''));
    }
    return result.data;
}
//# sourceMappingURL=validator.js.map