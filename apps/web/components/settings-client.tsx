'use client';

import { useEffect, useState } from 'react';

import { runtimeSettings, type SafeRuntimeSettings } from '../lib/settings-api';
import { DataList, DataRow, PageHeader, PageLayout, Panel, StatusBadge, StatusSummary } from '../ui';
import { AppShell } from './app-shell';
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

  return <PageLayout>
    <PageHeader eyebrow="Control · Superadministración" title="Configuración" description="Consulta la política operativa efectiva del sistema, gobernada exclusivamente por el entorno de despliegue." />
    <StatusSummary label="Estado de configuración">
      <StatusBadge label={settings.runtimeMode === 'PRODUCTION' ? 'Producción' : 'No producción'} tone={settings.runtimeMode === 'PRODUCTION' ? 'success' : 'warning'} />
      <StatusBadge label="Fuente: entorno" />
      <StatusBadge label="Solo lectura" />
    </StatusSummary>
    <DataList label="Política operativa">
      <DataRow visual="SI" title="Sesión inactiva" description="Expira una sesión sin actividad." meta={`${String(settings.sessionIdleMinutes)} minutos`} status={<StatusBadge label="Entorno" />} />
      <DataRow visual="DA" title="Duración absoluta" description="Límite máximo de una sesión autenticada." meta={`${String(settings.sessionAbsoluteMinutes)} minutos`} status={<StatusBadge label="Entorno" />} />
      <DataRow visual="OW" title="Origen web" description="Origen autorizado para la aplicación web." meta={settings.webOrigin} status={<StatusBadge label="Entorno" />} />
      <DataRow visual="AP" title="Puerto API" description="Puerto efectivo del servicio API." meta={String(settings.apiPort)} status={<StatusBadge label="Entorno" />} />
    </DataList>
    <Panel padded>
      <strong>Las reglas competitivas no se editan aquí.</strong>
      <p>Puntuación, desempates, formato y participantes se configuran y congelan dentro de cada competencia para conservar trazabilidad y una única fuente de verdad.</p>
    </Panel>
  </PageLayout>;
}

export function SettingsClient(): React.JSX.Element {
  return <SessionBoundary allowedRoles={SETTINGS_ROLES}>{(actor) => <AppShell actor={actor} active="settings" title="Configuración"><SettingsWorkspace /></AppShell>}</SessionBoundary>;
}
