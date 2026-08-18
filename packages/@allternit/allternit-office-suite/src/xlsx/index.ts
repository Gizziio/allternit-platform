/**
 * XLSX engine facade for the Allternit Office Suite.
 *
 * The vendored Sheets app no longer imports `@allternit/office-xlsx-engine`
 * directly; it consumes these exports from the suite package so that the suite
 * is the single boundary around the spreadsheet engine.
 */

export * from '@allternit/office-xlsx-engine/domain/cell-address';
export * from '@allternit/office-xlsx-engine/domain/chart-visual';
export * from '@allternit/office-xlsx-engine/domain/flash-fill';
export * from '@allternit/office-xlsx-engine/domain/in-memory-workbook';
export * from '@allternit/office-xlsx-engine/domain/pivot-chart';
export * from '@allternit/office-xlsx-engine/domain/pivot-engine';
export * from '@allternit/office-xlsx-engine/domain/pivot-filters';
export * from '@allternit/office-xlsx-engine/domain/pivot-formula';
export * from '@allternit/office-xlsx-engine/domain/pivot-grouping';
export * from '@allternit/office-xlsx-engine/domain/workbook-dsl';
export * from '@allternit/office-xlsx-engine/domain/workbook.types';
export * from '@allternit/office-xlsx-engine/gateway/xlsx-cf';
export * from '@allternit/office-xlsx-engine/gateway/xlsx-pivot';
export * from '@allternit/office-xlsx-engine/gateway/xlsx-structure';
export * from '@allternit/office-xlsx-engine/shared/desktop-api';
