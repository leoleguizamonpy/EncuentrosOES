import type { ReactNode } from 'react';

import styles from './system.module.css';

export interface DataTableColumn<T> {
  readonly align?: 'left' | 'right';
  readonly id: string;
  readonly label: ReactNode;
  readonly render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  readonly columns: readonly DataTableColumn<T>[];
  readonly getRowKey: (row: T) => string;
  readonly label: string;
  readonly rows: readonly T[];
  readonly width?: 'medium' | 'wide';
}

export function DataTable<T>({ columns, getRowKey, label, rows, width = 'medium' }: DataTableProps<T>): React.JSX.Element {
  return <div className={styles.tableScroller}>
    <table aria-label={label} className={`${styles.dataTable} ${width === 'wide' ? styles.dataTableWide : styles.dataTableMedium}`}>
      <thead><tr>{columns.map((column) => <th className={column.align === 'right' ? styles.cellRight : undefined} key={column.id} scope="col">{column.label}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <tr key={getRowKey(row)}>{columns.map((column) => <td className={column.align === 'right' ? styles.cellRight : undefined} key={column.id}>{column.render(row)}</td>)}</tr>)}</tbody>
    </table>
  </div>;
}
