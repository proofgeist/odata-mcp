import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createServer, type ODataConfig } from "../dist/server.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

// Store sessions in a Map (in production, consider using Redis or similar)
// Note: This is in-memory and will reset on cold starts
const sessions = new Map<
  string,
  { server: Awaited<ReturnType<typeof createServer>>; transport: StreamableHTTPServerTransport }
>();

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
    // Get session ID from headers or query
    const sessionId =
      (req.headers["mcp-session-id"] as string) ||
      (req.headers["x-mcp-session-id"] as string) ||
      (req.query.sessionId as string) ||
      undefined;

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

    // Create a session key that includes config to ensure sessions are isolated per config
    // This way different users with different credentials get different sessions
    const sessionKey = sessionId
      ? `${sessionId}-${config.host}-${config.database}`
      : undefined;

    let session = sessionKey ? sessions.get(sessionKey) : undefined;

    // If no session ID or session not found, create a new session
    if (!sessionKey || !session) {
      const newSessionId = sessionId || generateSessionId();
      const newSessionKey = `${newSessionId}-${config.host}-${config.database}`;

      const server = await createServer(config);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => newSessionId,
        onsessioninitialized: (id) => {
          console.log(`Session ${id} initialized`);
        },
        onsessionclosed: (id) => {
          console.log(`Session ${id} closed`);
          // Find and remove session by ID
          for (const [key, sess] of sessions.entries()) {
            if (key.startsWith(id)) {
              sessions.delete(key);
              break;
            }
          }
        },
      });

      await server.connect(transport);

      session = { server, transport };
      sessions.set(newSessionKey, session);

      // Set session ID in response header for client to use
      res.setHeader("mcp-session-id", newSessionId);
    }

    // Handle the request
    await session.transport.handleRequest(req, res, req.body);
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

