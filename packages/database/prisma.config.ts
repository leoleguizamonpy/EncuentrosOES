import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const developmentUrl = 'postgresql://oes:oes@localhost:5432/oes?schema=public';

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL ?? developmentUrl,
  },
  migrations: {
    path: 'prisma/migrations',
  },
  schema: 'prisma/schema.prisma',
});
