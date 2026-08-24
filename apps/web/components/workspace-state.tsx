'use client';

import { Alert, Button, Card, Skeleton } from '@heroui/react';

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
      <Card.Content style={{ display: 'grid', gap: 12, padding: 24 }}>
        <Skeleton style={{ borderRadius: 999, height: 8, maxWidth: 140, width: '32%' }} />
        <strong>{title}</strong>
        <p style={{ color: 'var(--muted-foreground)', margin: 0 }}>{detail}</p>
        {onAction === undefined ? null : <Button onPress={onAction} size="sm" variant="secondary">{actionLabel}</Button>}
      </Card.Content>
    </Card>
  );
}
