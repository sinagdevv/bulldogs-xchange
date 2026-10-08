import { AppError } from "../lib/errors.js";
import { GraphClient } from "../integrations/graph-client.js";
import { MicrosoftTokenProvider } from "../integrations/microsoft-token-provider.js";
import { createMockRepository, MockSharePointRepository } from "./mock-repository.js";
import { ProductionSharePointRepository } from "./production-sharepoint-repository.js";
import { PowerAutomateRepository } from "./power-automate-repository.js";
import type { SharePointRepository } from "./repository.js";
import { SqlServerConnectionManager } from "../integrations/sql-server.js";
import { SqlServerRepository } from "./sql-server-repository.js";
import { PostgresConnectionManager } from "../integrations/postgres.js";
export function createRepository(): SharePointRepository { const provider = process.env.DATA_PROVIDER ?? (process.env.NODE_ENV === "production" ? "supabase" : "mock"); if (provider === "mock") { if (process.env.NODE_ENV === "production") throw new AppError("CONFIGURATION_ERROR", "Mock data provider is disabled in production."); return createMockRepository(); } if (provider === "sharepoint") return new ProductionSharePointRepository(new GraphClient(new MicrosoftTokenProvider())); if (provider === "powerautomate") return new PowerAutomateRepository(); if (provider === "sqlserver") return new SqlServerRepository(new SqlServerConnectionManager()); if(provider==="supabase"||provider==="postgres") return new SqlServerRepository(new PostgresConnectionManager()); throw new AppError("CONFIGURATION_ERROR", "Unsupported DATA_PROVIDER."); }
export const isMockRepository = (repo: SharePointRepository): repo is MockSharePointRepository => repo instanceof MockSharePointRepository;
