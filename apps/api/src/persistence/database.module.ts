import {
  Global,
  Inject,
  Injectable,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { createPrismaClient, type PrismaClient } from '@oes/database';

import { API_CONFIG, type ApiConfig } from '../config.js';
import { ApiConfigModule } from '../config.module.js';

export const PRISMA_CLIENT = Symbol('PRISMA_CLIENT');

@Injectable()
class PrismaShutdown implements OnApplicationShutdown {
  public constructor(@Inject(PRISMA_CLIENT) private readonly client: PrismaClient) {}

  public async onApplicationShutdown(): Promise<void> {
    await this.client.$disconnect();
  }
}

@Global()
@Module({
  exports: [PRISMA_CLIENT],
  imports: [ApiConfigModule],
  providers: [
    {
      inject: [API_CONFIG],
      provide: PRISMA_CLIENT,
      useFactory: (config: ApiConfig): PrismaClient => createPrismaClient(config.databaseUrl),
    },
    PrismaShutdown,
  ],
})
export class DatabaseModule {}
