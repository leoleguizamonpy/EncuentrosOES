'use client';

import { Alert } from '@heroui/react';

interface NoticeProps {
  readonly description: string;
  readonly title?: string;
  readonly tone: 'danger' | 'success' | 'warning';
}

export function Notice({ description, title, tone }: NoticeProps): React.JSX.Element {
  return <Alert status={tone} role={tone === 'danger' ? 'alert' : 'status'}>
    <Alert.Indicator />
    <Alert.Content>{title === undefined ? null : <Alert.Title>{title}</Alert.Title>}<Alert.Description>{description}</Alert.Description></Alert.Content>
  </Alert>;
}
