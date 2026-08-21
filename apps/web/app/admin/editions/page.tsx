import type { Metadata } from 'next';

import { EditionsClient } from '../../../components/editions-client';

export const metadata: Metadata = { title: 'Ediciones | OES' };

export default function EditionsPage(): React.JSX.Element {
  return <EditionsClient />;
}
