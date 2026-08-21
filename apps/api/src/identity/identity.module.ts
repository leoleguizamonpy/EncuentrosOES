import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { IDENTITY_STORE } from './identity-store.js';
import { PrismaIdentityStore } from './prisma-identity-store.js';
import { UsersAdminController } from './users-admin.controller.js';
import { UsersAdminService } from './users-admin.service.js';

@Module({
  controllers: [AuthController, UsersAdminController],
  exports: [AuthService],
  providers: [
    AuthService,
    PrismaIdentityStore,
    UsersAdminService,
    { provide: IDENTITY_STORE, useExisting: PrismaIdentityStore },
  ],
})
export class IdentityModule {}
