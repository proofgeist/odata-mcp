# Publishing Guide

## Important Rules

### ⚠️ Never use `workspace:` protocol in published packages

The `workspace:^` protocol is **pnpm-specific** and will cause installation failures when users try to install from npm with other package managers.

**Wrong:**
```json
"dependencies": {
  "fmodata": "workspace:^"
}
```

**Correct:**
```json
"dependencies": {
  "fmodata": "^0.1.1"
}
```

## Publishing Checklist

### Before Publishing Any Package

1. **Check for workspace protocols:**
   ```bash
   grep -r "workspace:" packages/*/package.json
   ```
   If this returns any results, replace them with actual semver versions.

2. **Ensure fmodata-mcp references the correct fmodata version:**
   - Check `packages/fmodata-mcp/package.json`
   - The `fmodata` dependency should match the latest published version

### Publishing fmodata

```bash
cd packages/fmodata
npm version patch  # or minor/major
pnpm build
npm publish --access public
```

### Publishing fmodata-mcp

1. **First, update the fmodata dependency if needed:**
   ```bash
   # Edit packages/fmodata-mcp/package.json
   # Update "fmodata": "^X.Y.Z" to match latest fmodata version
   ```

2. **Then publish:**
   ```bash
   cd packages/fmodata-mcp
   npm version patch  # or minor/major
   pnpm build
   npm publish --access public
   ```

### Publishing n8n-nodes-filemaker-odata

```bash
cd packages/n8n-nodes-filemaker-odata
npm version patch  # or minor/major
pnpm build
npm publish --access public
```

## After Publishing

Always commit and push version bumps:
```bash
git add .
git commit -m "chore: bump package versions"
git push
```

## Version Sync

When bumping `fmodata` to a new version, remember to:
1. Update `fmodata-mcp/package.json` to reference the new version
2. Republish `fmodata-mcp` with the updated dependency



