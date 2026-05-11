import type { IntegrationDefinition, IntegrationProvider } from "./types";

const registry: Record<IntegrationProvider, IntegrationDefinition> = {
  gohighlevel: {
    id: "gohighlevel",
    displayName: "GoHighLevel",
    category: "crm",
    docsUrl: "https://highlevel.stoplight.io/docs/integrations/",
  },
  trackio: {
    id: "trackio",
    displayName: "Trackio",
    category: "crm",
  },
  youtube: {
    id: "youtube",
    displayName: "YouTube Data API",
    category: "social",
    docsUrl: "https://developers.google.com/youtube/v3",
  },
  instagram: {
    id: "instagram",
    displayName: "Instagram Graph API",
    category: "social",
    docsUrl: "https://developers.facebook.com/docs/instagram-api/",
  },
  tiktok: {
    id: "tiktok",
    displayName: "TikTok API",
    category: "social",
  },
  discord: {
    id: "discord",
    displayName: "Discord",
    category: "social",
    docsUrl: "https://discord.com/developers/docs/intro",
  },
  airtable: {
    id: "airtable",
    displayName: "Airtable",
    category: "data",
    docsUrl: "https://airtable.com/developers/web/api/introduction",
  },
  zapier: {
    id: "zapier",
    displayName: "Zapier",
    category: "automation",
  },
  apify: {
    id: "apify",
    displayName: "Apify",
    category: "scraping",
    docsUrl: "https://docs.apify.com/",
  },
  n8n: {
    id: "n8n",
    displayName: "n8n",
    category: "automation",
    docsUrl: "https://docs.n8n.io/",
  },
  make: {
    id: "make",
    displayName: "Make",
    category: "automation",
    docsUrl: "https://www.make.com/en/api-documentation",
  },
};

export function listIntegrations(): IntegrationDefinition[] {
  return Object.values(registry);
}

export function getIntegration(
  id: IntegrationProvider,
): IntegrationDefinition | undefined {
  return registry[id];
}
