// Type declarations for tree-sitter modules

declare module 'tree-sitter' {
  export interface Point {
    row: number;
    column: number;
  }

  export interface SyntaxNode {
    type: string;
    text: string;
    startIndex: number;
    endIndex: number;
    startPosition: Point;
    endPosition: Point;
    children: SyntaxNode[];
    childCount: number;
    parent: SyntaxNode | null;
    
    child(index: number): SyntaxNode | null;
    namedChild(index: number): SyntaxNode | null;
    walk(): TreeCursor;
  }

  export interface TreeCursor {
    nodeType: string;
    nodeText: string;
    startPosition: Point;
    endPosition: Point;
    
    gotoFirstChild(): boolean;
    gotoNextSibling(): boolean;
    gotoParent(): boolean;
  }

  export interface Tree {
    rootNode: SyntaxNode;
    walk(): TreeCursor;
    delete(): void;
  }

  export interface QueryCapture {
    name: string;
    node: SyntaxNode;
  }

  export interface QueryMatch {
    pattern: number;
    captures: QueryCapture[];
  }

  export class Query {
    constructor(language: unknown, source: string);
    matches(node: SyntaxNode): QueryMatch[];
    captures(node: SyntaxNode): QueryCapture[];
  }

  export class Parser {
    static prototype: Parser;
    setLanguage(language: unknown): void;
    parse(input: string, previousTree?: Tree): Tree;
    delete(): void;
  }
}

declare module 'tree-sitter-typescript' {
  import { Parser } from 'tree-sitter';
  
  function TypeScript(parser: typeof Parser.Parser): unknown;
  
  export = TypeScript;
  export default TypeScript;
}
