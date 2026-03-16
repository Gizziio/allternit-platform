import { describe, expect, it } from 'vitest';
import {
  CODE_MODE_GREETINGS,
  getNextCodeModeGreeting,
  type StorageLike,
} from './codeModeBrand';

function createStorage(): StorageLike & { values: Map<string, string> } {
  const values = new Map<string, string>();

  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe('codeModeBrand', () => {
  it('contains at least eight A2rchitech-specific greetings', () => {
    expect(CODE_MODE_GREETINGS.length).toBe(8);
    expect(CODE_MODE_GREETINGS.every((greeting) => greeting.title.trim().length > 0)).toBe(true);
    expect(CODE_MODE_GREETINGS.every((greeting) => greeting.helper_locked.trim().length > 0)).toBe(true);
    expect(CODE_MODE_GREETINGS.every((greeting) => greeting.helper_ready.trim().length > 0)).toBe(true);
    expect(new Set(CODE_MODE_GREETINGS.map((greeting) => greeting.title)).size).toBe(
      CODE_MODE_GREETINGS.length,
    );
    expect(new Set(CODE_MODE_GREETINGS.map((greeting) => greeting.emotion)).size).toBe(8);
  });

  it('rotates deterministically across visits and wraps after the final greeting', () => {
    const storage = createStorage();

    const first = getNextCodeModeGreeting(storage);
    const second = getNextCodeModeGreeting(storage);

    expect(first.index).toBe(0);
    expect(second.index).toBe(1);
    expect(second.title).toBe(CODE_MODE_GREETINGS[1].title);
    expect(second.emotion).toBe(CODE_MODE_GREETINGS[1].emotion);

    for (let index = 2; index < CODE_MODE_GREETINGS.length; index += 1) {
      getNextCodeModeGreeting(storage);
    }

    const wrapped = getNextCodeModeGreeting(storage);
    expect(wrapped.index).toBe(0);
    expect(wrapped.title).toBe(CODE_MODE_GREETINGS[0].title);
  });
});
