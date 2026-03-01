// Mock implementation of js-tiktoken for tests
export function getEncoding(_encoding: string) {
  return {
    encode: (text: string) => new Array(Math.ceil(text.length / 4)), // ~4 chars per token
  };
}
