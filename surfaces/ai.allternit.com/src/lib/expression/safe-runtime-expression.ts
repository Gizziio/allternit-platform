type ExpressionValue =
  | null
  | undefined
  | string
  | number
  | boolean
  | ExpressionValue[]
  | { [key: string]: ExpressionValue };

type ExpressionContext = Record<string, unknown>;

type Token =
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'identifier'; value: string }
  | { type: 'operator'; value: string }
  | { type: 'punctuation'; value: string }
  | { type: 'eof' };

type AstNode =
  | { type: 'literal'; value: ExpressionValue }
  | { type: 'identifier'; name: string }
  | { type: 'member'; object: AstNode; property: AstNode; computed: boolean }
  | { type: 'call'; callee: AstNode; args: AstNode[] }
  | { type: 'unary'; operator: string; argument: AstNode }
  | { type: 'binary'; operator: string; left: AstNode; right: AstNode }
  | { type: 'logical'; operator: string; left: AstNode; right: AstNode }
  | { type: 'conditional'; test: AstNode; consequent: AstNode; alternate: AstNode };

const MULTI_CHAR_OPERATORS = ['===', '!==', '>=', '<=', '&&', '||', '==', '!='] as const;
const SINGLE_CHAR_OPERATORS = new Set(['+', '-', '*', '/', '%', '>', '<', '!', '?', ':']);
const PUNCTUATION = new Set(['(', ')', '.', ',', '[', ']']);

export function getValueAtPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: unknown, key) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function evaluateRuntimeExpression(
  expression: string,
  context: ExpressionContext,
  functions?: Record<string, (...args: any[]) => unknown>,
): unknown {
  const parser = new Parser(tokenize(expression));
  const ast = parser.parseExpression();
  return evaluateAst(ast, context, functions ?? {});
}

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < expression.length) {
    const current = expression[index];

    if (/\s/.test(current)) {
      index += 1;
      continue;
    }

    const multiCharOperator = MULTI_CHAR_OPERATORS.find((operator) =>
      expression.startsWith(operator, index),
    );
    if (multiCharOperator) {
      tokens.push({ type: 'operator', value: multiCharOperator });
      index += multiCharOperator.length;
      continue;
    }

    if (SINGLE_CHAR_OPERATORS.has(current)) {
      tokens.push({ type: 'operator', value: current });
      index += 1;
      continue;
    }

    if (PUNCTUATION.has(current)) {
      tokens.push({ type: 'punctuation', value: current });
      index += 1;
      continue;
    }

    if (current === '"' || current === "'") {
      const quote = current;
      index += 1;
      let value = '';

      while (index < expression.length) {
        const char = expression[index];
        if (char === '\\') {
          const next = expression[index + 1];
          if (next === undefined) {
            throw new Error('Unterminated string literal');
          }
          value += decodeEscape(next);
          index += 2;
          continue;
        }
        if (char === quote) {
          index += 1;
          break;
        }
        value += char;
        index += 1;
      }

      tokens.push({ type: 'string', value });
      continue;
    }

    if (/[0-9]/.test(current) || (current === '.' && /[0-9]/.test(expression[index + 1] ?? ''))) {
      const start = index;
      index += 1;
      while (index < expression.length && /[0-9._]/.test(expression[index])) {
        index += 1;
      }
      const rawValue = expression.slice(start, index).replace(/_/g, '');
      const parsed = Number(rawValue);
      if (!Number.isFinite(parsed)) {
        throw new Error(`Invalid number literal: ${rawValue}`);
      }
      tokens.push({ type: 'number', value: parsed });
      continue;
    }

    if (/[A-Za-z_$]/.test(current)) {
      const start = index;
      index += 1;
      while (index < expression.length && /[A-Za-z0-9_$]/.test(expression[index])) {
        index += 1;
      }
      tokens.push({ type: 'identifier', value: expression.slice(start, index) });
      continue;
    }

    throw new Error(`Unsupported token in expression: ${current}`);
  }

  tokens.push({ type: 'eof' });
  return tokens;
}

function decodeEscape(character: string): string {
  switch (character) {
    case 'n':
      return '\n';
    case 'r':
      return '\r';
    case 't':
      return '\t';
    case '"':
      return '"';
    case "'":
      return "'";
    case '\\':
      return '\\';
    default:
      return character;
  }
}

class Parser {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  parseExpression(): AstNode {
    const node = this.parseConditional();
    this.expect('eof');
    return node;
  }

  private parseConditional(): AstNode {
    const test = this.parseLogicalOr();
    if (!this.match('operator', '?')) {
      return test;
    }
    const consequent = this.parseLogicalOr();
    this.expect('operator', ':');
    const alternate = this.parseLogicalOr();
    return { type: 'conditional', test, consequent, alternate };
  }

  private parseLogicalOr(): AstNode {
    let node = this.parseLogicalAnd();
    while (this.match('operator', '||')) {
      node = { type: 'logical', operator: '||', left: node, right: this.parseLogicalAnd() };
    }
    return node;
  }

  private parseLogicalAnd(): AstNode {
    let node = this.parseEquality();
    while (this.match('operator', '&&')) {
      node = { type: 'logical', operator: '&&', left: node, right: this.parseEquality() };
    }
    return node;
  }

  private parseEquality(): AstNode {
    let node = this.parseComparison();
    while (this.peekOperator('==') || this.peekOperator('!=') || this.peekOperator('===') || this.peekOperator('!==')) {
      const operator = (this.advance() as Extract<Token, { type: 'operator' }>).value;
      node = { type: 'binary', operator, left: node, right: this.parseComparison() };
    }
    return node;
  }

  private parseComparison(): AstNode {
    let node = this.parseAdditive();
    while (this.peekOperator('>') || this.peekOperator('<') || this.peekOperator('>=') || this.peekOperator('<=')) {
      const operator = (this.advance() as Extract<Token, { type: 'operator' }>).value;
      node = { type: 'binary', operator, left: node, right: this.parseAdditive() };
    }
    return node;
  }

  private parseAdditive(): AstNode {
    let node = this.parseMultiplicative();
    while (this.peekOperator('+') || this.peekOperator('-')) {
      const operator = (this.advance() as Extract<Token, { type: 'operator' }>).value;
      node = { type: 'binary', operator, left: node, right: this.parseMultiplicative() };
    }
    return node;
  }

  private parseMultiplicative(): AstNode {
    let node = this.parseUnary();
    while (this.peekOperator('*') || this.peekOperator('/') || this.peekOperator('%')) {
      const operator = (this.advance() as Extract<Token, { type: 'operator' }>).value;
      node = { type: 'binary', operator, left: node, right: this.parseUnary() };
    }
    return node;
  }

  private parseUnary(): AstNode {
    if (this.peekOperator('!') || this.peekOperator('-') || this.peekOperator('+')) {
      const operator = (this.advance() as Extract<Token, { type: 'operator' }>).value;
      return { type: 'unary', operator, argument: this.parseUnary() };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): AstNode {
    let node = this.parsePrimary();

    while (true) {
      if (this.match('punctuation', '.')) {
        const identifier = this.expect('identifier') as Extract<Token, { type: 'identifier' }>;
        node = {
          type: 'member',
          object: node,
          property: { type: 'literal', value: identifier.value },
          computed: false,
        };
        continue;
      }

      if (this.match('punctuation', '[')) {
        const property = this.parseLogicalOr();
        this.expect('punctuation', ']');
        node = { type: 'member', object: node, property, computed: true };
        continue;
      }

      if (this.match('punctuation', '(')) {
        const args: AstNode[] = [];
        if (!this.match('punctuation', ')')) {
          do {
            args.push(this.parseLogicalOr());
          } while (this.match('punctuation', ','));
          this.expect('punctuation', ')');
        }
        node = { type: 'call', callee: node, args };
        continue;
      }

      break;
    }

    return node;
  }

  private parsePrimary(): AstNode {
    const token = this.advance();

    if (token.type === 'number' || token.type === 'string') {
      return { type: 'literal', value: token.value };
    }

    if (token.type === 'identifier') {
      if (token.value === 'true') return { type: 'literal', value: true };
      if (token.value === 'false') return { type: 'literal', value: false };
      if (token.value === 'null') return { type: 'literal', value: null };
      if (token.value === 'undefined') return { type: 'literal', value: undefined };
      return { type: 'identifier', name: token.value };
    }

    if (token.type === 'punctuation' && token.value === '(') {
      const expr = this.parseLogicalOr();
      this.expect('punctuation', ')');
      return expr;
    }

    throw new Error(`Unexpected token in expression: ${JSON.stringify(token)}`);
  }

  private peekOperator(operator: string): boolean {
    const token = this.tokens[this.index];
    return token.type === 'operator' && token.value === operator;
  }

  private match(type: Token['type'], value?: string): boolean {
    const token = this.tokens[this.index];
    if (token.type !== type) {
      return false;
    }
    if (value !== undefined && 'value' in token && token.value !== value) {
      return false;
    }
    this.index += 1;
    return true;
  }

  private expect(type: Token['type'], value?: string): Token {
    const token = this.tokens[this.index];
    if (token.type !== type || (value !== undefined && (!('value' in token) || token.value !== value))) {
      throw new Error(`Expected ${value ?? type}, received ${JSON.stringify(token)}`);
    }
    this.index += 1;
    return token;
  }

  private advance(): Token {
    const token = this.tokens[this.index];
    this.index += 1;
    return token;
  }
}

function evaluateAst(
  node: AstNode,
  context: ExpressionContext,
  functions: Record<string, (...args: any[]) => unknown>,
): unknown {
  switch (node.type) {
    case 'literal':
      return node.value;
    case 'identifier':
      if (node.name in context) {
        return context[node.name];
      }
      if (node.name in functions) {
        return functions[node.name];
      }
      return undefined;
    case 'member': {
      const object = evaluateAst(node.object, context, functions);
      if (object === null || object === undefined) {
        return undefined;
      }
      const property = node.computed
        ? evaluateAst(node.property, context, functions)
        : (node.property as { type: 'literal'; value: ExpressionValue }).value;
      if (typeof property !== 'string' && typeof property !== 'number') {
        return undefined;
      }
      return (object as Record<string | number, unknown>)[property];
    }
    case 'call': {
      const callee = evaluateAst(node.callee, context, functions);
      if (typeof callee !== 'function') {
        throw new Error('Expression attempted to call a non-function value');
      }
      const args = node.args.map((arg) => evaluateAst(arg, context, functions));
      if (node.callee.type === 'member') {
        const thisArg = evaluateAst(node.callee.object, context, functions);
        return callee.apply(thisArg, args);
      }
      return callee(...args);
    }
    case 'unary': {
      const value = evaluateAst(node.argument, context, functions);
      switch (node.operator) {
        case '!':
          return !value;
        case '+':
          return Number(value);
        case '-':
          return -Number(value);
        default:
          throw new Error(`Unsupported unary operator: ${node.operator}`);
      }
    }
    case 'logical': {
      const left = evaluateAst(node.left, context, functions);
      if (node.operator === '&&') {
        return left ? evaluateAst(node.right, context, functions) : left;
      }
      return left ? left : evaluateAst(node.right, context, functions);
    }
    case 'binary': {
      const left = evaluateAst(node.left, context, functions);
      const right = evaluateAst(node.right, context, functions);
      switch (node.operator) {
        case '+':
          return typeof left === 'string' || typeof right === 'string'
            ? `${left ?? ''}${right ?? ''}`
            : Number(left) + Number(right);
        case '-':
          return Number(left) - Number(right);
        case '*':
          return Number(left) * Number(right);
        case '/':
          return Number(left) / Number(right);
        case '%':
          return Number(left) % Number(right);
        case '>':
          return (left as number | string) > (right as number | string);
        case '<':
          return (left as number | string) < (right as number | string);
        case '>=':
          return (left as number | string) >= (right as number | string);
        case '<=':
          return (left as number | string) <= (right as number | string);
        case '==':
          return left == right;
        case '!=':
          return left != right;
        case '===':
          return left === right;
        case '!==':
          return left !== right;
        default:
          throw new Error(`Unsupported binary operator: ${node.operator}`);
      }
    }
    case 'conditional':
      return evaluateAst(node.test, context, functions)
        ? evaluateAst(node.consequent, context, functions)
        : evaluateAst(node.alternate, context, functions);
  }
}
