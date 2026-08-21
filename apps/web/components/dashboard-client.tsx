'use client';

import { AppShell } from './app-shell';
import { SessionBoundary } from './session-boundary';

function DashboardContent(): React.JSX.Element {
  return (
    <SessionBoundary>
      {(actor) => (
        <AppShell actor={actor} active="dashboard" eyebrow="Panel de autoridad" title="Centro de operaciones">
          <section className="welcome-panel">
            <div>
              <span className="status-pill"><i /> Sesión verificada</span>
              <h2>Tu operación empieza desde un solo workspace.</h2>
              <p>Organización, competencias y control se separan por tareas reales. Cada módulo tendrá su propia experiencia y el sistema te indicará siempre cuál es el siguiente paso permitido.</p>
            </div>
            <div className="readiness" aria-label="Estado de módulos">
              <div><strong>Núcleo competitivo</strong><span className="ready">Operativo</span></div>
              <div><strong>UX administrativa</strong><span>En construcción</span></div>
              <div><strong>Experiencia pública</strong><span className="ready">Operativa</span></div>
            </div>
          </section>
          <section className="principles-grid" aria-label="Garantías del sistema">
            <article><span>01</span><h3>Doble autoridad</h3><p>Quien registra una decisión oficial no puede confirmarla.</p></article>
            <article><span>02</span><h3>Estado persistente</h3><p>Cada competencia puede retomarse desde el estado guardado en servidor.</p></article>
            <article><span>03</span><h3>Siguiente acción clara</h3><p>La nueva experiencia prioriza tareas reales y evita exponer conceptos técnicos internos.</p></article>
          </section>
        </AppShell>
      )}
    </SessionBoundary>
  );
}

export function DashboardClient(): React.JSX.Element {
  return <DashboardContent />;
}
