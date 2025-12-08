# FileMaker OData Monorepo

A complete toolkit for interacting with FileMaker databases via the OData API. This monorepo provides a TypeScript client library, an MCP server for AI assistants, and an n8n community node for workflow automation.

## Packages

| Package | Description | npm |
|---------|-------------|-----|
| [**fmodata**](./packages/fmodata) | TypeScript client library for FileMaker OData API | [![npm](https://img.shields.io/npm/v/fmodata)](https://www.npmjs.com/package/fmodata) |
| [**fmodata-mcp**](./packages/fmodata-mcp) | MCP server for AI assistants (Claude, Cursor, etc.) | [![npm](https://img.shields.io/npm/v/fmodata-mcp)](https://www.npmjs.com/package/fmodata-mcp) |
| [**n8n-nodes-filemaker-odata**](./packages/n8n-nodes-filemaker-odata) | n8n community node for workflow automation | [![npm](https://img.shields.io/npm/v/n8n-nodes-filemaker-odata)](https://www.npmjs.com/package/n8n-nodes-filemaker-odata) |

## Quick Start

### TypeScript Client

```bash
npm install fmodata
```

```typescript
import { ODataApi, FetchAdapter } from "fmodata";

const client = ODataApi({
  adapter: new FetchAdapter({
    server: "https://your-server.example.com",
    database: "YourDatabase",
    auth: { username: "user", password: "pass" },
  }),
});

const records = await client.getRecords("Customers", { $top: 10 });
```

### MCP Server (for AI Assistants)

Add to your Claude/Cursor MCP config:

```json
{
  "mcpServers": {
    "filemaker": {
      "command": "npx",
      "args": ["-y", "fmodata-mcp"],
      "env": {
        "FM_SERVER": "https://your-server.example.com",
        "FM_DATABASE": "YourDatabase",
        "FM_USERNAME": "user",
        "FM_PASSWORD": "pass"
      }
    }
  }
}
```

### n8n Node

In n8n: **Settings** → **Community Nodes** → **Install** → `n8n-nodes-filemaker-odata`

## Authentication

All packages support:

- **Basic Auth** - FileMaker account username/password
- **OttoFMS API Key** - For [OttoFMS](https://www.ottofms.com/) users (recommended)

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Watch mode
pnpm dev
```

## Publishing

This monorepo uses [Changesets](https://github.com/changesets/changesets) for version management:

```bash
pnpm changeset      # Create a changeset
pnpm version-packages  # Version packages
pnpm release        # Publish to npm
```

## License

MIT

## Links

- [FileMaker OData API Documentation](https://help.claris.com/en/odata-guide/)
- [OttoFMS](https://www.ottofms.com/)
- [n8n Community Nodes](https://docs.n8n.io/integrations/community-nodes/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
