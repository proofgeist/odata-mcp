# fmodata-mcp

MCP (Model Context Protocol) server for FileMaker OData API. This server exposes FileMaker OData operations as tools that can be used by AI assistants and other MCP clients.

## Installation

Use `npx` to run without installing:

```bash
npx -y fmodata-mcp --host=https://your-server.example.com --database=YourDatabase --ottoApiKey=dk_your-api-key
```

## Configuration

Add the server to your MCP client configuration (e.g., Cursor `mcp.json`):

### With Otto API Key

```json
{
  "mcpServers": {
    "fmodata": {
      "command": "npx",
      "args": [
        "-y",
        "fmodata-mcp",
        "--host",
        "https://your-server.example.com",
        "--database",
        "YourDatabase",
        "--ottoApiKey",
        "dk_your-api-key"
      ]
    }
  }
}
```

### With Basic Auth

```json
{
  "mcpServers": {
    "fmodata": {
      "command": "npx",
      "args": [
        "-y",
        "fmodata-mcp",
        "--host",
        "https://your-server.example.com",
        "--database",
        "YourDatabase",
        "--username",
        "your-username",
        "--password",
        "your-password"
      ]
    }
  }
}
```

**Arguments:**
- `--host` or `--server` - FileMaker server host (required)
- `--database`, `--db`, or `--filename` - Database name (required)
- `--ottoApiKey`, `--apiKey`, or `--key` - Otto API key (`dk_` for OttoFMS, `KEY_` for Otto v3)
- `--ottoPort` or `--port` - Otto port (optional, only for Otto v3)
- `--username` or `--user` - FileMaker username (for Basic Auth)
- `--password` or `--pass` - FileMaker password (for Basic Auth)
- `--proofchatFmSecret` - ProofChat FM secret (for clipboard tool)
- `--proofchatLicenseKey` - ProofChat license key (for clipboard tool)
- `--proofchatActivationData` - ProofChat activation data (for clipboard tool)
- `--proofchatOpenAIKey` - OpenAI API key (for clipboard tool)

You can also use `--key=value` format:

```json
{
  "mcpServers": {
    "fmodata": {
      "command": "npx",
      "args": [
        "-y",
        "fmodata-mcp",
        "--host=https://your-server.example.com",
        "--database=YourDatabase",
        "--ottoApiKey=dk_your-api-key"
      ]
    }
  }
}
```

## Available Tools

### Database Structure
- **`fmodata_list_tables`** - Get all tables in the database
- **`fmodata_get_metadata`** - Get OData metadata ($metadata)

### Data Query
- **`fmodata_query_records`** - Query records with filters, sorting, and pagination
  - Parameters: `table`, `filter`, `select`, `expand`, `orderby`, `top`, `skip`, `count`
- **`fmodata_get_record`** - Get a single record by primary key
  - Parameters: `table`, `key`, `select`, `expand`
- **`fmodata_get_record_count`** - Get count of records (optionally filtered)
  - Parameters: `table`, `filter`
- **`fmodata_get_field_value`** - Get specific field value
  - Parameters: `table`, `key`, `field`
- **`fmodata_navigate_related`** - Navigate related records through relationships
  - Parameters: `table`, `key`, `navigation`, `filter`, `select`, `top`, `skip`
- **`fmodata_cross_join`** - Perform cross-join query between tables
  - Parameters: `tables`, `filter`, `select`, `top`, `skip`

### Data Modification
- **`fmodata_create_record`** - Create new record
  - Parameters: `table`, `data`
- **`fmodata_update_record`** - Update existing record
  - Parameters: `table`, `key`, `data`
- **`fmodata_delete_record`** - Delete record
  - Parameters: `table`, `key`

### Schema Operations
- **`fmodata_create_table`** - Create new table
  - Parameters: `tableName`, `fields`
- **`fmodata_add_fields`** - Add fields to existing table
  - Parameters: `table`, `fields`
- **`fmodata_delete_table`** - Delete table
  - Parameters: `table`
- **`fmodata_delete_field`** - Delete field from table
  - Parameters: `table`, `field`

### Script Execution
- **`fmodata_run_script`** - Run FileMaker script
  - Parameters: `table`, `script`, `param` (optional)
- **`fmodata_batch`** - Execute batch operations
  - Parameters: `requests` (array of request objects)

### Clipboard Operations (macOS only)
- **`fmodata_text_to_clipboard`** - Convert FileMaker script text to XML and place on clipboard as FileMaker object
  - Parameters: `text` (FileMaker script in text format)
  - Requires ProofChat API credentials (see configuration below)
  - **Platform**: macOS only (uses AppleScript)

## Example Usage

Once configured, you can use the tools through your MCP client:

```
User: List all tables in the database
Assistant: [calls fmodata_list_tables]
          Found 5 tables: Customers, Orders, Products, Suppliers, Categories

User: Get all customers named "John"
Assistant: [calls fmodata_query_records with table="Customers", filter="Name eq 'John'"]
          Found 3 customers matching the filter...

User: Create a new customer
Assistant: [calls fmodata_create_record with table="Customers", data={...}]
          Successfully created customer with ID 12345

User: Write a FileMaker script that finds wireless licenses (macOS only)
Assistant: [calls fmodata_text_to_clipboard with text="...script text..."]
          The script has been converted and placed on your clipboard. 
          You can now paste it directly into FileMaker!
```

## Clipboard Tool Configuration

The `fmodata_text_to_clipboard` tool (macOS only) requires additional ProofChat API credentials. These can be provided via command-line arguments, environment variables, or MCP configuration.

### Via Command-Line Arguments

```bash
npx -y fmodata-mcp \
  --host=https://your-server.example.com \
  --database=YourDatabase \
  --ottoApiKey=dk_your-api-key \
  --proofchatFmSecret=your-secret \
  --proofchatLicenseKey=your-license-key \
  --proofchatActivationData=your-activation-data \
  --proofchatOpenAIKey=your-openai-key
```

### Via Environment Variables

```bash
export PROOFCHAT_FM_SECRET="your-secret"
export PROOFCHAT_LICENSE_KEY="your-license-key"
export PROOFCHAT_ACTIVATION_DATA="your-activation-data"
export OPENAI_API_KEY="your-openai-key"
```

See [CLIPBOARD_TOOL.md](CLIPBOARD_TOOL.md) for detailed documentation on this tool.

## HTTP Mode (Optional)

You can also run the server as an HTTP server on `localhost:3000`:

```bash
npx -y fmodata-mcp --http --host=https://your-server.example.com --database=YourDatabase --ottoApiKey=dk_your-key
```

Then configure your MCP client to use the HTTP endpoint:

```json
{
  "mcpServers": {
    "fmodata": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

## Deploying to Vercel

To deploy the MCP server to Vercel for use with a URL:

1. **Clone or fork the repository** and navigate to `packages/fmodata-mcp`

2. **Deploy to Vercel**:
   ```bash
   # Install Vercel CLI if needed
   npm i -g vercel
   
   # Deploy
   vercel
   ```

3. **Configure your MCP client** to use the Vercel URL with headers:
   
   **With Otto API Key:**
   ```json
   {
     "mcpServers": {
       "fmodata": {
         "url": "https://your-app.vercel.app/mcp",
         "headers": {
           "x-fmodata-host": "https://your-server.example.com",
           "x-fmodata-database": "YourDatabase",
           "x-fmodata-otto-api-key": "dk_your-api-key"
         }
       }
     }
   }
   ```
   
   **With Basic Auth:**
   ```json
   {
     "mcpServers": {
       "fmodata": {
         "url": "https://your-app.vercel.app/mcp",
         "headers": {
           "x-fmodata-host": "https://your-server.example.com",
           "x-fmodata-database": "YourDatabase",
           "x-fmodata-username": "your-username",
           "x-fmodata-password": "your-password"
         }
       }
     }
   }
   ```

**Available Headers:**
- `x-fmodata-host` or `fmodata-host` - FileMaker server host (required)
- `x-fmodata-database` or `fmodata-database` or `x-fmodata-filename` or `fmodata-filename` - Database name (required)
- `x-fmodata-otto-api-key` or `fmodata-otto-api-key` or `x-fmodata-api-key` or `fmodata-api-key` - Otto API key
- `x-fmodata-otto-port` or `fmodata-otto-port` - Otto port (optional, only for Otto v3)
- `x-fmodata-username` or `fmodata-username` - FileMaker username (for Basic Auth)
- `x-fmodata-password` or `fmodata-password` - FileMaker password (for Basic Auth)
- `x-proofchat-fm-secret` or `proofchat-fm-secret` - ProofChat FM secret (for clipboard tool)
- `x-proofchat-license-key` or `proofchat-license-key` - ProofChat license key (for clipboard tool)
- `x-proofchat-activation-data` or `proofchat-activation-data` - ProofChat activation data (for clipboard tool)
- `x-proofchat-openai-key` or `proofchat-openai-key` - OpenAI API key (for clipboard tool)

The server will be available at `https://your-app.vercel.app/mcp` and includes a health check endpoint at `https://your-app.vercel.app/health`.

**Note:** The Vercel deployment is a generic shell - credentials are passed per-request via headers, so no environment variables are needed. Session state is stored in memory and will reset on cold starts.

## License

MIT
