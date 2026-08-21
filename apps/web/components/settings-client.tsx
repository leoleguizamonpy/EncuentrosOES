'use client';

import { useEffect, useState } from 'react';

import { runtimeSettings, type SafeRuntimeSettings } from '../lib/settings-api';
import { AppShell } from './app-shell';
import styles from './institutions.module.css';
import { SessionBoundary } from './session-boundary';

const SETTINGS_ROLES = ['SUPERADMIN'] as const;

function SettingsWorkspace(): React.JSX.Element {
  const [settings, setSettings] = useState<SafeRuntimeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reload(): Promise<void> {
    setError(null);
    const value = await runtimeSettings();
    setSettings(value);
  }

  useEffect(() => {
    let mounted = true;
    void runtimeSettings()
      .then((value) => { if (mounted) setSettings(value); })
      .catch((caught: unknown) => { if (mounted) setError(caught instanceof Error ? caught.message : 'No fue posible cargar la configuración.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  if (loading) return <div className="empty-state"><strong>Cargando configuración…</strong><p>Consultando la política operativa segura del sistema.</p></div>;
  if (settings === null) return <div className="empty-state"><strong>No fue posible cargar Configuración.</strong><p>{error ?? 'Revisa la conexión con el servidor.'}</p><button className={styles.primaryButton} onClick={() => { setLoading(true); void reload().finally(() => setLoading(false)); }} type="button">Reintentar</button></div>;

  return <div className={styles.workspace}>
    <section className={styles.heading}>
      <div><span className="eyebrow eyebrow--dark">Control · Superadministración</span><h2>Configuración</h2><p>Política operativa efectiva del sistema. Estos valores provienen del entorno de despliegue y son deliberadamente de solo lectura: Foundation no autoriza una segunda fuente de configuración global ni la exposición de secretos.</p></div>
    </section>
    <section aria-label="Estado de configuración" style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
      <span className={[styles.status, styles.active].filter(Boolean).join(' ')}>{settings.runtimeMode === 'PRODUCTION' ? 'Producción' : 'No producción'}</span>
      <span className={[styles.status, styles.inactive].filter(Boolean).join(' ')}>Fuente: entorno</span>
      <span className={[styles.status, styles.inactive].filter(Boolean).join(' ')}>Solo lectura</span>
    </section>
    {error === null ? null : <p className={styles.error} role="alert">{error}</p>}
    <section aria-label="Política operativa" className={styles.tableCard}>
      <div className={styles.tableHeader}><span>Parámetro</span><span>Valor efectivo</span><span>Gobierno</span><span>Observación</span><span /></div>
      <article className={styles.row}><strong>Sesión inactiva</strong><span>{settings.sessionIdleMinutes} minutos</span><span className={styles.status}>Entorno</span><span>Expira una sesión sin actividad.</span><span /></article>
      <article className={styles.row}><strong>Duración absoluta</strong><span>{settings.sessionAbsoluteMinutes} minutos</span><span className={styles.status}>Entorno</span><span>Límite máximo de una sesión autenticada.</span><span /></article>
      <article className={styles.row}><strong>Origen web</strong><span>{settings.webOrigin}</span><span className={styles.status}>Entorno</span><span>Origen autorizado para la aplicación web.</span><span /></article>
      <article className={styles.row}><strong>Puerto API</strong><span>{settings.apiPort}</span><span className={styles.status}>Entorno</span><span>Puerto efectivo del servicio API.</span><span /></article>
    </section>
    <div className="empty-state" style={{ marginTop: 18 }}><strong>Las reglas competitivas no se editan aquí.</strong><p>Puntuación, desempates, formato y participantes se configuran y congelan dentro de cada competencia para conservar trazabilidad y una única fuente de verdad.</p></div>
  </div>;
}

export function SettingsClient(): React.JSX.Element {
  return <SessionBoundary allowedRoles={SETTINGS_ROLES}>{(actor) => <AppShell actor={actor} active="settings" title="Configuración"><SettingsWorkspace /></AppShell>}</SessionBoundary>;
}
