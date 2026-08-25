'use client';

import { Input } from '@heroui/react';
import type { ChangeEvent, ReactNode } from 'react';

import styles from './system.module.css';

interface ListToolbarProps<TStatus extends string> {
  readonly count: number;
  readonly extraFilter?: ReactNode;
  readonly onQueryChange: (value: string) => void;
  readonly onStatusChange: (value: TStatus) => void;
  readonly query: string;
  readonly searchLabel: string;
  readonly searchPlaceholder: string;
  readonly status: TStatus;
  readonly statusLabel: string;
  readonly statusOptions: readonly { readonly label: string; readonly value: TStatus }[];
  readonly total: number;
}

export function ListToolbar<TStatus extends string>({ count, extraFilter, onQueryChange, onStatusChange, query, searchLabel, searchPlaceholder, status, statusLabel, statusOptions, total }: ListToolbarProps<TStatus>): React.JSX.Element {
  return <section aria-label="Filtros" className={extraFilter === undefined ? styles.toolbar : `${styles.toolbar} ${styles.toolbarExtended}`}>
    <Input aria-label={searchLabel} className={styles.searchInput} placeholder={searchPlaceholder} value={query} onChange={(event) => onQueryChange(event.target.value)} variant="secondary" />
    {extraFilter}
    <select aria-label={statusLabel} onChange={(event: ChangeEvent<HTMLSelectElement>) => onStatusChange(event.target.value as TStatus)} value={status}>
      {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    <span className={styles.listCounter}>{count} de {total}</span>
  </section>;
}
