import type { ReactNode } from 'react';

import styles from './data-table.module.css';

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
  return <div className={styles.scroller}>
    <table aria-label={label} className={`${styles.table} ${width === 'wide' ? styles.wide : styles.medium}`}>
      <thead><tr>{columns.map((column) => <th className={column.align === 'right' ? styles.right : undefined} key={column.id} scope="col">{column.label}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <tr key={getRowKey(row)}>{columns.map((column) => <td className={column.align === 'right' ? styles.right : undefined} key={column.id}>{column.render(row)}</td>)}</tr>)}</tbody>
    </table>
  </div>;
}
