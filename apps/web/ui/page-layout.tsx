import type { ReactNode } from 'react';

import styles from './page-layout.module.css';

export function PageLayout({ children, gap = 'normal' }: { readonly children: ReactNode; readonly gap?: 'compact' | 'normal' }): React.JSX.Element {
  return <div className={gap === 'compact' ? `${styles.page} ${styles.compact}` : styles.page}>{children}</div>;
}
