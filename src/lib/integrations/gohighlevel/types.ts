export type GhlPipeline = {
  id: string;
  name: string;
  stages?: {
    id: string;
    name: string;
    position?: number;
  }[];
};

export type GhlPipelinesResponse = {
  pipelines?: GhlPipeline[];
};

export type GhlOpportunity = {
  id: string;
  name: string;
  monetaryValue?: number;
  pipelineId?: string;
  pipelineStageId?: string;
  status?: "open" | "won" | "lost" | "abandoned" | string;
  contactId?: string;
  assignedTo?: string;
  updatedAt?: string;
  createdAt?: string;
};

export type GhlOpportunitySearchResponse = {
  opportunities?: GhlOpportunity[];
  meta?: {
    total?: number;
    nextPage?: number;
    startAfterId?: string;
    currentPage?: number;
  };
};

export type GhlStoredCredential = {
  kind: "oauth" | "pit";
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  locationId: string;
};
