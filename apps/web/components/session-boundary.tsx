'use client';

import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';

import { currentActor, type AccountRole, type Actor } from '../lib/auth-api';

export interface SessionBoundaryProps {
  readonly allowedRoles?: readonly AccountRole[];
  readonly children: (actor: Actor) => ReactNode;
}

export function SessionBoundary({ allowedRoles, children }: SessionBoundaryProps): React.JSX.Element {
  const router = useRouter();
  const [actor, setActor] = useState<Actor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void currentActor()
      .then((current) => {
        if (!active) return;
        if (current === null) {
          router.replace('/login');
          return;
        }
        if (allowedRoles !== undefined && !allowedRoles.includes(current.role)) {
          router.replace('/dashboard');
          return;
        }
        setActor(current);
      })
      .catch(() => {
        if (!active) return;
        setError('No fue posible restaurar la sesión. Revisa la conexión e inténtalo nuevamente.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [allowedRoles, router]);

  if (loading) {
    return <main className="session-state" aria-live="polite">Restaurando sesión segura…</main>;
  }

  if (actor === null) {
    return <main className="session-state" role={error === null ? undefined : 'alert'}>{error ?? 'Redirigiendo…'}</main>;
  }

  return <>{children(actor)}</>;
}
