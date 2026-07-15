import type { Cell } from '../office-io/types';

export type FormulaError = '#REF!' | '#DIV/0!' | '#VALUE!' | '#NAME?' | '#ERROR!' | '#CYCLE!';

export function isFormulaError(value: unknown): value is FormulaError {
  return typeof value === 'string' && ['#REF!', '#DIV/0!', '#VALUE!', '#NAME?', '#ERROR!', '#CYCLE!'].includes(value);
}

type Token =
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'cell'; row: number; col: number }
  | { type: 'range'; top: number; left: number; bottom: number; right: number }
  | { type: 'function'; name: string }
  | { type: 'error'; value: FormulaError }
  | { type: 'op'; value: string }
  | { type: 'paren'; value: '(' | ')' }
  | { type: 'comma' }
  | { type: 'eof' };

function cellRefToCoords(ref: string): { row: number; col: number } {
  const match = ref.match(/^([A-Z]+)(\d+)$/i);
  if (!match) throw new Error('bad ref');
  const letters = match[1].toUpperCase();
  let col = 0;
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return { row: parseInt(match[2], 10) - 1, col: col - 1 };
}

export function coordsToCellRef(row: number, col: number): string {
  let n = col + 1;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return `${letters}${row + 1}`;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '+') { tokens.push({ type: 'op', value: '+' }); i++; continue; }
    if (c === '-') { tokens.push({ type: 'op', value: '-' }); i++; continue; }
    if (c === '*') { tokens.push({ type: 'op', value: '*' }); i++; continue; }
    if (c === '/') { tokens.push({ type: 'op', value: '/' }); i++; continue; }
    if (c === '^') { tokens.push({ type: 'op', value: '^' }); i++; continue; }
    if (c === '(') { tokens.push({ type: 'paren', value: '(' }); i++; continue; }
    if (c === ')') { tokens.push({ type: 'paren', value: ')' }); i++; continue; }
    if (c === ',') { tokens.push({ type: 'comma' }); i++; continue; }
    if (c === ':') { tokens.push({ type: 'op', value: ':' }); i++; continue; }
    if (c === '=') { tokens.push({ type: 'op', value: '=' }); i++; continue; }
    if (c === '&') { tokens.push({ type: 'op', value: '&' }); i++; continue; }
    if (c === '<') {
      if (input[i + 1] === '=') { tokens.push({ type: 'op', value: '<=' }); i += 2; continue; }
      if (input[i + 1] === '>') { tokens.push({ type: 'op', value: '<>' }); i += 2; continue; }
      tokens.push({ type: 'op', value: '<' }); i++; continue;
    }
    if (c === '>') {
      if (input[i + 1] === '=') { tokens.push({ type: 'op', value: '>=' }); i += 2; continue; }
      tokens.push({ type: 'op', value: '>' }); i++; continue;
    }

    if (c === '#') {
      const errorMatch = (['#REF!', '#DIV/0!', '#VALUE!', '#NAME?', '#ERROR!', '#CYCLE!'] as FormulaError[]).find((err) =>
        input.startsWith(err, i)
      );
      if (errorMatch) {
        tokens.push({ type: 'error', value: errorMatch });
        i += errorMatch.length;
        continue;
      }
    }

    if (/\d/.test(c) || (c === '.' && /\d/.test(input[i + 1] || ''))) {
      let end = i;
      while (end < input.length && (/\d/.test(input[end]) || input[end] === '.')) end++;
      const value = parseFloat(input.slice(i, end));
      tokens.push({ type: 'number', value });
      i = end;
      continue;
    }

    if (c === '"' || c === "'") {
      const quote = c;
      let end = i + 1;
      while (end < input.length && input[end] !== quote) end++;
      tokens.push({ type: 'string', value: input.slice(i + 1, end) });
      i = end + 1;
      continue;
    }

    if (/[A-Za-z]/.test(c)) {
      let end = i;
      while (end < input.length && /[A-Za-z0-9_]/.test(input[end])) end++;
      const word = input.slice(i, end);
      const cellMatch = word.match(/^[A-Za-z]+\d+$/);
      if (cellMatch) {
        const coords = cellRefToCoords(word);
        tokens.push({ type: 'cell', ...coords });
      } else {
        tokens.push({ type: 'function', name: word.toUpperCase() });
      }
      i = end;
      continue;
    }

    throw new Error(`Unexpected character: ${c}`);
  }
  tokens.push({ type: 'eof' });
  return tokens;
}

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    return this.tokens[this.pos++];
  }

  private expect(type: Token['type']): Token {
    const token = this.peek();
    if (token.type !== type) throw new Error(`Expected ${type}, got ${token.type}`);
    return this.consume();
  }

  parse(): Node {
    const node = this.parseComparison();
    if (this.peek().type !== 'eof') throw new Error('Unexpected token after expression');
    return node;
  }

  private parseComparison(): Node {
    let node = this.parseExpr();
    while (true) {
      const op = this.peek();
      if (op.type === 'op' && (op.value === '=' || op.value === '<>' || op.value === '<' || op.value === '>' || op.value === '<=' || op.value === '>=')) {
        this.consume();
        node = { type: 'binary', op: op.value, left: node, right: this.parseExpr() };
      } else {
        break;
      }
    }
    return node;
  }

  private parseExpr(): Node {
    let node = this.parseTerm();
    while (true) {
      const op = this.peek();
      if (op.type === 'op' && (op.value === '+' || op.value === '-' || op.value === '&')) {
        this.consume();
        node = { type: 'binary', op: op.value, left: node, right: this.parseTerm() };
      } else {
        break;
      }
    }
    return node;
  }

  private parseTerm(): Node {
    let node = this.parsePower();
    while (true) {
      const op = this.peek();
      if (op.type === 'op' && (op.value === '*' || op.value === '/')) {
        this.consume();
        node = { type: 'binary', op: op.value, left: node, right: this.parsePower() };
      } else {
        break;
      }
    }
    return node;
  }

  private parsePower(): Node {
    let node = this.parseUnary();
    const op = this.peek();
    if (op.type === 'op' && op.value === '^') {
      this.consume();
      node = { type: 'binary', op: '^', left: node, right: this.parsePower() };
    }
    return node;
  }

  private parseUnary(): Node {
    const op = this.peek();
    if (op.type === 'op' && (op.value === '+' || op.value === '-')) {
      this.consume();
      return { type: 'unary', op: op.value, operand: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Node {
    const token = this.peek();
    if (token.type === 'number') {
      this.consume();
      return { type: 'number', value: token.value };
    }
    if (token.type === 'string') {
      this.consume();
      return { type: 'string', value: token.value };
    }
    if (token.type === 'error') {
      this.consume();
      return { type: 'error', value: token.value };
    }
    if (token.type === 'cell') {
      this.consume();
      const next = this.peek();
      if (next.type === 'op' && next.value === ':') {
        this.consume();
        const end = this.expect('cell') as Extract<Token, { type: 'cell' }>;
        return {
          type: 'range',
          top: Math.min(token.row, end.row),
          left: Math.min(token.col, end.col),
          bottom: Math.max(token.row, end.row),
          right: Math.max(token.col, end.col),
        };
      }
      return { type: 'cell', row: token.row, col: token.col };
    }
    if (token.type === 'range') {
      this.consume();
      return { type: 'range', top: token.top, left: token.left, bottom: token.bottom, right: token.right };
    }
    if (token.type === 'paren' && token.value === '(') {
      this.consume();
      const node = this.parseComparison();
      this.expect('paren');
      return node;
    }
    if (token.type === 'function') {
      return this.parseFunction();
    }
    throw new Error(`Unexpected token: ${token.type}`);
  }

  private parseFunction(): Node {
    const name = (this.consume() as Extract<Token, { type: 'function' }>).name;
    this.expect('paren');
    const args: Node[] = [];
    const first = this.peek();
    if (first.type !== 'paren' || first.value !== ')') {
      args.push(this.parseFunctionArg());
      while (this.peek().type === 'comma') {
        this.consume();
        args.push(this.parseFunctionArg());
      }
    }
    this.expect('paren');
    return { type: 'function', name, args };
  }

  private parseFunctionArg(): Node {
    const token = this.peek();
    if (token.type === 'cell') {
      const start = this.consume() as Extract<Token, { type: 'cell' }>;
      const next = this.peek();
      if (next.type === 'op' && next.value === ':') {
        this.consume();
        const end = this.expect('cell') as Extract<Token, { type: 'cell' }>;
        return {
          type: 'range',
          top: Math.min(start.row, end.row),
          left: Math.min(start.col, end.col),
          bottom: Math.max(start.row, end.row),
          right: Math.max(start.col, end.col),
        };
      }
      return { type: 'cell', row: start.row, col: start.col };
    }
    return this.parseComparison();
  }
}

type Node =
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'error'; value: FormulaError }
  | { type: 'cell'; row: number; col: number }
  | { type: 'range'; top: number; left: number; bottom: number; right: number }
  | { type: 'binary'; op: string; left: Node; right: Node }
  | { type: 'unary'; op: string; operand: Node }
  | { type: 'function'; name: string; args: Node[] };

export type EvalValue = number | string | boolean | Date | FormulaError | undefined;

function toNumber(value: EvalValue): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return 0;
    const num = Number(trimmed);
    if (Number.isFinite(num)) return num;
    throw new Error('#VALUE!');
  }
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Date) return value.getTime();
  if (isFormulaError(value)) throw new Error(value);
  return 0;
}

function isBlank(value: EvalValue): boolean {
  return value === undefined || value === null || value === '';
}

function compareValues(left: EvalValue, right: EvalValue, op: string): boolean {
  if (isFormulaError(left)) throw new Error(left);
  if (isFormulaError(right)) throw new Error(right);
  if (op === '=') {
    if (typeof left === 'number' && typeof right === 'number') return left === right;
    if (typeof left === 'string' && typeof right === 'string') return left === right;
    if (typeof left === 'boolean' && typeof right === 'boolean') return left === right;
    return String(left ?? '') === String(right ?? '');
  }
  if (op === '<>') {
    return !compareValues(left, right, '=');
  }
  const a = typeof left === 'number' ? left : toNumber(left);
  const b = typeof right === 'number' ? right : toNumber(right);
  switch (op) {
    case '<': return a < b;
    case '>': return a > b;
    case '<=': return a <= b;
    case '>=': return a >= b;
    default: return false;
  }
}

export function evaluateFormula(
  formula: string,
  getValue: (row: number, col: number) => EvalValue
): EvalValue {
  if (!formula.startsWith('=')) return undefined;
  try {
    const tokens = tokenize(formula.slice(1));
    const parser = new Parser(tokens);
    const ast = parser.parse();
    return evaluateNode(ast, getValue);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isFormulaError(message)) return message;
    return '#ERROR!';
  }
}

function evaluateNode(node: Node, getValue: (row: number, col: number) => EvalValue): EvalValue {
  switch (node.type) {
    case 'number':
      return node.value;
    case 'string':
      return node.value;
    case 'error':
      return node.value;
    case 'cell': {
      const value = getValue(node.row, node.col);
      if (isFormulaError(value)) return value;
      return value;
    }
    case 'range':
      throw new Error('#VALUE!');
    case 'unary': {
      const value = toNumber(evaluateNode(node.operand, getValue));
      return node.op === '-' ? -value : value;
    }
    case 'binary': {
      const left = evaluateNode(node.left, getValue);
      const right = evaluateNode(node.right, getValue);
      if (node.op === '&') {
        return String(left ?? '') + String(right ?? '');
      }
      if (node.op === '=' || node.op === '<>' || node.op === '<' || node.op === '>' || node.op === '<=' || node.op === '>=') {
        return compareValues(left, right, node.op);
      }
      const a = toNumber(left);
      const b = toNumber(right);
      switch (node.op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/':
          if (b === 0) return '#DIV/0!';
          return a / b;
        case '^': return Math.pow(a, b);
        default: return '#ERROR!';
      }
    }
    case 'function':
      return evaluateFunction(node.name, node.args, getValue);
  }
}

function rangeValues(range: { top: number; left: number; bottom: number; right: number }, getValue: (row: number, col: number) => EvalValue): EvalValue[] {
  const values: EvalValue[] = [];
  for (let r = range.top; r <= range.bottom; r++) {
    for (let c = range.left; c <= range.right; c++) {
      values.push(getValue(r, c));
    }
  }
  return values;
}

function evaluateFunction(
  name: string,
  args: Node[],
  getValue: (row: number, col: number) => EvalValue
): EvalValue {
  const resolveArg = (arg: Node): EvalValue => {
    if (arg.type === 'range') {
      return rangeValues(arg, getValue) as unknown as EvalValue;
    }
    return evaluateNode(arg, getValue);
  };

  const flatNumbers = (includeBlank = false): number[] => {
    const nums: number[] = [];
    for (const arg of args) {
      const value = resolveArg(arg);
      if (Array.isArray(value)) {
        for (const v of value) {
          if (isFormulaError(v)) throw new Error(v);
          if (includeBlank || !isBlank(v)) nums.push(toNumber(v));
        }
      } else {
        if (isFormulaError(value)) throw new Error(value);
        if (includeBlank || !isBlank(value)) nums.push(toNumber(value));
      }
    }
    return nums;
  };

  switch (name) {
    case 'SUM': {
      const nums = flatNumbers();
      return nums.reduce((sum, n) => sum + n, 0);
    }
    case 'AVERAGE': {
      const nums = flatNumbers();
      if (nums.length === 0) return '#DIV/0!';
      return nums.reduce((sum, n) => sum + n, 0) / nums.length;
    }
    case 'MIN': {
      const nums = flatNumbers();
      if (nums.length === 0) return 0;
      return Math.min(...nums);
    }
    case 'MAX': {
      const nums = flatNumbers();
      if (nums.length === 0) return 0;
      return Math.max(...nums);
    }
    case 'COUNT': {
      let count = 0;
      for (const arg of args) {
        const value = resolveArg(arg);
        if (Array.isArray(value)) {
          for (const v of value) {
            if (!isBlank(v)) count++;
          }
        } else if (!isBlank(value)) {
          count++;
        }
      }
      return count;
    }
    case 'COUNTA': {
      let count = 0;
      for (const arg of args) {
        const value = resolveArg(arg);
        if (Array.isArray(value)) {
          for (const v of value) {
            if (!isBlank(v)) count++;
          }
        } else if (!isBlank(value)) {
          count++;
        }
      }
      return count;
    }
    case 'IF': {
      if (args.length < 2) return '#VALUE!';
      const condition = evaluateNode(args[0], getValue);
      const truthy = condition !== undefined && condition !== false && condition !== 0 && condition !== '' && !isFormulaError(condition);
      if (truthy) return evaluateNode(args[1], getValue);
      if (args.length >= 3) return evaluateNode(args[2], getValue);
      return false;
    }
    default:
      return '#NAME?';
  }
}

export function evaluateSheetCell(
  cell: Cell | undefined,
  getCell: (row: number, col: number) => Cell | undefined,
  visiting: Set<string>,
  key: string
): EvalValue {
  if (!cell) return undefined;
  if (cell.value !== undefined && cell.formula === undefined) return cell.value;
  if (cell.formula === undefined) return undefined;

  if (visiting.has(key)) return '#CYCLE!';
  visiting.add(key);

  const result = evaluateFormula(cell.formula, (row, col) => {
    const refKey = `${row}:${col}`;
    if (visiting.has(refKey)) return '#CYCLE!';
    const refCell = getCell(row, col);
    if (!refCell) return undefined;
    if (refCell.formula) {
      return evaluateSheetCell(refCell, getCell, visiting, refKey);
    }
    return refCell.value;
  });

  visiting.delete(key);
  return result;
}

export type FormulaShift = { type: 'row' | 'col'; index: number; delta: 1 | -1 };

function applyShiftCell(ref: { row: number; col: number }, shift: FormulaShift): string {
  if (shift.type === 'row') {
    if (shift.delta === -1 && ref.row === shift.index) return '#REF!';
    if (ref.row >= shift.index) return coordsToCellRef(ref.row + shift.delta, ref.col);
  } else {
    if (shift.delta === -1 && ref.col === shift.index) return '#REF!';
    if (ref.col >= shift.index) return coordsToCellRef(ref.row, ref.col + shift.delta);
  }
  return coordsToCellRef(ref.row, ref.col);
}

function applyShiftRange(
  start: { row: number; col: number },
  end: { row: number; col: number },
  shift: FormulaShift
): string {
  let startRow = start.row;
  let startCol = start.col;
  let endRow = end.row;
  let endCol = end.col;

  if (shift.type === 'row') {
    if (shift.delta === 1) {
      if (shift.index <= startRow) {
        startRow++;
        endRow++;
      } else if (shift.index <= endRow) {
        endRow++;
      }
    } else {
      if (startRow <= shift.index && shift.index <= endRow) {
        if (startRow === endRow) return '#REF!';
        endRow--;
      } else if (shift.index < startRow) {
        startRow--;
        endRow--;
      }
    }
  } else {
    if (shift.delta === 1) {
      if (shift.index <= startCol) {
        startCol++;
        endCol++;
      } else if (shift.index <= endCol) {
        endCol++;
      }
    } else {
      if (startCol <= shift.index && shift.index <= endCol) {
        if (startCol === endCol) return '#REF!';
        endCol--;
      } else if (shift.index < startCol) {
        startCol--;
        endCol--;
      }
    }
  }

  return `${coordsToCellRef(startRow, startCol)}:${coordsToCellRef(endRow, endCol)}`;
}

function tokenToString(token: Token): string {
  switch (token.type) {
    case 'number':
      return String(token.value);
    case 'string':
      return `"${token.value}"`;
    case 'function':
      return token.name;
    case 'error':
      return token.value;
    case 'op':
      return token.value;
    case 'paren':
      return token.value;
    case 'comma':
      return ',';
    default:
      return '';
  }
}

export function rewriteFormulaReferences(formula: string, shift: FormulaShift): string {
  if (!formula.startsWith('=')) return formula;
  try {
    const tokens = tokenize(formula.slice(1));
    const parts: string[] = [];
    for (let i = 0; i < tokens.length - 1; i++) {
      const token = tokens[i];
      const next = tokens[i + 1];
      const afterNext = tokens[i + 2];
      if (
        token.type === 'cell' &&
        next.type === 'op' &&
        next.value === ':' &&
        afterNext?.type === 'cell'
      ) {
        parts.push(applyShiftRange(token, afterNext, shift));
        i += 2;
        continue;
      }
      if (token.type === 'cell') {
        parts.push(applyShiftCell(token, shift));
        continue;
      }
      parts.push(tokenToString(token));
    }
    return '=' + parts.join('');
  } catch {
    return formula;
  }
}

export function offsetFormulaReferences(formula: string, rowDelta: number, colDelta: number): string {
  if (!formula.startsWith('=')) return formula;
  try {
    const tokens = tokenize(formula.slice(1));
    const parts: string[] = [];
    for (let i = 0; i < tokens.length - 1; i++) {
      const token = tokens[i];
      const next = tokens[i + 1];
      const afterNext = tokens[i + 2];
      if (
        token.type === 'cell' &&
        next.type === 'op' &&
        next.value === ':' &&
        afterNext?.type === 'cell'
      ) {
        const start = {
          row: Math.max(0, token.row + rowDelta),
          col: Math.max(0, token.col + colDelta),
        };
        const end = {
          row: Math.max(0, afterNext.row + rowDelta),
          col: Math.max(0, afterNext.col + colDelta),
        };
        parts.push(`${coordsToCellRef(start.row, start.col)}:${coordsToCellRef(end.row, end.col)}`);
        i += 2;
        continue;
      }
      if (token.type === 'cell') {
        const ref = {
          row: Math.max(0, token.row + rowDelta),
          col: Math.max(0, token.col + colDelta),
        };
        parts.push(coordsToCellRef(ref.row, ref.col));
        continue;
      }
      parts.push(tokenToString(token));
    }
    return '=' + parts.join('');
  } catch {
    return formula;
  }
}
