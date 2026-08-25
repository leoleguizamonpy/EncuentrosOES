'use client';

import { Button } from '@heroui/react';
import type { ReactNode } from 'react';

import styles from './system.module.css';

interface PageHeaderProps {
  readonly action?: {
    readonly label: string;
    readonly onPress: () => void;
  };
  readonly description: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly trailing?: ReactNode;
}

export function PageHeader({ action, description, eyebrow, title, trailing }: PageHeaderProps): React.JSX.Element {
  return <section className={styles.pageHeader}>
    <div className={styles.pageHeaderCopy}>
      <span className={styles.eyebrow}>{eyebrow}</span>
      <h2 className={styles.pageTitle}>{title}</h2>
      <p className={styles.pageDescription}>{description}</p>
    </div>
    {trailing ?? (action === undefined ? null : <Button onPress={action.onPress} variant="primary">{action.label}</Button>)}
  </section>;
}
