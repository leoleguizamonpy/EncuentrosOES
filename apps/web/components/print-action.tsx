'use client';

interface PrintActionProps {
  readonly label?: string;
}

export function PrintAction({ label = 'Imprimir' }: PrintActionProps): React.JSX.Element {
  return (
    <button
      aria-label={label}
      className="print-action no-print"
      onClick={() => window.print()}
      type="button"
    >
      {label}
    </button>
  );
}
