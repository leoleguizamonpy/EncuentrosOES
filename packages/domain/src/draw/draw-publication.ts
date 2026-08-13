import { createHash } from 'node:crypto';

import { canonicalize, type CanonicalJsonValue } from '../crypto/canonical-json.js';

export type PublicDrawResult =
  | Readonly<{
      formatCode: 'GROUP_STAGE';
      groups: readonly Readonly<{
        label: string;
        members: readonly Readonly<{ id: string; name: string }>[];
        ordinal: number;
      }>[];
    }>
  | Readonly<{
      bye: Readonly<{ participant: Readonly<{ id: string; name: string }>; priorByeCount: number }> | null;
      formatCode: 'KNOCKOUT';
      pairings: readonly Readonly<{
        ordinal: number;
        participantA: Readonly<{ id: string; name: string }>;
        participantB: Readonly<{ id: string; name: string }>;
      }>[];
      roundNumber: number;
    }>;

export interface PublicDrawAct {
  readonly algorithmVersion: string;
  readonly competition: Readonly<{
    edition: string;
    event: string;
    id: string;
    modality: string;
    sport: string;
  }>;
  readonly configuration: Readonly<{
    canonicalHash: string;
    formatCode: 'GROUP_STAGE' | 'KNOCKOUT';
    groupCount: number | null;
    id: string;
    participantCount: number;
    roundNumber: number;
    ruleSetHash: string;
    ruleSetId: string;
  }>;
  readonly confirmedAt: string;
  readonly evidenceHash: string;
  readonly officialDrawId: string;
  readonly participants: readonly Readonly<{
    byeCount: number;
    id: string;
    name: string;
  }>[];
  readonly publicationId: string;
  readonly publishedAt: string;
  readonly result: PublicDrawResult;
  readonly schemaVersion: 'oes-public-draw-act-v1';
  readonly seedHex: string;
}

export function publicDrawVerificationCode(act: PublicDrawAct): string {
  return createHash('sha256')
    .update(canonicalize(act as unknown as CanonicalJsonValue), 'utf8')
    .digest('hex');
}

export function verifyPublicDrawAct(act: PublicDrawAct, verificationCode: string): boolean {
  return /^[0-9a-f]{64}$/.test(verificationCode) && publicDrawVerificationCode(act) === verificationCode;
}
