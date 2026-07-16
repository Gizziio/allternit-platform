/**
 * Minimal vitest-compatible test shim (describe/it/expect/afterEach) so the
 * repository's vitest suites run under plain Node while full vitest runs are
 * not authorized in this workspace. Implements only the matchers the suites
 * use; unknown matchers fail loudly rather than silently passing.
 */

const state = {
  stack: [], // describe contexts: { name, afterEach: [] }
  queue: [], // pending tests: { path, fn, hooks }
  pass: 0,
  fail: 0,
  failures: [], // { test, error }
  current: '',
};

export function resetShim() {
  // Root context: allows top-level afterEach (used for temp-dir cleanup).
  state.stack = [{ name: '', afterEach: [] }];
  state.queue = [];
  state.pass = 0;
  state.fail = 0;
  state.failures = [];
}

export function shimResults() {
  return { pass: state.pass, fail: state.fail, failures: state.failures };
}

export function describe(name, fn) {
  state.stack.push({ name, afterEach: [] });
  try {
    fn();
  } finally {
    state.stack.pop();
  }
}

export function afterEach(fn) {
  const ctx = state.stack[state.stack.length - 1];
  if (!ctx) throw new Error('afterEach outside describe');
  ctx.afterEach.push(fn);
}

export function it(name, fn) {
  const testPath = [...state.stack.map((c) => c.name).filter(Boolean), name].join(' › ');
  const hooks = state.stack.flatMap((c) => c.afterEach);
  state.queue.push({ path: testPath, fn, hooks });
}

/** Run every queued test sequentially, awaiting async bodies and hooks. */
export async function drainQueue() {
  const pending = state.queue.splice(0);
  for (const test of pending) {
    state.current = test.path;
    let error = null;
    try {
      await test.fn();
    } catch (caught) {
      error = caught;
    }
    // afterEach hooks run regardless of test outcome (vitest semantics).
    for (const hook of [...test.hooks].reverse()) {
      try {
        await hook();
      } catch (caught) {
        error = error || caught;
      }
    }
    if (error) {
      state.fail += 1;
      state.failures.push({ test: test.path, error });
      console.error(`FAIL ${test.path}\n  ${error && error.message ? error.message : error}`);
    } else {
      state.pass += 1;
    }
  }
}

const isObject = (v) => v !== null && typeof v === 'object';

function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }
  if (isObject(a) && isObject(b)) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => k in b && deepEqual(a[k], b[k]));
  }
  return false;
}

/** Subset match: every key in `subset` deep-equals a key in `actual`. */
function matchObject(actual, subset) {
  if (!isObject(actual) || !isObject(subset)) return false;
  return Object.entries(subset).every(([key, value]) =>
    isObject(value) && isObject(actual[key]) && !Array.isArray(value)
      ? matchObject(actual[key], value)
      : deepEqual(actual[key], value),
  );
}

function show(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function makeExpect(actual, negated, path) {
  const assert = (condition, message) => {
    const ok = negated ? !condition : condition;
    if (!ok) throw new Error(`expect${negated ? '.not' : ''}: ${message}`);
  };
  const matchers = {
    get not() {
      return makeExpect(actual, !negated, path);
    },
    toBe(expected) {
      assert(Object.is(actual, expected), `expected ${show(actual)} to be ${show(expected)}`);
    },
    toEqual(expected) {
      assert(deepEqual(actual, expected), `expected ${show(actual)} to equal ${show(expected)}`);
    },
    toStrictEqual(expected) {
      assert(deepEqual(actual, expected), `expected ${show(actual)} to strictly equal ${show(expected)}`);
    },
    toContain(expected) {
      assert(
        (typeof actual === 'string' && actual.includes(expected)) ||
          (Array.isArray(actual) && actual.some((item) => deepEqual(item, expected))),
        `expected ${show(actual)} to contain ${show(expected)}`,
      );
    },
    toContainEqual(expected) {
      assert(
        Array.isArray(actual) && actual.some((item) => deepEqual(item, expected)),
        `expected ${show(actual)} to contain element deep-equal to ${show(expected)}`,
      );
    },
    toMatch(pattern) {
      const re = pattern instanceof RegExp ? pattern : new RegExp(pattern);
      assert(typeof actual === 'string' && re.test(actual), `expected ${show(actual)} to match ${re}`);
    },
    toMatchObject(subset) {
      assert(matchObject(actual, subset), `expected ${show(actual)} to match object ${show(subset)}`);
    },
    toBeNull() {
      assert(actual === null, `expected ${show(actual)} to be null`);
    },
    toBeUndefined() {
      assert(actual === undefined, `expected ${show(actual)} to be undefined`);
    },
    toBeDefined() {
      assert(actual !== undefined, `expected value to be defined`);
    },
    toBeTruthy() {
      assert(Boolean(actual), `expected ${show(actual)} to be truthy`);
    },
    toBeFalsy() {
      assert(!actual, `expected ${show(actual)} to be falsy`);
    },
    toHaveLength(length) {
      assert(actual != null && actual.length === length, `expected length ${length}, got ${actual && actual.length}`);
    },
    toBeGreaterThan(n) {
      assert(actual > n, `expected ${show(actual)} > ${n}`);
    },
    toBeGreaterThanOrEqual(n) {
      assert(actual >= n, `expected ${show(actual)} >= ${n}`);
    },
    toBeLessThan(n) {
      assert(actual < n, `expected ${show(actual)} < ${n}`);
    },
    toThrow(pattern) {
      if (typeof actual !== 'function') throw new Error('toThrow requires a function');
      let threw = null;
      try {
        actual();
      } catch (error) {
        threw = error;
      }
      if (pattern === undefined) {
        assert(threw !== null, 'expected function to throw');
      } else if (typeof pattern === 'string') {
        assert(threw !== null && String(threw.message || threw).includes(pattern), `expected throw containing "${pattern}", got ${threw && threw.message}`);
      } else {
        assert(threw !== null && pattern.test(String(threw.message || threw)), `expected throw matching ${pattern}, got ${threw && threw.message}`);
      }
    },
  };
  return new Proxy(matchers, {
    get(target, prop) {
      if (prop in target) return target[prop];
      throw new Error(`vitest-shim: unsupported matcher .${String(prop)} — extend the shim in scripts/marketplace-verify/vitest-shim.mjs`);
    },
  });
}

export function expect(actual) {
  return makeExpect(actual, false, state.current);
}
