/**
 * Data Table Template
 * Creates data tables and visualizations
 */

export interface DataTableParams {
  data: any[];
  columns?: string[];
  sortable?: boolean;
  filterable?: boolean;
}

export async function dataTable(params: DataTableParams) {
  const { data, columns, sortable = true, filterable = true } = params;
  
  return {
    markdown: `| Column 1 | Column 2 |\n|----------|----------|`,
    tableData: data,
    options: { sortable, filterable }
  };
}

export default dataTable;
