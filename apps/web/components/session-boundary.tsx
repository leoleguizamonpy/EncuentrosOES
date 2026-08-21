'use client';

import { useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useState } from 'react';

import { currentActor, type AccountRole, type Actor } from '../lib/auth-api';
import { WorkspaceState } from './workspace-state';

export interface SessionBoundaryProps {
  readonly allowedRoles?: readonly AccountRole[];
  readonly children: (actor: Actor) => ReactNode;
}

export function SessionBoundary({ allowedRoles, children }: SessionBoundaryProps): React.JSX.Element {
  const router = useRouter();
  const [actor, setActor] = useState<Actor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const restore = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const current = await currentActor();
      if (current === null) {
        router.replace('/login');
        return;
      }
      if (allowedRoles !== undefined && !allowedRoles.includes(current.role)) {
        router.replace('/dashboard');
        return;
      }
      setActor(current);
    } catch {
      setActor(null);
      setError('No fue posible restaurar la sesión. Revisa la conexión e inténtalo nuevamente.');
    } finally {
      setLoading(false);
    }
  }, [allowedRoles, router]);

  useEffect(() => {
    void restore();
  }, [restore]);

  if (loading) {
    return <main className="session-state"><WorkspaceState detail="Validando tu cuenta y permisos." title="Restaurando sesión segura…" /></main>;
  }

  if (actor === null) {
    if (error !== null) {
      return <main className="session-state"><WorkspaceState detail={error} onAction={() => void restore()} title="No fue posible restaurar la sesión." tone="error" /></main>;
    }
    return <main className="session-state" aria-live="polite">Redirigiendo…</main>;
  }

  return <>{children(actor)}</>;
}
