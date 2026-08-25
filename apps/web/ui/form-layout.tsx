import type { FormEventHandler, ReactNode } from 'react';

import styles from './form-layout.module.css';

export function FormStack({ children, onSubmit }: { readonly children: ReactNode; readonly onSubmit: FormEventHandler<HTMLFormElement> }): React.JSX.Element {
  return <form className={styles.form} onSubmit={onSubmit}>{children}</form>;
}
