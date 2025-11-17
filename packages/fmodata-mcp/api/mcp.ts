import { createMcpHandler } from "mcp-handler";
import { ODataApi, FetchAdapter, OttoAdapter, isOttoAPIKey } from "fmodata";
import { z } from "zod";

interface ODataConfig {
  host: string;
  database: string;
  username?: string;
  password?: string;
  ottoApiKey?: string;
  ottoPort?: number;
}

function getConfigFromHeaders(req: Request): Partial<ODataConfig> {
  // Helper to get header value (case-insensitive)
  const getHeader = (name: string): string | undefined => {
    return req.headers.get(name) || undefined;
  };

  const host =
    getHeader("x-fmodata-host") ||
    getHeader("fmodata-host") ||
    process.env.FMODATA_HOST;
  const database =
    getHeader("x-fmodata-database") ||
    getHeader("fmodata-database") ||
    getHeader("x-fmodata-filename") ||
    getHeader("fmodata-filename") ||
    process.env.FMODATA_DATABASE;
  const username =
    getHeader("x-fmodata-username") ||
    getHeader("fmodata-username") ||
    process.env.FMODATA_USERNAME;
  const password =
    getHeader("x-fmodata-password") ||
    getHeader("fmodata-password") ||
    process.env.FMODATA_PASSWORD;
  const ottoApiKey =
    getHeader("x-fmodata-otto-api-key") ||
    getHeader("fmodata-otto-api-key") ||
    getHeader("x-fmodata-api-key") ||
    getHeader("fmodata-api-key") ||
    process.env.FMODATA_OTTO_API_KEY;
  const ottoPortStr =
    getHeader("x-fmodata-otto-port") ||
    getHeader("fmodata-otto-port") ||
    process.env.FMODATA_OTTO_PORT;
  const ottoPort = ottoPortStr ? parseInt(ottoPortStr, 10) : undefined;

  return {
    host,
    database,
    username,
    password,
    ottoApiKey,
    ottoPort,
  };
}

function createODataClient(config: ODataConfig) {
  let adapter;
  
  if (config.ottoApiKey && isOttoAPIKey(config.ottoApiKey)) {
    // Build auth object based on API key type
    const auth = config.ottoApiKey.startsWith("dk_")
      ? { apiKey: config.ottoApiKey as `dk_${string}` }
      : { apiKey: config.ottoApiKey as `KEY_${string}`, ottoPort: config.ottoPort };
    
    adapter = new OttoAdapter({
      server: config.host,
      database: config.database,
      auth,
    });
  } else {
    adapter = new FetchAdapter({
      server: config.host,
      database: config.database,
      auth: {
        username: config.username || "",
        password: config.password || "",
      },
    });
  }

  return ODataApi({ adapter });
}

// Create handler factory
function createHandler(config: ODataConfig) {
  const client = createODataClient(config);

  return createMcpHandler(
    (server) => {
      // List tables tool
      server.tool(
        "fmodata_list_tables",
        "Get all tables in the database",
        {},
        async () => {
          const tables = await client.getTables();
          return {
            content: [{ type: "text", text: JSON.stringify(tables, null, 2) }],
          };
        }
      );

      // Get metadata tool
      server.tool(
        "fmodata_get_metadata",
        "Get OData metadata ($metadata)",
        {},
        async () => {
          const metadata = await client.getMetadata();
          return {
            content: [{ type: "text", text: JSON.stringify(metadata, null, 2) }],
          };
        }
      );

      // Query records tool
      server.tool(
        "fmodata_query_records",
        "Query records with filters, sorting, and pagination",
        {
          table: z.string().describe("Table name"),
          filter: z.string().optional().describe("OData $filter expression"),
          select: z.string().optional().describe("Comma-separated field names"),
          orderby: z.string().optional().describe("Sort expression (e.g., 'Name desc')"),
          top: z.number().optional().describe("Maximum number of records"),
          skip: z.number().optional().describe("Number of records to skip"),
        },
        async ({ table, filter, select, orderby, top, skip }) => {
          const results = await client.getRecords(table, {
            $filter: filter,
            $select: select,
            $orderby: orderby,
            $top: top,
            $skip: skip,
          });
          return {
            content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
          };
        }
      );

      // Get record tool
      server.tool(
        "fmodata_get_record",
        "Get a single record by primary key",
        {
          table: z.string().describe("Table name"),
          key: z.union([z.string(), z.number()]).describe("Primary key value"),
          select: z.string().optional().describe("Comma-separated field names"),
        },
        async ({ table, key, select }) => {
          const result = await client.getRecord(table, key, {
            $select: select,
          });
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      );

      // Create record tool
      server.tool(
        "fmodata_create_record",
        "Create a new record",
        {
          table: z.string().describe("Table name"),
          data: z.record(z.any()).describe("Record data as key-value pairs"),
        },
        async ({ table, data }) => {
          const result = await client.createRecord(table, { data });
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      );

      // Update record tool
      server.tool(
        "fmodata_update_record",
        "Update an existing record",
        {
          table: z.string().describe("Table name"),
          key: z.union([z.string(), z.number()]).describe("Primary key value"),
          data: z.record(z.any()).describe("Updated data as key-value pairs"),
        },
        async ({ table, key, data }) => {
          const result = await client.updateRecord(table, key, { data });
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      );

      // Delete record tool
      server.tool(
        "fmodata_delete_record",
        "Delete a record",
        {
          table: z.string().describe("Table name"),
          key: z.union([z.string(), z.number()]).describe("Primary key value"),
        },
        async ({ table, key }) => {
          await client.deleteRecord(table, key);
          return {
            content: [{ type: "text", text: `Record ${key} deleted successfully` }],
          };
        }
      );
    },
    {
      capabilities: {
        tools: {},
      },
    },
    {
      basePath: "/api",
    }
  );
}

// Main handler - directly create the MCP handler per request
export async function GET(req: Request) {
  return handler(req);
}

export async function POST(req: Request) {
  return handler(req);
}

export async function DELETE(req: Request) {
  return handler(req);
}

async function handler(req: Request): Promise<Response> {
  // Get config from headers
  const config = getConfigFromHeaders(req);

  // Validate required config
  if (!config.host || !config.database) {
    return new Response(
      JSON.stringify({
        error: {
          message:
            "Missing required headers: x-fmodata-host and x-fmodata-database must be provided",
        },
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  console.log("Creating MCP server with config:", {
    host: config.host,
    database: config.database,
    hasAuth: !!(config.username || config.ottoApiKey),
  });

  // Create handler with this config
  const mcpHandler = createHandler(config as ODataConfig);

  // Forward to MCP handler
  return mcpHandler(req);
}
