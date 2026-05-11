import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  INTEGRATION_ENCRYPTION_KEY: z
    .string()
    .min(1)
    .optional()
    .describe("32-byte key as hex (64 chars) or base64"),
  GHL_OAUTH_CLIENT_ID: z.string().optional(),
  GHL_OAUTH_CLIENT_SECRET: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv(): ServerEnv {
  return serverEnvSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    INTEGRATION_ENCRYPTION_KEY: process.env.INTEGRATION_ENCRYPTION_KEY,
    GHL_OAUTH_CLIENT_ID: process.env.GHL_OAUTH_CLIENT_ID,
    GHL_OAUTH_CLIENT_SECRET: process.env.GHL_OAUTH_CLIENT_SECRET,
  });
}

export function isServiceRoleConfigured(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.length);
}

export function isIntegrationEncryptionConfigured(): boolean {
  return Boolean(process.env.INTEGRATION_ENCRYPTION_KEY?.length);
}
