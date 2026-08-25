'use client';

import { Alert, Button, Card, Skeleton } from '@heroui/react';

import styles from './workspace-state.module.css';

interface WorkspaceStateProps {
  readonly actionLabel?: string;
  readonly detail: string;
  readonly onAction?: () => void;
  readonly title: string;
  readonly tone?: 'neutral' | 'error';
}

export function WorkspaceState({ actionLabel = 'Reintentar', detail, onAction, title, tone = 'neutral' }: WorkspaceStateProps): React.JSX.Element {
  if (tone === 'error') {
    return (
      <Alert status="danger" role="alert">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{title}</Alert.Title>
          <Alert.Description>{detail}</Alert.Description>
          {onAction === undefined ? null : <Button onPress={onAction} size="sm" variant="secondary">{actionLabel}</Button>}
        </Alert.Content>
      </Alert>
    );
  }

  return (
    <Card variant="tertiary" role="status" aria-live="polite">
      <Card.Content className={styles.content ?? ''}>
        <Skeleton className={styles.line ?? ''} />
        <strong>{title}</strong>
        <p className={styles.detail}>{detail}</p>
        {onAction === undefined ? null : <Button onPress={onAction} size="sm" variant="secondary">{actionLabel}</Button>}
      </Card.Content>
    </Card>
  );
}
