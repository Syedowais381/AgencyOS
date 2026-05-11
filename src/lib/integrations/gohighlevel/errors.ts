export class GhlApiError extends Error {
  readonly status: number;
  readonly body: string;
  readonly requestId?: string;

  constructor(message: string, opts: { status: number; body: string; requestId?: string }) {
    super(message);
    this.name = "GhlApiError";
    this.status = opts.status;
    this.body = opts.body;
    this.requestId = opts.requestId;
  }
}

export class GhlRateLimitError extends GhlApiError {
  constructor(opts: { status: number; body: string; retryAfterMs?: number }) {
    super("GoHighLevel rate limited the request", opts);
    this.name = "GhlRateLimitError";
  }
}
