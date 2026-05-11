import "server-only";

import { GHL_API_BASE, GHL_API_VERSION, GHL_OAUTH_TOKEN_URL } from "./config";
import { GhlApiError, GhlRateLimitError } from "./errors";
import type {
  GhlOpportunity,
  GhlOpportunitySearchResponse,
  GhlPipeline,
  GhlPipelinesResponse,
  GhlStoredCredential,
} from "./types";

const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 400;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export type GhlClientOptions = {
  credential: GhlStoredCredential;
  clientId?: string;
  clientSecret?: string;
  onCredentialRotated?: (next: GhlStoredCredential) => Promise<void>;
};

export class GhlClient {
  private credential: GhlStoredCredential;
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly onCredentialRotated?: GhlClientOptions["onCredentialRotated"];

  constructor(opts: GhlClientOptions) {
    this.credential = opts.credential;
    this.clientId = opts.clientId;
    this.clientSecret = opts.clientSecret;
    this.onCredentialRotated = opts.onCredentialRotated;
  }

  get locationId() {
    return this.credential.locationId;
  }

  private async refreshAccessToken(): Promise<void> {
    if (this.credential.kind !== "oauth" || !this.credential.refreshToken) {
      throw new GhlApiError("Cannot refresh without OAuth refresh token", {
        status: 401,
        body: "",
      });
    }
    if (!this.clientId || !this.clientSecret) {
      throw new GhlApiError("Missing GHL OAuth client configuration", {
        status: 500,
        body: "",
      });
    }

    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: "refresh_token",
      refresh_token: this.credential.refreshToken,
    });

    const res = await fetch(GHL_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new GhlApiError("Failed to refresh GoHighLevel token", {
        status: res.status,
        body: text,
      });
    }
    const json = JSON.parse(text) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    const expiresAt =
      typeof json.expires_in === "number"
        ? new Date(Date.now() + json.expires_in * 1000).toISOString()
        : undefined;
    this.credential = {
      ...this.credential,
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? this.credential.refreshToken,
      expiresAt,
    };
    await this.onCredentialRotated?.(this.credential);
  }

  private isExpired(): boolean {
    if (!this.credential.expiresAt) return false;
    const t = Date.parse(this.credential.expiresAt);
    if (!Number.isFinite(t)) return false;
    return t < Date.now() + 60_000;
  }

  private async request<T>(
    path: string,
    init: RequestInit & { skipAuthRefresh?: boolean } = {},
  ): Promise<T> {
    if (this.credential.kind === "oauth" && this.isExpired()) {
      await this.refreshAccessToken();
    }

    const url = path.startsWith("http") ? path : `${GHL_API_BASE}${path}`;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const headers = new Headers(init.headers);
      headers.set("Authorization", `Bearer ${this.credential.accessToken}`);
      headers.set("Version", GHL_API_VERSION);
      if (init.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }

      const res = await fetch(url, { ...init, headers });
      const text = await res.text();

      if (res.status === 401 && this.credential.kind === "oauth" && !init.skipAuthRefresh) {
        await this.refreshAccessToken();
        return this.request<T>(path, { ...init, skipAuthRefresh: true });
      }

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after")) || attempt;
        if (attempt >= MAX_ATTEMPTS) {
          throw new GhlRateLimitError({ status: 429, body: text });
        }
        await sleep(retryAfter * 1000 + BASE_DELAY_MS * attempt);
        continue;
      }

      if (res.status >= 500 && attempt < MAX_ATTEMPTS) {
        await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }

      if (!res.ok) {
        throw new GhlApiError(`GoHighLevel API error (${res.status})`, {
          status: res.status,
          body: text,
          requestId: res.headers.get("x-request-id") ?? undefined,
        });
      }

      return (text ? JSON.parse(text) : {}) as T;
    }

    throw new GhlApiError("GoHighLevel request exhausted retries", {
      status: 0,
      body: "",
    });
  }

  async getPipelines(): Promise<GhlPipeline[]> {
    const qs = new URLSearchParams({ locationId: this.locationId });
    const json = await this.request<GhlPipelinesResponse>(
      `/opportunities/pipelines?${qs.toString()}`,
      { method: "GET" },
    );
    return json.pipelines ?? [];
  }

  async searchOpportunitiesPage(params: {
    pipelineId?: string;
    limit?: number;
    page?: number;
    startAfterId?: string;
    status?: string;
  }): Promise<GhlOpportunitySearchResponse> {
    const qs = new URLSearchParams({
      location_id: this.locationId,
      limit: String(params.limit ?? 100),
      page: String(params.page ?? 1),
    });
    if (params.pipelineId) qs.set("pipeline_id", params.pipelineId);
    if (params.startAfterId) qs.set("startAfterId", params.startAfterId);
    if (params.status) qs.set("status", params.status);

    return this.request<GhlOpportunitySearchResponse>(
      `/opportunities/search?${qs.toString()}`,
      { method: "GET" },
    );
  }

  async *searchAllOpportunities(params: {
    pipelineId?: string;
    status?: string;
  }): AsyncGenerator<GhlOpportunity[], void, void> {
    let page = 1;
    let startAfterId: string | undefined;
    for (;;) {
      const res = await this.searchOpportunitiesPage({
        ...params,
        page,
        startAfterId,
        limit: 100,
      });
      const batch = res.opportunities ?? [];
      if (batch.length === 0) break;
      yield batch;
      const nextStart = res.meta?.startAfterId;
      const nextPage = res.meta?.nextPage;
      if (nextStart) {
        startAfterId = nextStart;
        page = 1;
      } else if (nextPage && nextPage > page) {
        page = nextPage;
        startAfterId = undefined;
      } else if (batch.length < 100) {
        break;
      } else {
        startAfterId = batch[batch.length - 1]!.id;
      }
    }
  }

  async updateOpportunity(
    opportunityId: string,
    body: Partial<{
      pipelineStageId: string;
      status: GhlOpportunity["status"];
      pipelineId: string;
    }>,
  ): Promise<GhlOpportunity> {
    return this.request<GhlOpportunity>(`/opportunities/${opportunityId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  }
}
