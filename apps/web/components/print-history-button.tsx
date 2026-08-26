'use client';

import { Button } from '@heroui/react';

export function PrintHistoryButton(): React.JSX.Element {
  function printHistory(): void {
    window.print();
  }

  return <Button onPress={printHistory} size="sm" variant="secondary">Imprimir historial</Button>;
}
