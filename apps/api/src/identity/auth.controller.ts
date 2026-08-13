import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';

import { API_CONFIG, type ApiConfig } from '../config.js';
import { Public } from '../security/metadata.js';
import type { AuthenticatedRequest } from '../security/request.js';
import { CSRF_COOKIE, SESSION_COOKIE } from '../security/session.guard.js';
import { AuthService } from './auth.service.js';

const loginSchema = z.object({
  email: z.email().trim().max(254),
  password: z.string().min(1).max(256),
}).strict();

function cookie(
  name: string,
  value: string,
  config: ApiConfig,
  options: { readonly expiresAt?: Date; readonly httpOnly: boolean; readonly path: string },
): string {
  const attributes = [
    `${name}=${encodeURIComponent(value)}`,
    'SameSite=Lax',
    `Path=${options.path}`,
  ];
  if (options.httpOnly) attributes.push('HttpOnly');
  if (config.production) attributes.push('Secure');
  if (options.expiresAt !== undefined) attributes.push(`Expires=${options.expiresAt.toUTCString()}`);
  else attributes.push('Max-Age=0');
  return attributes.join('; ');
}

@Controller('auth')
export class AuthController {
  public constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(API_CONFIG) private readonly config: ApiConfig,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  public async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<object> {
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) throw new UnauthorizedException('Invalid credentials or unavailable account.');
    const result = await this.authService.login(parsed.data.email, parsed.data.password);
    response.setHeader('Set-Cookie', [
      cookie(SESSION_COOKIE, result.sessionToken, this.config, {
        expiresAt: result.expiresAt,
        httpOnly: true,
        path: '/api/v1',
      }),
      cookie(CSRF_COOKIE, result.csrfToken, this.config, {
        expiresAt: result.expiresAt,
        httpOnly: false,
        path: '/',
      }),
    ]);
    response.setHeader('Cache-Control', 'no-store');
    return {
      actor: {
        displayName: result.actor.displayName,
        id: result.actor.id,
        role: result.actor.role,
      },
      csrfToken: result.csrfToken,
      expiresAt: result.expiresAt.toISOString(),
    };
  }

  @Get('me')
  public me(@Req() request: AuthenticatedRequest): object {
    if (request.actor === undefined) throw new UnauthorizedException('Authentication is required.');
    return {
      displayName: request.actor.displayName,
      id: request.actor.id,
      role: request.actor.role,
    };
  }

  @Post('logout')
  @HttpCode(204)
  public async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    if (request.actor === undefined) throw new UnauthorizedException('Authentication is required.');
    await this.authService.logout(request.actor.sessionId);
    response.setHeader('Set-Cookie', [
      cookie(SESSION_COOKIE, '', this.config, { httpOnly: true, path: '/api/v1' }),
      cookie(CSRF_COOKIE, '', this.config, { httpOnly: false, path: '/' }),
    ]);
    response.setHeader('Cache-Control', 'no-store');
  }
}
