'use client';

import { Input } from '@heroui/react';
import type { ChangeEventHandler, HTMLInputTypeAttribute, ReactNode } from 'react';

import styles from './system.module.css';

interface TextFieldProps {
  readonly disabled?: boolean;
  readonly label: string;
  readonly max?: string;
  readonly maxLength?: number;
  readonly min?: string;
  readonly minLength?: number;
  readonly onChange: ChangeEventHandler<HTMLInputElement>;
  readonly placeholder?: string;
  readonly required?: boolean;
  readonly type?: HTMLInputTypeAttribute;
  readonly value: string;
}

export function TextField({ disabled = false, label, max, maxLength, min, minLength, onChange, placeholder, required = false, type = 'text', value }: TextFieldProps): React.JSX.Element {
  const optionalProps = {
    ...(max === undefined ? {} : { max }),
    ...(maxLength === undefined ? {} : { maxLength }),
    ...(min === undefined ? {} : { min }),
    ...(minLength === undefined ? {} : { minLength }),
    ...(placeholder === undefined ? {} : { placeholder }),
  };
  return <label className={styles.field}><span>{label}</span><Input disabled={disabled} onChange={onChange} required={required} type={type} value={value} variant="secondary" {...optionalProps} /></label>;
}

export function Field({ children, label }: { readonly children: ReactNode; readonly label: string }): React.JSX.Element {
  return <label className={styles.field}><span>{label}</span>{children}</label>;
}
