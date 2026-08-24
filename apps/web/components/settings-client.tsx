'use client';

import { Card, Chip } from '@heroui/react';
import { useEffect, useState } from 'react';

import { runtimeSettings, type SafeRuntimeSettings } from '../lib/settings-api';
import { AppShell } from './app-shell';
import styles from './institutions.module.css';
import { SessionBoundary } from './session-boundary';
import { WorkspaceState } from './workspace-state';

const SETTINGS_ROLES = ['SUPERADMIN'] as const;

function SettingsWorkspace(): React.JSX.Element {
  const [settings, setSettings] = useState<SafeRuntimeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reload(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      setSettings(await runtimeSettings());
    } catch (caught: unknown) {
      setSettings(null);
      setError(caught instanceof Error ? caught.message : 'No fue posible cargar la configuración.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    void runtimeSettings()
      .then((value) => { if (mounted) setSettings(value); })
      .catch((caught: unknown) => { if (mounted) setError(caught instanceof Error ? caught.message : 'No fue posible cargar la configuración.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  if (loading) return <WorkspaceState detail="Consultando la política operativa segura del sistema." title="Cargando configuración…" />;
  if (settings === null) return <WorkspaceState detail={error ?? 'Revisa la conexión con el servidor.'} onAction={() => void reload()} title="No fue posible cargar Configuración." tone="error" />;

  return <div className={styles.workspace}>
    <section className={styles.heading}>
      <div><span className="eyebrow eyebrow--dark">Control · Superadministración</span><h2>Configuración</h2><p>Política operativa efectiva del sistema. Estos valores provienen del entorno de despliegue y son deliberadamente de solo lectura: Foundation no autoriza una segunda fuente de configuración global ni la exposición de secretos.</p></div>
    </section>
    <section aria-label="Estado de configuración" style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
      <Chip color={settings.runtimeMode === 'PRODUCTION' ? 'success' : 'warning'} size="sm" variant="soft">{settings.runtimeMode === 'PRODUCTION' ? 'Producción' : 'No producción'}</Chip>
      <Chip color="default" size="sm" variant="soft">Fuente: entorno</Chip>
      <Chip color="default" size="sm" variant="soft">Solo lectura</Chip>
    </section>
    <Card className={styles.tableCard ?? ''} aria-label="Política operativa">
      <Card.Content style={{ padding: 0 }}>
        <div className={styles.tableHeader}><span>Parámetro</span><span>Valor efectivo</span><span>Gobierno</span><span>Observación</span><span /></div>
        <article className={styles.row}><strong>Sesión inactiva</strong><span>{settings.sessionIdleMinutes} minutos</span><Chip size="sm" variant="soft">Entorno</Chip><span>Expira una sesión sin actividad.</span><span /></article>
        <article className={styles.row}><strong>Duración absoluta</strong><span>{settings.sessionAbsoluteMinutes} minutos</span><Chip size="sm" variant="soft">Entorno</Chip><span>Límite máximo de una sesión autenticada.</span><span /></article>
        <article className={styles.row}><strong>Origen web</strong><span>{settings.webOrigin}</span><Chip size="sm" variant="soft">Entorno</Chip><span>Origen autorizado para la aplicación web.</span><span /></article>
        <article className={styles.row}><strong>Puerto API</strong><span>{settings.apiPort}</span><Chip size="sm" variant="soft">Entorno</Chip><span>Puerto efectivo del servicio API.</span><span /></article>
      </Card.Content>
    </Card>
    <Card variant="tertiary" style={{ marginTop: 18 }}><Card.Content style={{ padding: 24 }}><strong>Las reglas competitivas no se editan aquí.</strong><p style={{ color: 'var(--muted-foreground)', marginBottom: 0 }}>Puntuación, desempates, formato y participantes se configuran y congelan dentro de cada competencia para conservar trazabilidad y una única fuente de verdad.</p></Card.Content></Card>
  </div>;
}

export function SettingsClient(): React.JSX.Element {
  return <SessionBoundary allowedRoles={SETTINGS_ROLES}>{(actor) => <AppShell actor={actor} active="settings" title="Configuración"><SettingsWorkspace /></AppShell>}</SessionBoundary>;
}
