import type { ReactNode } from 'react';

import styles from './status-summary.module.css';

export function StatusSummary({ children, label }: { readonly children: ReactNode; readonly label: string }): React.JSX.Element {
  return <div aria-label={label} className={styles.summary}>{children}</div>;
}
