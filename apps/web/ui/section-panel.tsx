import { Card } from '@heroui/react';
import type { ReactNode } from 'react';

import styles from './section-panel.module.css';

interface SectionPanelProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly eyebrow?: string;
  readonly id?: string;
  readonly status?: ReactNode;
  readonly title: string;
}

export function SectionPanel({ children, className, eyebrow, id, status, title }: SectionPanelProps): React.JSX.Element {
  const headingId = id === undefined ? undefined : `${id}-title`;
  return <Card className={className === undefined ? styles.panel : `${styles.panel} ${className}`} id={id} aria-labelledby={headingId}>
    <Card.Content className={styles.content}>
      <header className={styles.header}>
        <div>{eyebrow === undefined ? null : <span className={styles.eyebrow}>{eyebrow}</span>}<h3 id={headingId}>{title}</h3></div>
        {status === undefined ? null : <div className={styles.status}>{status}</div>}
      </header>
      <div className={styles.body}>{children}</div>
    </Card.Content>
  </Card>;
}
