import { Module } from '@nestjs/common';

import { IDENTITY_STORE } from './identity-store.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PrismaIdentityStore } from './prisma-identity-store.js';

@Module({
  controllers: [AuthController],
  exports: [AuthService],
  providers: [
    AuthService,
    PrismaIdentityStore,
    { provide: IDENTITY_STORE, useExisting: PrismaIdentityStore },
  ],
})
export class IdentityModule {}
