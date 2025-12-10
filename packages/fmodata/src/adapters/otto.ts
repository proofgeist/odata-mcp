import { BaseFetchAdapter } from "./fetch-base.js";
import type { BaseFetchAdapterOptions } from "./fetch-base-types.js";
import type { BaseRequestOptions } from "./core.js";
import type { ODataResponse, ODataTable } from "../client-types.js";

export type Otto3APIKey = `KEY_${string}`;
export type OttoFMSAPIKey = `dk_${string}`;
export type OttoAPIKey = Otto3APIKey | OttoFMSAPIKey;

export function isOtto3APIKey(key: string): key is Otto3APIKey {
  return key.startsWith("KEY_");
}

export function isOttoFMSAPIKey(key: string): key is OttoFMSAPIKey {
  return key.startsWith("dk_");
}

export function isOttoAPIKey(key: string): key is OttoAPIKey {
  return isOtto3APIKey(key) || isOttoFMSAPIKey(key);
}

export function isOttoAuth(auth: unknown): auth is OttoAuth {
  if (typeof auth !== "object" || auth === null) return false;
  return "apiKey" in auth;
}

type OttoAuth =
  | {
      apiKey: Otto3APIKey;
      ottoPort?: number;
    }
  | { apiKey: OttoFMSAPIKey; ottoPort?: never };

export type OttoAdapterOptions = BaseFetchAdapterOptions & {
  auth: OttoAuth;
};

/**
 * Otto adapter using API key authentication
 * Supports both Otto v3 (KEY_*) and OttoFMS (dk_*)
 */
export class OttoAdapter extends BaseFetchAdapter {
  private apiKey: OttoAPIKey;
  private port: number | undefined;

  constructor(options: OttoAdapterOptions) {
    super({
      server: options.server,
      database: options.database,
    });

    this.apiKey = options.auth.apiKey;
    this.port = options.auth.ottoPort;

    if (isOtto3APIKey(this.apiKey)) {
      // Otto v3 uses port 3030 by default
      this.baseUrl.port = (this.port ?? 3030).toString();
    } else if (isOttoFMSAPIKey(this.apiKey)) {
      // OttoFMS uses /otto prefix in path
      // Insert /otto before /fmi in the pathname
      this.baseUrl.pathname = this.baseUrl.pathname.replace(
        /^(\/fmi\/)/,
        "/otto$1",
      );
    } else {
      throw new Error(
        "Invalid Otto API key format. Must start with 'KEY_' (Otto v3) or 'dk_' (OttoFMS)",
      );
    }
  }

  /**
   * Override request to ensure /otto prefix is included in paths
   */
  protected override async request<T>(params: {
    path: string;
    method?: string;
    body?: unknown;
    query?: string | URLSearchParams;
    headers?: Record<string, string>;
    timeout?: number;
    fetchOptions?: RequestInit;
  }): Promise<T> {
    // For OttoFMS, ensure the path includes /otto prefix
    // Since utility functions return absolute paths like /fmi/odata/v4/...,
    // we need to insert /otto before /fmi
    if (isOttoFMSAPIKey(this.apiKey) && params.path.startsWith("/fmi/")) {
      const modifiedPath = params.path.replace(/^(\/fmi\/)/, "/otto$1");
      return super.request({ ...params, path: modifiedPath });
    }

    return super.request(params);
  }

  protected override async getAuthHeader(): Promise<string> {
    // Otto uses API key directly as Bearer token
    return `Bearer ${this.apiKey}`;
  }

  /**
   * Override getTables for OttoFMS to use metadata fallback
   * The OttoFMS proxy may not properly route the base database URL for listing tables,
   * so we parse table names from the $metadata endpoint instead.
   */
  override async getTables(
    options?: BaseRequestOptions,
  ): Promise<ODataResponse<ODataTable>> {
    // Only use fallback for OttoFMS keys
    if (!isOttoFMSAPIKey(this.apiKey)) {
      return super.getTables(options);
    }

    // Try the standard endpoint first
    try {
      return await super.getTables(options);
    } catch (error) {
      // If unauthorized, fall back to parsing metadata
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.toLowerCase().includes("unauthorized")) {
        throw error;
      }
    }

    // Fallback: Parse table names from metadata
    const metadata = await this.getMetadata(options);
    const tables = this.parseTablesFromMetadata(metadata as unknown as string);

    return {
      "@odata.context": `${this.baseUrl.toString()}/$metadata`,
      value: tables,
    };
  }

  /**
   * Parse EntitySet names from OData XML metadata
   */
  private parseTablesFromMetadata(metadataXml: string): ODataTable[] {
    const tables: ODataTable[] = [];

    // Match EntitySet elements: <EntitySet Name="TableName" ...>
    const entitySetRegex = /<EntitySet\s+Name="([^"]+)"/g;
    let match;

    while ((match = entitySetRegex.exec(metadataXml)) !== null) {
      const tableName = match[1];
      if (tableName) {
        tables.push({
          name: tableName,
          kind: "EntitySet",
          url: tableName,
        });
      }
    }

    return tables;
  }
}
