import { CosmosClient, type Container, type CosmosClientOptions } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";
import { Agent } from "node:https";

// Cosmos client is module-cached. Initialised lazily on first container access
// so module import is side-effect-free (route handler compilation never hits
// env-missing errors at build time).
let cached: CosmosClient | undefined;

function getClient(): CosmosClient {
  if (cached) return cached;
  const endpoint = process.env.COSMOS_ENDPOINT;
  if (!endpoint) throw new Error("COSMOS_ENDPOINT is not set");

  // Auth: key when COSMOS_KEY is set (dev / emulator), DefaultAzureCredential
  // otherwise (production: managed identity in App Service, az login locally).
  // No connection strings — production-grade from day one.
  const key = process.env.COSMOS_KEY;
  const opts: CosmosClientOptions = { endpoint };
  if (key) {
    opts.key = key;
  } else {
    opts.aadCredentials = new DefaultAzureCredential();
  }

  // Emulator ships with a self-signed cert that Node won't trust by default.
  // Bypass TLS verification only when pointing at the local emulator.
  const isEmulator =
    endpoint.includes("localhost") || endpoint.includes("127.0.0.1");
  if (isEmulator) {
    opts.agent = new Agent({ rejectUnauthorized: false }) as unknown as
      import("@azure/cosmos").Agent;
  }

  cached = new CosmosClient(opts);
  return cached;
}

export function boardsContainer(): Container {
  return getClient().database("retro-board").container("boards");
}

export function userStateContainer(): Container {
  return getClient().database("retro-board").container("userState");
}

// Cosmos system fields we don't want to leak to the client, except _etag —
// which we surface as `etag` so the client can echo it back on If-Match writes.
type CosmosInternalFields = "_rid" | "_self" | "_attachments" | "_ts" | "_etag";

export function stripSystemFields<T extends object>(
  doc: T,
): Omit<T, CosmosInternalFields> & { etag?: string } {
  const { _rid, _self, _attachments, _ts, _etag, ...rest } = doc as T &
    Record<string, unknown>;
  void _rid; void _self; void _attachments; void _ts;
  const out = rest as Omit<T, CosmosInternalFields> & { etag?: string };
  if (typeof _etag === "string") out.etag = _etag;
  return out;
}
