import type { ReactNode } from 'react';

import styles from './inline-actions.module.css';

export function InlineActions({ children, compact = false }: { readonly children: ReactNode; readonly compact?: boolean }): React.JSX.Element {
  return <div className={compact ? `${styles.actions} ${styles.compact}` : styles.actions}>{children}</div>;
}
