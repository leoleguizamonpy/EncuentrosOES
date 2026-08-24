'use client';

import { Card, Chip } from '@heroui/react';

import { AppShell } from './app-shell';
import styles from './dashboard-client.module.css';
import { SessionBoundary } from './session-boundary';

function DashboardContent(): React.JSX.Element {
  return (
    <SessionBoundary>
      {(actor) => (
        <AppShell actor={actor} active="dashboard" eyebrow="Panel de autoridad" title="Centro de operaciones">
          <div className={styles.page}>
            <Card className={styles.hero} variant="tertiary">
              <Card.Content className={styles.heroContent}>
                <div className={styles.heroCopy}>
                  <Chip className={styles.sessionChip} color="success" size="sm" variant="soft">Sesión verificada</Chip>
                  <h2>Tu operación empieza desde un solo workspace.</h2>
                  <p>Organización, competencias y control se separan por tareas reales. Cada módulo tendrá su propia experiencia y el sistema te indicará siempre cuál es el siguiente paso permitido.</p>
                </div>
                <div className={styles.readiness} aria-label="Estado de módulos">
                  <div className={styles.readinessRow}><strong>Núcleo competitivo</strong><Chip color="success" size="sm" variant="soft">Operativo</Chip></div>
                  <div className={styles.readinessRow}><strong>UX administrativa</strong><Chip color="accent" size="sm" variant="soft">Visual 3.0</Chip></div>
                  <div className={styles.readinessRow}><strong>Experiencia pública</strong><Chip color="success" size="sm" variant="soft">Operativa</Chip></div>
                </div>
              </Card.Content>
            </Card>

            <section className={styles.guarantees} aria-label="Garantías del sistema">
              <Card className={styles.guaranteeCard}>
                <Card.Content className={styles.guaranteeContent}><span className={styles.index}>01</span><h3>Doble autoridad</h3><p>Quien registra una decisión oficial no puede confirmarla.</p></Card.Content>
              </Card>
              <Card className={styles.guaranteeCard}>
                <Card.Content className={styles.guaranteeContent}><span className={styles.index}>02</span><h3>Estado persistente</h3><p>Cada competencia puede retomarse desde el estado guardado en servidor.</p></Card.Content>
              </Card>
              <Card className={styles.guaranteeCard}>
                <Card.Content className={styles.guaranteeContent}><span className={styles.index}>03</span><h3>Siguiente acción clara</h3><p>La nueva experiencia prioriza tareas reales y evita exponer conceptos técnicos internos.</p></Card.Content>
              </Card>
            </section>
          </div>
        </AppShell>
      )}
    </SessionBoundary>
  );
}

export function DashboardClient(): React.JSX.Element {
  return <DashboardContent />;
}
