'use client';

interface WorkspaceStateProps {
  readonly actionLabel?: string;
  readonly detail: string;
  readonly onAction?: () => void;
  readonly title: string;
  readonly tone?: 'neutral' | 'error';
}

export function WorkspaceState({ actionLabel = 'Reintentar', detail, onAction, title, tone = 'neutral' }: WorkspaceStateProps): React.JSX.Element {
  return <div className="empty-state" role={tone === 'error' ? 'alert' : 'status'} aria-live="polite">
    <strong>{title}</strong>
    <p>{detail}</p>
    {onAction === undefined ? null : <button className="primary-button" onClick={onAction} type="button">{actionLabel}</button>}
  </div>;
}
