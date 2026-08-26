import type { ReactNode } from 'react';

import styles from './system.module.css';

export interface DataTableColumn<T> {
  readonly align?: 'left' | 'right';
  readonly className?: string | undefined;
  readonly id: string;
  readonly label: ReactNode;
  readonly render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  readonly className?: string | undefined;
  readonly columns: readonly DataTableColumn<T>[];
  readonly getRowKey: (row: T) => string;
  readonly label: string;
  readonly rows: readonly T[];
  readonly width?: 'medium' | 'wide';
}

function columnClassName<T>(column: DataTableColumn<T>): string | undefined {
  const classes = [column.align === 'right' ? styles.tableRight : undefined, column.className].filter(Boolean);
  return classes.length === 0 ? undefined : classes.join(' ');
}

export function DataTable<T>({ className, columns, getRowKey, label, rows, width = 'medium' }: DataTableProps<T>): React.JSX.Element {
  return <div className={[styles.tableScroller, className].filter(Boolean).join(' ')}>
    <table aria-label={label} className={`${styles.dataTable} ${width === 'wide' ? styles.tableWide : styles.tableMedium}`}>
      <thead><tr>{columns.map((column) => <th className={columnClassName(column)} key={column.id} scope="col">{column.label}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <tr key={getRowKey(row)}>{columns.map((column) => <td className={columnClassName(column)} key={column.id}>{column.render(row)}</td>)}</tr>)}</tbody>
    </table>
  </div>;
}
