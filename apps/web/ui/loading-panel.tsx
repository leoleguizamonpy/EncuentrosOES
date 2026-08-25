import { Card, Skeleton } from '@heroui/react';

import styles from './loading-panel.module.css';

export function LoadingPanel({ label }: { readonly label: string }): React.JSX.Element {
  return <Card variant="tertiary"><Card.Content className={styles.content}><Skeleton className={styles.line} /><strong>{label}</strong></Card.Content></Card>;
}
