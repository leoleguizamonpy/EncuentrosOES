'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { currentActor, logout, type Actor } from '../lib/auth-api';
import { OesMark } from './oes-mark';

const roleLabels = {
  ADMIN: 'Administrador',
  OPERATOR: 'Operador',
  SUPERADMIN: 'Superadministrador',
} as const;

export function DashboardClient(): React.JSX.Element {
  const router = useRouter();
  const [actor, setActor] = useState<Actor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void currentActor()
      .then((current) => {
        if (!active) return;
        if (current === null) router.replace('/login');
        else setActor(current);
      })
      .catch(() => active && setError('No fue posible restaurar la sesión.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [router]);

  async function closeSession(): Promise<void> {
    setError(null);
    try {
      await logout();
      router.replace('/login');
    } catch {
      setError('No fue posible cerrar la sesión de forma segura.');
    }
  }

  if (loading) return <main className="session-state" aria-live="polite">Restaurando sesión segura…</main>;
  if (actor === null) return <main className="session-state">{error ?? 'Redirigiendo…'}</main>;

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <OesMark />
        <nav aria-label="Navegación principal">
          <a className="nav-item nav-item--active" href="/dashboard">Resumen</a>
          {actor.role === 'OPERATOR' ? null : <><span className="nav-heading">Administración</span><a className="nav-item" href="/admin/catalog">Cargar catálogos</a><a className="nav-item" href="/admin/catalog/manage">Gestionar catálogos</a></>}
          <span className="nav-heading">Gestión competitiva</span>
          <a className="nav-item" href="/competitions">Competencias</a>
          <span className="nav-item nav-item--disabled">Sorteos <small>Próximo</small></span>
          <span className="nav-item nav-item--disabled">Resultados <small>Próximo</small></span>
        </nav>
        <div className="sidebar__footer">Sistema oficial · OES 2026</div>
      </aside>
      <main className="dashboard-main">
        <header className="topbar">
          <div><span className="eyebrow">Panel de autoridad</span><h1>Centro de operaciones</h1></div>
          <div className="account-menu">
            <span className="account-avatar" aria-hidden="true">{actor.displayName.charAt(0)}</span>
            <span><strong>{actor.displayName}</strong><small>{roleLabels[actor.role]}</small></span>
            <button className="text-button" onClick={() => void closeSession()} type="button">Salir</button>
          </div>
        </header>
        {error === null ? null : <p className="dashboard-error" role="alert">{error}</p>}
        <section className="welcome-panel">
          <div>
            <span className="status-pill"><i /> Sesión verificada</span>
            <h2>La base operativa está lista.</h2>
            <p>Administra ediciones, eventos, deportes, modalidades e instituciones con identidad visual propia; después crea y opera las competencias persistentes.</p>
          </div>
          <div className="readiness" aria-label="Estado de módulos">
            <div><strong>Identidad</strong><span className="ready">Operativa</span></div>
            <div><strong>Catálogos</strong><span className="ready">Operativa</span></div>
            <div><strong>Competencias</strong><span className="ready">Operativa</span></div>
          </div>
        </section>
        <section className="principles-grid" aria-label="Garantías del sistema">
          <article><span>01</span><h3>Doble autoridad</h3><p>Quien registra una decisión oficial no puede confirmarla.</p></article>
          <article><span>02</span><h3>Estado persistente</h3><p>Cada competencia podrá retomarse exactamente donde quedó.</p></article>
          <article><span>03</span><h3>Evidencia verificable</h3><p>Los sorteos oficiales conservarán acta, código y trazabilidad.</p></article>
        </section>
      </main>
    </div>
  );
}
