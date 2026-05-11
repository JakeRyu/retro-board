import { CosmosClient, type Container } from "@azure/cosmos";
import { Agent } from "node:https";

// Cosmos client is module-cached. Initialised lazily on first container access
// so module import is side-effect-free (route handler compilation never hits
// env-missing errors at build time).
let cached: CosmosClient | undefined;

function getClient(): CosmosClient {
  if (cached) return cached;
  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;
  if (!endpoint) throw new Error("COSMOS_ENDPOINT is not set");
  if (!key) throw new Error("COSMOS_KEY is not set");

  // Emulator ships with a self-signed cert that Node won't trust by default.
  // Bypass TLS verification only when pointing at the local emulator; never
  // in production (managed identity + real cert in F-26-E).
  const isEmulator =
    endpoint.includes("localhost") || endpoint.includes("127.0.0.1");
  const agent = isEmulator
    ? (new Agent({ rejectUnauthorized: false }) as unknown as import("@azure/cosmos").Agent)
    : undefined;

  cached = new CosmosClient({ endpoint, key, agent });
  return cached;
}

export function boardsContainer(): Container {
  return getClient().database("retro-board").container("boards");
}

export function userStateContainer(): Container {
  return getClient().database("retro-board").container("userState");
}

// Cosmos system fields we don't want to leak to the client.
export type CosmosSystemFields = "_rid" | "_self" | "_attachments" | "_ts" | "_etag";

export function stripSystemFields<T extends Record<string, unknown>>(
  doc: T,
): Omit<T, CosmosSystemFields> {
  const { _rid, _self, _attachments, _ts, _etag, ...rest } = doc;
  void _rid; void _self; void _attachments; void _ts; void _etag;
  return rest;
}
