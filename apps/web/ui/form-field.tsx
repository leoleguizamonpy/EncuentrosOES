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
  return <label className={styles.field}><span>{label}</span><Input isDisabled={disabled} max={max} maxLength={maxLength} min={min} minLength={minLength} onChange={onChange} placeholder={placeholder} required={required} type={type} value={value} variant="secondary" /></label>;
}

export function Field({ children, label }: { readonly children: ReactNode; readonly label: string }): React.JSX.Element {
  return <label className={styles.field}><span>{label}</span>{children}</label>;
}
