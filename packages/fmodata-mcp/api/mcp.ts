import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createServer, type ODataConfig } from "../dist/server.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

// Note: Vercel serverless functions are stateless, so we create a new server for each request
// For production with persistent sessions, use Redis or a database

function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

function getConfigFromHeaders(req: VercelRequest): Partial<ODataConfig> {
  // Helper to get header value (case-insensitive)
  const getHeader = (name: string): string | undefined => {
    const lowerName = name.toLowerCase();
    const header = Object.keys(req.headers).find(
      (key) => key.toLowerCase() === lowerName
    );
    if (header) {
      const value = req.headers[header];
      return Array.isArray(value) ? value[0] : value;
    }
    return undefined;
  };

  // Try both x- prefixed and non-prefixed versions
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, mcp-session-id, x-mcp-session-id, x-fmodata-host, x-fmodata-database, x-fmodata-filename, x-fmodata-username, x-fmodata-password, x-fmodata-otto-api-key, x-fmodata-api-key, x-fmodata-otto-port, fmodata-host, fmodata-database, fmodata-filename, fmodata-username, fmodata-password, fmodata-otto-api-key, fmodata-api-key, fmodata-otto-port"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  try {
    // Get config from headers (per-request)
    const config = getConfigFromHeaders(req);

    // Validate required config
    if (!config.host || !config.database) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message:
            "Missing required headers: x-fmodata-host and x-fmodata-database (or x-fmodata-filename) must be provided",
        },
        id: null,
      });
      return;
    }

    console.log(`Creating server with config:`, {
      host: config.host,
      database: config.database,
      hasAuth: !!(config.username || config.ottoApiKey)
    });

    // Create a new server for each request (serverless functions are stateless)
    const server = await createServer(config);
    const sessionId = generateSessionId();
    
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => sessionId,
      onsessioninitialized: (id) => {
        console.log(`Session ${id} initialized`);
      },
      onsessionclosed: (id) => {
        console.log(`Session ${id} closed`);
      },
    });

    await server.connect(transport);
    console.log(`Server connected to transport for session ${sessionId}`);

    // Set session ID in response header
    res.setHeader("mcp-session-id", sessionId);

    // Handle the request
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP request:", error);
    res.status(500).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: error instanceof Error ? error.message : String(error),
      },
      id: null,
    });
  }
}

