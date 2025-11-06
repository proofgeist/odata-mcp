# fmodata Monorepo

This monorepo contains the FileMaker OData packages:

- **fmodata**: FileMaker OData API client
- **fmodata-mcp**: MCP server for FileMaker OData API

## Setup

```bash
pnpm install
```

## Development

```bash
# Build all packages
pnpm build

# Run tests
pnpm test

# Format code
pnpm format

# Watch mode
pnpm dev
```

## Publishing

This monorepo uses [Changesets](https://github.com/changesets/changesets) for version management and publishing.

1. Make your changes
2. Create a changeset: `pnpm changeset`
3. Version packages: `pnpm version-packages`
4. Publish: `pnpm release`

## Packages

### fmodata

FileMaker OData API client library.

### fmodata-mcp

MCP (Model Context Protocol) server that provides FileMaker OData functionality as MCP tools.

