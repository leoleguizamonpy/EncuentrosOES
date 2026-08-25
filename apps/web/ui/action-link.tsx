import Link from 'next/link';
import type { ReactNode } from 'react';

import styles from './action-link.module.css';

export function ActionLink({ children, href }: { readonly children: ReactNode; readonly href: string }): React.JSX.Element {
  return <Link className={styles.link} href={href}>{children}</Link>;
}
