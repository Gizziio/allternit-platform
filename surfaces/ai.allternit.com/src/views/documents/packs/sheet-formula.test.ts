import { describe, expect, it } from 'vitest';
import type { Cell } from '../office-io/types';
import {
  coordsToCellRef,
  evaluateFormula,
  evaluateSheetCell,
  isFormulaError,
  offsetFormulaReferences,
  rewriteFormulaReferences,
} from './sheet-formula';

describe('sheet-formula', () => {
  describe('coordsToCellRef', () => {
    it('converts 0,0 to A1', () => {
      expect(coordsToCellRef(0, 0)).toBe('A1');
    });
    it('converts rows and columns', () => {
      expect(coordsToCellRef(1, 1)).toBe('B2');
      expect(coordsToCellRef(9, 25)).toBe('Z10');
      expect(coordsToCellRef(9, 26)).toBe('AA10');
    });
  });

  describe('evaluateFormula', () => {
    it('evaluates simple arithmetic', () => {
      expect(evaluateFormula('=1+2', () => undefined)).toBe(3);
      expect(evaluateFormula('=10-3', () => undefined)).toBe(7);
      expect(evaluateFormula('=4*5', () => undefined)).toBe(20);
      expect(evaluateFormula('=20/4', () => undefined)).toBe(5);
    });

    it('respects operator precedence and parentheses', () => {
      expect(evaluateFormula('=2+3*4', () => undefined)).toBe(14);
      expect(evaluateFormula('=(2+3)*4', () => undefined)).toBe(20);
      expect(evaluateFormula('=2^3+1', () => undefined)).toBe(9);
    });

    it('evaluates unary operators', () => {
      expect(evaluateFormula('=-5', () => undefined)).toBe(-5);
      expect(evaluateFormula('=+5', () => undefined)).toBe(5);
      expect(evaluateFormula('=2*-3', () => undefined)).toBe(-6);
    });

    it('evaluates cell references', () => {
      const cells: Record<string, Cell> = {
        '0:0': { value: 10 },
        '0:1': { value: 20 },
      };
      expect(
        evaluateFormula('=A1+B1', (row, col) => cells[`${row}:${col}`]?.value)
      ).toBe(30);
    });

    it('evaluates string literals', () => {
      expect(evaluateFormula('="hello"', () => undefined)).toBe('hello');
    });

    it('returns #DIV/0! for division by zero', () => {
      expect(evaluateFormula('=1/0', () => undefined)).toBe('#DIV/0!');
    });

    it('returns #NAME? for unknown functions', () => {
      expect(evaluateFormula('=FOO()', () => undefined)).toBe('#NAME?');
    });

    it('returns #ERROR! for malformed formulas', () => {
      expect(evaluateFormula('=1+', () => undefined)).toBe('#ERROR!');
    });

    describe('functions', () => {
      const cells: Record<string, Cell> = {
        '0:0': { value: 1 },
        '0:1': { value: 2 },
        '0:2': { value: 3 },
        '1:0': { value: 4 },
        '1:1': { value: 5 },
        '1:2': { value: 6 },
      };
      const getValue = (row: number, col: number) => cells[`${row}:${col}`]?.value;

      it('SUM with range', () => {
        expect(evaluateFormula('=SUM(A1:C1)', getValue)).toBe(6);
      });

      it('SUM with two dimensional range', () => {
        expect(evaluateFormula('=SUM(A1:C2)', getValue)).toBe(21);
      });

      it('AVERAGE', () => {
        expect(evaluateFormula('=AVERAGE(A1:C1)', getValue)).toBe(2);
      });

      it('MIN', () => {
        expect(evaluateFormula('=MIN(A1:C2)', getValue)).toBe(1);
      });

      it('MAX', () => {
        expect(evaluateFormula('=MAX(A1:C2)', getValue)).toBe(6);
      });

      it('COUNT', () => {
        expect(evaluateFormula('=COUNT(A1:C2)', getValue)).toBe(6);
      });

      it('nested functions', () => {
        expect(evaluateFormula('=SUM(A1:C1)*AVERAGE(A1:C1)', getValue)).toBe(12);
      });

      it('COUNTA counts non-blank values', () => {
        expect(evaluateFormula('=COUNTA(A1:C2)', getValue)).toBe(6);
      });

      it('IF returns the chosen branch lazily', () => {
        expect(evaluateFormula('=IF(1=1,2,3)', () => undefined)).toBe(2);
        expect(evaluateFormula('=IF(1=2,2,3)', () => undefined)).toBe(3);
      });
    });

    it('evaluates comparison operators', () => {
      expect(evaluateFormula('=1=1', () => undefined)).toBe(true);
      expect(evaluateFormula('=1<>2', () => undefined)).toBe(true);
      expect(evaluateFormula('=1<2', () => undefined)).toBe(true);
      expect(evaluateFormula('=2>1', () => undefined)).toBe(true);
      expect(evaluateFormula('=2<=2', () => undefined)).toBe(true);
      expect(evaluateFormula('=2>=3', () => undefined)).toBe(false);
    });

    it('concatenates strings and numbers with &', () => {
      expect(evaluateFormula('="a"&"b"', () => undefined)).toBe('ab');
      expect(evaluateFormula('=1&2', () => undefined)).toBe('12');
    });
  });

  describe('rewriteFormulaReferences', () => {
    it('shifts cell references on row insert', () => {
      expect(rewriteFormulaReferences('=A1+B2', { type: 'row', index: 1, delta: 1 })).toBe('=A1+B3');
    });

    it('shifts cell references on row delete', () => {
      expect(rewriteFormulaReferences('=A3+B4', { type: 'row', index: 1, delta: -1 })).toBe('=A2+B3');
    });

    it('marks deleted row references as #REF!', () => {
      expect(rewriteFormulaReferences('=A2+5', { type: 'row', index: 1, delta: -1 })).toBe('=#REF!+5');
    });

    it('shifts cell references on column insert', () => {
      expect(rewriteFormulaReferences('=A1+C2', { type: 'col', index: 1, delta: 1 })).toBe('=A1+D2');
    });

    it('shifts cell references on column delete', () => {
      expect(rewriteFormulaReferences('=C2+D3', { type: 'col', index: 1, delta: -1 })).toBe('=B2+C3');
    });

    it('marks deleted column references as #REF!', () => {
      expect(rewriteFormulaReferences('=B1+5', { type: 'col', index: 1, delta: -1 })).toBe('=#REF!+5');
    });

    it('rewrites ranges on row insert and delete', () => {
      expect(rewriteFormulaReferences('=SUM(A1:A3)', { type: 'row', index: 1, delta: 1 })).toBe('=SUM(A1:A4)');
      expect(rewriteFormulaReferences('=SUM(A1:A3)', { type: 'row', index: 1, delta: -1 })).toBe('=SUM(A1:A2)');
    });

    it('rewrites ranges on column insert and delete', () => {
      expect(rewriteFormulaReferences('=SUM(A1:C1)', { type: 'col', index: 1, delta: 1 })).toBe('=SUM(A1:D1)');
      expect(rewriteFormulaReferences('=SUM(A1:C1)', { type: 'col', index: 1, delta: -1 })).toBe('=SUM(A1:B1)');
    });

    it('returns #REF! for a range fully on the deleted row', () => {
      expect(rewriteFormulaReferences('=SUM(A2:A2)', { type: 'row', index: 1, delta: -1 })).toBe('=SUM(#REF!)');
    });

    it('leaves non-formula values unchanged', () => {
      expect(rewriteFormulaReferences('hello', { type: 'row', index: 0, delta: 1 })).toBe('hello');
    });
  });

  describe('offsetFormulaReferences', () => {
    it('shifts cell references by row and column deltas', () => {
      expect(offsetFormulaReferences('=A1', 1, 1)).toBe('=B2');
      expect(offsetFormulaReferences('=A1+B2', 2, 0)).toBe('=A3+B4');
      expect(offsetFormulaReferences('=B2', 0, -1)).toBe('=A2');
    });

    it('shifts range references', () => {
      expect(offsetFormulaReferences('=SUM(A1:B2)', 1, 2)).toBe('=SUM(C2:D3)');
    });

    it('clamps negative references to zero', () => {
      expect(offsetFormulaReferences('=A1', -5, -5)).toBe('=A1');
    });
  });

  describe('evaluateSheetCell', () => {
    it('returns a plain value', () => {
      const cell: Cell = { value: 42 };
      expect(evaluateSheetCell(cell, () => undefined, new Set(), '0:0')).toBe(42);
    });

    it('evaluates a formula', () => {
      const cells: Record<string, Cell> = {
        '0:0': { value: 10 },
        '0:1': { formula: '=A1*2' },
      };
      expect(
        evaluateSheetCell(
          cells['0:1'],
          (row, col) => cells[`${row}:${col}`],
          new Set(),
          '0:1'
        )
      ).toBe(20);
    });

    it('detects circular references', () => {
      const cells: Record<string, Cell> = {
        '0:0': { formula: '=B1' },
        '0:1': { formula: '=A1' },
      };
      expect(
        evaluateSheetCell(
          cells['0:0'],
          (row, col) => cells[`${row}:${col}`],
          new Set(),
          '0:0'
        )
      ).toBe('#CYCLE!');
    });

    it('propagates errors from referenced cells', () => {
      const cells: Record<string, Cell> = {
        '0:0': { formula: '=1/0' },
        '0:1': { formula: '=A1+1' },
      };
      const result = evaluateSheetCell(
        cells['0:1'],
        (row, col) => cells[`${row}:${col}`],
        new Set(),
        '0:1'
      );
      expect(isFormulaError(result)).toBe(true);
    });
  });
});
