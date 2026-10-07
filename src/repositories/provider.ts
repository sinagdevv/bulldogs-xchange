import { AppError } from "../lib/errors.js";
import { GraphClient } from "../integrations/graph-client.js";
import { MicrosoftTokenProvider } from "../integrations/microsoft-token-provider.js";
import { createMockRepository, MockSharePointRepository } from "./mock-repository.js";
import { ProductionSharePointRepository } from "./production-sharepoint-repository.js";
import type { SharePointRepository } from "./repository.js";
export function createRepository(): SharePointRepository { const provider = process.env.DATA_PROVIDER ?? (process.env.NODE_ENV === "production" ? "sharepoint" : "mock"); if (provider === "mock") { if (process.env.NODE_ENV === "production") throw new AppError("CONFIGURATION_ERROR", "Mock data provider is disabled in production."); return createMockRepository(); } if (provider === "sharepoint") return new ProductionSharePointRepository(new GraphClient(new MicrosoftTokenProvider())); throw new AppError("CONFIGURATION_ERROR", "DATA_PROVIDER must be 'mock' or 'sharepoint'."); }
export const isMockRepository = (repo: SharePointRepository): repo is MockSharePointRepository => repo instanceof MockSharePointRepository;
