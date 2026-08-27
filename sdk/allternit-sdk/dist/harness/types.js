/**
 * AllternitHarness Types
 * Core type definitions for the harness SDK
 */
/**
 * Normalize a message's content to a plain string for providers that only
 * accept string content. Vision blocks are ignored; text blocks and tool
 * results are concatenated.
 */
export function messageContentToString(content) {
    if (typeof content === 'string')
        return content;
    return content
        .map((block) => {
        if (block.type === 'text')
            return block.text;
        if (block.type === 'tool_result')
            return `[tool_result:${block.tool_use_id}] ${block.content}`;
        if (block.type === 'search_result')
            return `[search_result:${block.title}] ${block.content}`;
        if (block.type === 'vision')
            return '[vision image]';
        if (block.type === 'vision_coordinates')
            return `[vision coordinates ${block.x},${block.y}]`;
        if (block.type === 'pdf')
            return '[pdf document]';
        return '';
    })
        .join('\n');
}
/**
 * Error codes for harness operations
 */
export var HarnessErrorCode;
(function (HarnessErrorCode) {
    HarnessErrorCode["CONFIG_INVALID"] = "CONFIG_INVALID";
    HarnessErrorCode["MODE_UNSUPPORTED"] = "MODE_UNSUPPORTED";
    HarnessErrorCode["PROVIDER_NOT_FOUND"] = "PROVIDER_NOT_FOUND";
    HarnessErrorCode["API_ERROR"] = "API_ERROR";
    HarnessErrorCode["RATE_LIMITED"] = "RATE_LIMITED";
    HarnessErrorCode["TIMEOUT"] = "TIMEOUT";
    HarnessErrorCode["STREAM_ERROR"] = "STREAM_ERROR";
    HarnessErrorCode["AUTHENTICATION_ERROR"] = "AUTHENTICATION_ERROR";
    HarnessErrorCode["NETWORK_ERROR"] = "NETWORK_ERROR";
    HarnessErrorCode["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
})(HarnessErrorCode || (HarnessErrorCode = {}));
/**
 * Harness-specific error class
 */
export class HarnessError extends Error {
    code;
    cause;
    constructor(code, message, cause) {
        super(message);
        this.name = 'HarnessError';
        this.code = code;
        this.cause = cause;
    }
}
