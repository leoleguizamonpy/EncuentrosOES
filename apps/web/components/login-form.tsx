'use client';

import { Alert, Button, Input } from '@heroui/react';
import { useRouter } from 'next/navigation';
import { useState, type SyntheticEvent } from 'react';

import { login } from '../lib/auth-api';
import styles from './login-form.module.css';

export function LoginForm(): React.JSX.Element {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>): Promise<void> {
    event.preventDefault();
    setError(null);
    setPending(true);
    const data = new FormData(event.currentTarget);
    const email = data.get('email');
    const password = data.get('password');
    try {
      await login(typeof email === 'string' ? email : '', typeof password === 'string' ? password : '');
      router.replace('/dashboard');
    } catch {
      setError('No pudimos iniciar sesión. Verificá tus datos e intentá nuevamente.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      <div className={styles.field}>
        <label htmlFor="email">Correo institucional</label>
        <Input autoComplete="username" className={styles.input ?? ''} fullWidth id="email" name="email" placeholder="nombre@oes.org.py" required type="email" variant="secondary" />
      </div>
      <div className={styles.field}>
        <label htmlFor="password">Contraseña</label>
        <Input autoComplete="current-password" className={styles.input ?? ''} fullWidth id="password" minLength={12} name="password" required type="password" variant="secondary" />
      </div>
      {error === null ? null : (
        <Alert className={styles.alert ?? ''} status="danger" role="alert">
          <Alert.Indicator />
          <Alert.Content><Alert.Title>Acceso no autorizado</Alert.Title><Alert.Description>{error}</Alert.Description></Alert.Content>
        </Alert>
      )}
      <Button className={styles.submit ?? ''} isDisabled={pending} type="submit" variant="primary">
        {pending ? 'Verificando…' : 'Ingresar al sistema'}
      </Button>
      <p className={styles.note}>Acceso exclusivo para autoridades habilitadas por la OES.</p>
    </form>
  );
}
