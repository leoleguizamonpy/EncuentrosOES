'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import styles from './system.module.css';

interface DataListProps {
  readonly children: ReactNode;
  readonly empty?: {
    readonly action?: ReactNode;
    readonly description: string;
    readonly title: string;
  };
  readonly isEmpty?: boolean;
  readonly label: string;
}

export function DataList({ children, empty, isEmpty = false, label }: DataListProps): React.JSX.Element {
  return <section aria-label={label} className={styles.list}>
    {isEmpty && empty !== undefined ? <div className={styles.empty}><strong>{empty.title}</strong><p>{empty.description}</p>{empty.action}</div> : children}
  </section>;
}

interface DataRowProps {
  readonly description?: ReactNode;
  readonly href?: string;
  readonly meta?: ReactNode;
  readonly onPress?: () => void;
  readonly status?: ReactNode;
  readonly title: ReactNode;
  readonly visual: ReactNode;
}

function RowContent({ description, meta, status, title, visual }: Omit<DataRowProps, 'href' | 'onPress'>): React.JSX.Element {
  return <>
    <span className={styles.visual}>{visual}</span>
    <span className={styles.identity}><strong className={styles.rowTitle}>{title}</strong>{description === undefined ? null : <small className={styles.rowDescription}>{description}</small>}</span>
    <span className={styles.rowMeta}>{meta}</span>
    <span>{status}</span>
    <span aria-hidden="true" className={styles.arrow}>→</span>
  </>;
}

export function DataRow(props: DataRowProps): React.JSX.Element {
  if (props.href !== undefined) {
    return <Link className={styles.row} href={props.href}><RowContent {...props} /></Link>;
  }
  return <button className={styles.row} onClick={props.onPress} type="button"><RowContent {...props} /></button>;
}
