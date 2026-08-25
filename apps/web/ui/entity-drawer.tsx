'use client';

import { Button } from '@heroui/react';
import type { ReactNode } from 'react';

import styles from './system.module.css';

interface EntityDrawerProps {
  readonly children: ReactNode;
  readonly eyebrow: string;
  readonly onClose: () => void;
  readonly title: string;
}

export function EntityDrawer({ children, eyebrow, onClose, title }: EntityDrawerProps): React.JSX.Element {
  return <>
    <button aria-label="Cerrar formulario" className={styles.backdrop} onClick={onClose} type="button" />
    <aside aria-modal="true" className={styles.drawer} role="dialog">
      <div className={styles.drawerHeader}>
        <div><span className={styles.eyebrow}>{eyebrow}</span><h3 className={styles.drawerTitle}>{title}</h3></div>
        <Button aria-label="Cerrar" isIconOnly onPress={onClose} variant="ghost">×</Button>
      </div>
      <div className={styles.drawerContent}>{children}</div>
    </aside>
  </>;
}

export function FormActions({ cancelLabel = 'Cancelar', onCancel, submitLabel, submitting = false }: { readonly cancelLabel?: string; readonly onCancel: () => void; readonly submitLabel: string; readonly submitting?: boolean }): React.JSX.Element {
  return <div className={styles.formActions}>
    <Button onPress={onCancel} type="button" variant="secondary">{cancelLabel}</Button>
    <Button isDisabled={submitting} type="submit" variant="primary">{submitLabel}</Button>
  </div>;
}
