/**
 * Integration contracts — adapters map external systems into normalized shapes.
 * Keep secrets server-side; persist connection status in `integrations` rows.
 */

export type IntegrationProvider =
  | "gohighlevel"
  | "trackio"
  | "youtube"
  | "instagram"
  | "tiktok"
  | "discord"
  | "airtable"
  | "zapier"
  | "apify"
  | "n8n"
  | "make";

export type IntegrationHealth = "connected" | "disconnected" | "degraded";

export type IntegrationDefinition = {
  id: IntegrationProvider;
  displayName: string;
  category: "crm" | "social" | "data" | "automation" | "scraping";
  docsUrl?: string;
};

export type NormalizedPipeline = {
  externalId: string;
  name: string;
  stages: { id: string; name: string }[];
};

export type NormalizedLead = {
  externalId: string;
  pipelineExternalId: string;
  stageExternalId: string;
  name: string;
  email?: string;
  valueCents?: number;
  updatedAt: string;
  raw: Record<string, unknown>;
};
