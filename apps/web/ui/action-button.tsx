'use client';

import { Button } from '@heroui/react';
import type { ReactNode } from 'react';

interface ActionButtonProps {
  readonly children: ReactNode;
  readonly disabled?: boolean;
  readonly onPress?: () => void;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly type?: 'button' | 'submit';
  readonly variant?: 'ghost' | 'primary' | 'secondary';
}

export function ActionButton({ children, disabled = false, onPress, size = 'md', type = 'button', variant = 'primary' }: ActionButtonProps): React.JSX.Element {
  return <Button isDisabled={disabled} onPress={onPress} size={size} type={type} variant={variant}>{children}</Button>;
}
