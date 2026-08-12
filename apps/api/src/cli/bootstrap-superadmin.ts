import 'reflect-metadata';

import { createPrismaClient } from '@oes/database';
import { z } from 'zod';

import { loadApiConfig } from '../config.js';
import { hashPassword } from '../identity/password.js';

const inputSchema = z.object({
  OES_BOOTSTRAP_DISPLAY_NAME: z.string().trim().min(2).max(120),
  OES_BOOTSTRAP_EMAIL: z.email().trim().max(254),
  OES_BOOTSTRAP_PASSWORD: z.string().min(12).max(256),
});

const config = loadApiConfig(process.env);
const input = inputSchema.parse(process.env);
const client = createPrismaClient(config.databaseUrl);

try {
  const emailNormalized = input.OES_BOOTSTRAP_EMAIL.toLocaleLowerCase('en-US');
  const existing = await client.user.findUnique({ where: { emailNormalized } });
  if (existing !== null) {
    throw new Error('The bootstrap account already exists; no changes were made.');
  }
  await client.user.create({
    data: {
      displayName: input.OES_BOOTSTRAP_DISPLAY_NAME,
      emailNormalized,
      passwordHash: await hashPassword(input.OES_BOOTSTRAP_PASSWORD),
      role: 'SUPERADMIN',
      status: 'ACTIVE',
    },
  });
  process.stdout.write(`Superadministrator created: ${emailNormalized}\n`);
} finally {
  await client.$disconnect();
}
