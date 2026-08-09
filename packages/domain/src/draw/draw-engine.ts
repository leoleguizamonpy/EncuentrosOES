import { createHash, createHmac, randomBytes } from 'node:crypto';

import { groupLabel, planGroupDistribution } from '../competition/group-distribution.js';
import { canonicalize, type CanonicalJsonValue } from '../crypto/canonical-json.js';
import { DomainError } from '../errors/domain-error.js';
import { DrawConfiguration, type DrawConfigurationSnapshot } from './draw-configuration.js';

export interface GroupDrawResult {
  readonly formatCode: 'GROUP_STAGE';
  readonly groups: readonly Readonly<{
    label: string;
    members: readonly string[];
    ordinal: number;
  }>[];
}

export interface KnockoutDrawResult {
  readonly bye: Readonly<{ participantId: string; priorByeCount: number }> | null;
  readonly formatCode: 'KNOCKOUT';
  readonly pairings: readonly Readonly<{
    ordinal: number;
    participantAId: string;
    participantBId: string;
  }>[];
  readonly roundNumber: number;
}

export type DrawResult = GroupDrawResult | KnockoutDrawResult;

export interface DrawEvidence {
  readonly algorithmVersion: 'oes-draw-v1';
  readonly configurationHash: string;
  readonly configurationId: string;
  readonly evidenceHash: string;
  readonly result: DrawResult;
  readonly resultHash: string;
  readonly schemaVersion: 'oes-draw-evidence-v1';
  readonly seedCommitment: string;
}

const uint64Range = 1n << 64n;

function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function assertSeed(seed: Uint8Array): void {
  if (seed.byteLength !== 32) {
    throw new DomainError('DRAW_SEED_INVALID', 'Official draw seeds must contain 32 bytes.');
  }
}

class HmacRandomStream {
  readonly #context: Buffer;
  readonly #seed: Uint8Array;
  #block: Buffer = Buffer.alloc(0);
  #counter = 0n;
  #offset = 0;

  public constructor(seed: Uint8Array, domain: string, configurationHash: string) {
    this.#seed = seed;
    this.#context = Buffer.concat([
      Buffer.from('OES-DRAW-RNG-v1'),
      Buffer.from([0]),
      Buffer.from(domain),
      Buffer.from([0]),
      Buffer.from(configurationHash, 'hex'),
    ]);
  }

  public randomInt(maximum: number): number {
    if (!Number.isSafeInteger(maximum) || maximum <= 0) {
      throw new DomainError('DRAW_EVIDENCE_INVALID', 'Random integer bound must be positive.');
    }
    if (maximum === 1) return 0;
    const divisor = BigInt(maximum);
    const limit = (uint64Range / divisor) * divisor;
    let value: bigint;
    do value = this.#nextUInt64();
    while (value >= limit);
    return Number(value % divisor);
  }

  #nextUInt64(): bigint {
    if (this.#offset + 8 > this.#block.length) {
      const counter = Buffer.alloc(8);
      counter.writeBigUInt64BE(this.#counter);
      this.#counter += 1n;
      this.#block = createHmac('sha256', this.#seed)
        .update(this.#context)
        .update(counter)
        .digest();
      this.#offset = 0;
    }
    const value = this.#block.readBigUInt64BE(this.#offset);
    this.#offset += 8;
    return value;
  }
}

function shuffle<T>(items: readonly T[], stream: HmacRandomStream): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = stream.randomInt(index + 1);
    [result[index], result[target]] = [result[target] as T, result[index] as T];
  }
  return result;
}

function generateGroups(configuration: DrawConfigurationSnapshot, seed: Uint8Array): GroupDrawResult {
  if (configuration.groupCount === null) {
    throw new DomainError('DRAW_EVIDENCE_INVALID', 'Group count is required.');
  }
  const plan = planGroupDistribution(configuration.participantCount, configuration.groupCount);
  const shuffled = shuffle(
    configuration.participants.map(({ id }) => id),
    new HmacRandomStream(seed, 'group-participants', configuration.canonicalHash ?? ''),
  );
  let offset = 0;
  return Object.freeze({
    formatCode: 'GROUP_STAGE',
    groups: Object.freeze(
      plan.groups.map(({ index, size }) => {
        const members = Object.freeze(shuffled.slice(offset, offset + size));
        offset += size;
        return Object.freeze({ label: groupLabel(index), members, ordinal: index + 1 });
      }),
    ),
  });
}

function generateKnockout(
  configuration: DrawConfigurationSnapshot,
  seed: Uint8Array,
): KnockoutDrawResult {
  let participants = [...configuration.participants];
  let bye: KnockoutDrawResult['bye'] = null;
  if (participants.length % 2 === 1) {
    const minimum = Math.min(...participants.map(({ byeCount }) => byeCount));
    const eligible = participants.filter(({ byeCount }) => byeCount === minimum);
    const index = new HmacRandomStream(
      seed,
      `knockout-bye:R${String(configuration.roundNumber)}`,
      configuration.canonicalHash ?? '',
    ).randomInt(eligible.length);
    const selected = eligible[index];
    if (selected === undefined) {
      throw new DomainError('DRAW_EVIDENCE_INVALID', 'Unable to select a bye.');
    }
    bye = Object.freeze({ participantId: selected.id, priorByeCount: selected.byeCount });
    participants = participants.filter(({ id }) => id !== selected.id);
  }
  const shuffled = shuffle(
    participants,
    new HmacRandomStream(
      seed,
      `knockout-pairings:R${String(configuration.roundNumber)}`,
      configuration.canonicalHash ?? '',
    ),
  );
  const pairings: KnockoutDrawResult['pairings'][number][] = [];
  for (let index = 0; index < shuffled.length; index += 2) {
    const participantA = shuffled[index];
    const participantB = shuffled[index + 1];
    if (participantA === undefined || participantB === undefined) {
      throw new DomainError('DRAW_EVIDENCE_INVALID', 'Incomplete knockout pairing.');
    }
    pairings.push(
      Object.freeze({
        ordinal: pairings.length + 1,
        participantAId: participantA.id,
        participantBId: participantB.id,
      }),
    );
  }
  return Object.freeze({
    bye,
    formatCode: 'KNOCKOUT',
    pairings: Object.freeze(pairings),
    roundNumber: configuration.roundNumber,
  });
}

export function generateOfficialSeed(): Uint8Array {
  return randomBytes(32);
}

export function commitOfficialSeed(
  configuration: DrawConfigurationSnapshot,
  seed: Uint8Array,
): string {
  assertSeed(seed);
  DrawConfiguration.rehydrate(configuration);
  if (configuration.status !== 'FROZEN' || configuration.canonicalHash === null) {
    throw new DomainError('DRAW_EVIDENCE_INVALID', 'Official configuration must be frozen.');
  }
  return sha256(
    Buffer.concat([
      Buffer.from('OES-SEED-COMMIT-v1'),
      Buffer.from([0]),
      Buffer.from(configuration.canonicalHash, 'hex'),
      seed,
    ]),
  );
}

export function executeOfficialDraw(
  configuration: DrawConfigurationSnapshot,
  seed: Uint8Array,
): DrawEvidence {
  const seedCommitment = commitOfficialSeed(configuration, seed);
  const result =
    configuration.formatCode === 'GROUP_STAGE'
      ? generateGroups(configuration, seed)
      : generateKnockout(configuration, seed);
  const resultHash = sha256(canonicalize(result as unknown as CanonicalJsonValue));
  const payload = {
    algorithmVersion: 'oes-draw-v1' as const,
    configurationHash: configuration.canonicalHash ?? '',
    configurationId: configuration.id,
    result,
    resultHash,
    schemaVersion: 'oes-draw-evidence-v1' as const,
    seedCommitment,
  };
  return Object.freeze({
    ...payload,
    evidenceHash: sha256(canonicalize(payload as unknown as CanonicalJsonValue)),
  });
}

export function verifyOfficialDraw(
  configuration: DrawConfigurationSnapshot,
  seed: Uint8Array,
  evidence: DrawEvidence,
): boolean {
  try {
    const reproduced = executeOfficialDraw(configuration, seed);
    return (
      canonicalize(reproduced as unknown as CanonicalJsonValue) ===
      canonicalize(evidence as unknown as CanonicalJsonValue)
    );
  } catch {
    return false;
  }
}
