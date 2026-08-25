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
  const panelClass = styles.panel ?? '';
  const cardProps = {
    ...(id === undefined ? {} : { id }),
    ...(headingId === undefined ? {} : { 'aria-labelledby': headingId }),
  };
  return <Card className={className === undefined ? panelClass : `${panelClass} ${className}`} {...cardProps}>
    <Card.Content className={styles.content ?? ''}>
      <header className={styles.header}>
        <div>{eyebrow === undefined ? null : <span className={styles.eyebrow}>{eyebrow}</span>}<h3 {...(headingId === undefined ? {} : { id: headingId })}>{title}</h3></div>
        {status === undefined ? null : <div className={styles.status}>{status}</div>}
      </header>
      <div className={styles.body}>{children}</div>
    </Card.Content>
  </Card>;
}
