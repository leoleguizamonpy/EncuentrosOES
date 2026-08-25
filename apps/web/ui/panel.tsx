import type { ReactNode } from 'react';

import styles from './panel.module.css';

export function Panel({ children, footer, header, padded = false }: { readonly children: ReactNode; readonly footer?: ReactNode; readonly header?: ReactNode; readonly padded?: boolean }): React.JSX.Element {
  return <section className={styles.panel}>{header === undefined ? null : <header className={styles.header}>{header}</header>}<div className={padded ? `${styles.content} ${styles.padded}` : styles.content}>{children}</div>{footer === undefined ? null : <footer className={styles.footer}>{footer}</footer>}</section>;
}

export function PanelStack({ children }: { readonly children: ReactNode }): React.JSX.Element { return <div className={styles.stack}>{children}</div>; }
