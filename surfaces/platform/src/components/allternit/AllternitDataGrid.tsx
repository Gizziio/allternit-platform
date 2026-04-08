/**
 * AllternitDataGrid.tsx
 * 
 * Allternit-native data grid wrapping AG-Grid.
 * Excel-like spreadsheet interface with Allternit theming.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  type ColDef,
  type GridReadyEvent,
  type CellValueChangedEvent,
  type RowDataUpdatedEvent,
  ModuleRegistry,
  ClientSideRowModelModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
} from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import {
  Table as Table2,
  DownloadSimple,
  ShareNetwork,
  Plus,
  Funnel,
  ChartBar,
  DotsThreeOutline,
  FileXls as FileSpreadsheet,
} from '@phosphor-icons/react';
const Filter = Funnel;
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Register AG-Grid modules
ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
]);

interface Column {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean';
  width?: number;
}

interface AllternitDataGridProps {
  /** Column definitions */
  columns: Column[];
  /** Row data */
  data: Record<string, any>[];
  /** Grid title */
  title?: string;
  /** Read-only mode */
  readOnly?: boolean;
  /** Callback when cell value changes */
  onCellValueChanged?: (event: CellValueChangedEvent) => void;
  /** Callback when data is updated */
  onDataChanged?: (data: Record<string, any>[]) => void;
  /** Optional className */
  className?: string;
  /** Show/hide toolbar */
  showToolbar?: boolean;
  /** Enable charting/visualization */
  enableCharts?: boolean;
  /** Grid height */
  height?: string | number;
}

/**
 * Allternit Data Grid
 * 
 * Wraps AG-Grid with Allternit-native theming and branding.
 * All user-facing labels say "Allternit Data" not "AG-Grid".
 */
export function AllternitDataGrid({
  columns,
  data,
  title = 'Untitled Data',
  readOnly = false,
  onCellValueChanged,
  onDataChanged,
  className,
  showToolbar = true,
  enableCharts = true,
  height = '100%',
}: AllternitDataGridProps) {
  const [gridApi, setGridApi] = useState<any>(null);
  const [selectedRows, setSelectedRows] = useState<number>(0);
  const [filterEnabled, setFilterEnabled] = useState(false);

  // Convert Allternit columns to AG-Grid column defs
  const columnDefs = useMemo<ColDef[]>(() => {
    return columns.map((col) => ({
      field: col.key,
      headerName: col.label,
      width: col.width,
      editable: !readOnly,
      filter: filterEnabled,
      sortable: true,
      resizable: true,
      cellClass: 'allternit-data-cell',
      headerClass: 'allternit-data-header',
      valueFormatter: (params: any) => {
        if (col.type === 'number' && typeof params.value === 'number') {
          return params.value.toLocaleString();
        }
        return params.value;
      },
    }));
  }, [columns, readOnly, filterEnabled]);

  // Default column properties
  const defaultColDef = useMemo<ColDef>(() => ({
    flex: 1,
    minWidth: 100,
    editable: !readOnly,
  }), [readOnly]);

  // Handle grid ready
  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
    params.api.sizeColumnsToFit();
  }, []);

  // Handle cell value change
  const handleCellValueChanged = useCallback((event: CellValueChangedEvent) => {
    onCellValueChanged?.(event);
    
    // Get updated data
    if (gridApi) {
      const updatedData: any[] = [];
      gridApi.forEachNode((node: any) => {
        updatedData.push(node.data);
      });
      onDataChanged?.(updatedData);
    }
  }, [gridApi, onCellValueChanged, onDataChanged]);

  // Handle selection change
  const onSelectionChanged = useCallback(() => {
    if (gridApi) {
      const selected = gridApi.getSelectedRows();
      setSelectedRows(selected.length);
    }
  }, [gridApi]);

  // Add new row
  const addRow = useCallback(() => {
    if (gridApi && !readOnly) {
      const newRow: Record<string, any> = {};
      columns.forEach((col) => {
        newRow[col.key] = col.type === 'number' ? 0 : '';
      });
      
      gridApi.applyTransaction({ add: [newRow] });
      
      // Get updated data
      const updatedData: any[] = [];
      gridApi.forEachNode((node: any) => {
        updatedData.push(node.data);
      });
      onDataChanged?.(updatedData);
    }
  }, [gridApi, columns, readOnly, onDataChanged]);

  // Export to CSV
  const exportCSV = useCallback(() => {
    if (gridApi) {
      gridApi.exportDataAsCsv({
        fileName: `${title.replace(/\s+/g, '_')}.csv`,
      });
    }
  }, [gridApi, title]);

  // Row count
  const rowCount = data.length;

  return (
    <div 
      className={cn(
        "flex flex-col h-full bg-[#1a1a1a] rounded-lg overflow-hidden border border-[#333]",
        className
      )}
    >
      {/* Allternit Data Toolbar */}
      {showToolbar && (
        <div className="h-12 border-b border-[#333] flex items-center justify-between px-4 bg-[#1e1e1e]">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-4 h-4 text-[#10b981]" />
            <span className="text-sm font-medium text-[#ECECEC]">
              {title}
            </span>
            <span className="text-xs text-[#666]">
              {rowCount} rows × {columns.length} columns
            </span>
            {selectedRows > 0 && (
              <span className="text-xs text-[#D4956A]">
                {selectedRows} selected
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Filter toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilterEnabled(!filterEnabled)}
              className={cn(
                "h-7 text-[#888] hover:text-[#ECECEC]",
                filterEnabled && "text-[#D4956A] bg-[#D4956A]/10"
              )}
            >
              <Funnel size={16} />
            </Button>

            {/* Charts button */}
            {enableCharts && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[#888] hover:text-[#ECECEC]"
              >
                <ChartBar size={16} />
              </Button>
            )}

            {/* Add row */}
            {!readOnly && (
              <Button
                variant="ghost"
                size="sm"
                onClick={addRow}
                className="h-7 text-[#888] hover:text-[#ECECEC]"
              >
                <Plus size={16} />
              </Button>
            )}

            {/* Export */}
            <Button
              variant="ghost"
              size="sm"
              onClick={exportCSV}
              className="h-7 text-[#888] hover:text-[#ECECEC]"
            >
              <DownloadSimple size={16} />
            </Button>

            {/* Share */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[#888] hover:text-[#ECECEC]"
            >
              <ShareNetwork size={16} />
            </Button>

            {/* More */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[#888] hover:text-[#ECECEC]"
            >
              <DotsThreeOutline size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* AG-Grid with Allternit Theme */}
      <div 
        className="flex-1 allternit-data-theme"
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
      >
        <AgGridReact
          rowData={data}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          onGridReady={onGridReady}
          onCellValueChanged={handleCellValueChanged}
          onSelectionChanged={onSelectionChanged}
          rowSelection="multiple"
          suppressRowClickSelection={false}
          animateRows={true}
          pagination={rowCount > 100}
          paginationPageSize={50}
          className="ag-theme-allternit"
        />
      </div>

      {/* Status bar */}
      <div className="h-8 border-t border-[#333] flex items-center justify-between px-4 text-xs text-[#666] bg-[#1e1e1e]">
        <div className="flex items-center gap-4">
          <span>Allternit Data</span>
          <span>{rowCount} rows</span>
          <span>{columns.length} columns</span>
          {selectedRows > 0 && (
            <span className="text-[#D4956A]">{selectedRows} selected</span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {filterEnabled && (
            <span className="text-[#D4956A]">Filters active</span>
          )}
          {readOnly && (
            <span className="text-[#666]">Read-only</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default AllternitDataGrid;
