'use client';

import { useRouter } from 'next/navigation';
import { useState, type SyntheticEvent } from 'react';

import { login } from '../lib/auth-api';

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
    <form className="login-form" onSubmit={(event) => void submit(event)}>
      <div className="field">
        <label htmlFor="email">Correo institucional</label>
        <input autoComplete="username" id="email" name="email" placeholder="nombre@oes.org.py" required type="email" />
      </div>
      <div className="field">
        <label htmlFor="password">Contraseña</label>
        <input autoComplete="current-password" id="password" minLength={12} name="password" required type="password" />
      </div>
      {error === null ? null : <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" disabled={pending} type="submit">
        {pending ? 'Verificando…' : 'Ingresar al sistema'}
      </button>
      <p className="access-note">Acceso exclusivo para autoridades habilitadas por la OES.</p>
    </form>
  );
}
