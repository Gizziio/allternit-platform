// Pure-helper tests for scripts/render-artifact-screenshot.mjs.
// Deliberately does NOT launch a browser — the live render path is verified
// manually (fixture HTML -> real PNG via the machine's Chrome); see the script
// header and the session ledger for that evidence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  parseArgs,
  resolveOutputPath,
  chromeCandidates,
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  DEFAULT_WAIT_MS,
} from './render-artifact-screenshot.mjs';

const CWD = '/tmp/fake-cwd';

test('parseArgs: defaults', () => {
  const opts = parseArgs([]);
  assert.equal(opts.htmlFile, null);
  assert.equal(opts.out, null);
  assert.equal(opts.width, DEFAULT_WIDTH);
  assert.equal(opts.height, DEFAULT_HEIGHT);
  assert.equal(opts.wait, DEFAULT_WAIT_MS);
  assert.equal(opts.help, false);
});

test('parseArgs: flags and values', () => {
  const opts = parseArgs(['--html-file', 'a.html', '--out', 'b.png', '--width', '1440', '--height', '900', '--wait', '250']);
  assert.equal(opts.htmlFile, 'a.html');
  assert.equal(opts.out, 'b.png');
  assert.equal(opts.width, 1440);
  assert.equal(opts.height, 900);
  assert.equal(opts.wait, 250);
});

test('parseArgs: --flag=value form', () => {
  const opts = parseArgs(['--html-file=deck.html', '--width=1920']);
  assert.equal(opts.htmlFile, 'deck.html');
  assert.equal(opts.width, 1920);
});

test('parseArgs: help', () => {
  assert.equal(parseArgs(['--help']).help, true);
  assert.equal(parseArgs(['-h']).help, true);
});

test('parseArgs: rejects unknown flags, missing values, and bad numbers', () => {
  assert.throws(() => parseArgs(['--nope']), /unknown argument/);
  assert.throws(() => parseArgs(['--out']), /missing value for --out/);
  assert.throws(() => parseArgs(['--width', '0']), /positive integer/);
  assert.throws(() => parseArgs(['--width', 'wide']), /positive integer/);
  assert.throws(() => parseArgs(['--wait', '-5']), /non-negative integer/);
  assert.throws(() => parseArgs(['--height', '1.5']), /positive integer/);
});

test('resolveOutputPath: explicit --out wins and resolves against cwd', () => {
  assert.equal(resolveOutputPath('in.html', 'shots/o.png', CWD), path.join(CWD, 'shots/o.png'));
});

test('resolveOutputPath: defaults to alongside the input, swapping the extension', () => {
  assert.equal(resolveOutputPath('deck.html', null, CWD), path.join(CWD, 'deck.png'));
  assert.equal(resolveOutputPath('/abs/path/page.htm', null, CWD), '/abs/path/page.png');
  assert.equal(resolveOutputPath('noext', null, CWD), path.join(CWD, 'noext.png'));
});

test('resolveOutputPath: stdin default is ./render.png', () => {
  assert.equal(resolveOutputPath(null, null, CWD), path.join(CWD, 'render.png'));
});

test('chromeCandidates: CHROME_PATH override wins', () => {
  assert.deepEqual(chromeCandidates({ CHROME_PATH: '/custom/chrome' }, 'darwin'), ['/custom/chrome']);
});

test('chromeCandidates: macOS well-known installs', () => {
  const c = chromeCandidates({}, 'darwin');
  assert.ok(c.includes('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'));
  assert.equal(c.length, 3);
});

test('chromeCandidates: linux fallbacks', () => {
  const c = chromeCandidates({}, 'linux');
  assert.ok(c.includes('/usr/bin/google-chrome'));
  assert.ok(!c.some((p) => p.includes('.app')));
});
