'use client';

import { Chip } from '@heroui/react';

interface StatusBadgeProps {
  readonly label: string;
  readonly tone?: 'accent' | 'default' | 'success' | 'warning';
}

export function StatusBadge({ label, tone = 'default' }: StatusBadgeProps): React.JSX.Element {
  return <Chip color={tone} size="sm" variant="soft">{label}</Chip>;
}
