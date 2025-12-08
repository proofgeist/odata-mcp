# n8n-nodes-filemaker-odata

This is an n8n community node that lets you interact with FileMaker databases via the OData API.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[FileMaker](https://www.claris.com/filemaker/) is a low-code database platform by Claris (Apple subsidiary).

## Installation

### In n8n (Recommended)

1. Go to **Settings** > **Community Nodes**
2. Click **Install a community node**
3. Enter `n8n-nodes-filemaker-odata`
4. Click **Install**

### Via npm

```bash
npm install n8n-nodes-filemaker-odata
```

## Operations

This node supports the following operations:

### Records

| Operation | Description |
|-----------|-------------|
| **Get Many** | Query records with filtering, sorting, and pagination |
| **Get** | Get a single record by primary key |
| **Get Count** | Get the count of records (optionally filtered) |
| **Get Field Value** | Get a specific field value from a record |
| **Get Related** | Navigate to related records via relationships |
| **Create** | Create a new record |
| **Update** | Update an existing record |
| **Delete** | Delete a record |

### Tables

| Operation | Description |
|-----------|-------------|
| **List** | Get all tables in the database |
| **Get Metadata** | Get OData schema metadata |

### Schema

| Operation | Description |
|-----------|-------------|
| **Create Table** | Create a new table with fields |
| **Add Fields** | Add fields to an existing table |
| **Delete Table** | Delete a table |
| **Delete Field** | Delete a field from a table |

### Scripts

| Operation | Description |
|-----------|-------------|
| **Run** | Run a FileMaker script with optional parameter |

## Credentials

This node requires FileMaker OData API credentials. You can authenticate using:

### OttoFMS API Key (Recommended)

If you're using [OttoFMS](https://www.ottofms.com/):

- **Host**: Your FileMaker Server URL (e.g., `https://your-server.example.com`)
- **Database**: Your FileMaker database name
- **Authentication Type**: OttoFMS API Key
- **OttoFMS API Key**: Your API key (starts with `dk_`)

### Basic Authentication

Using FileMaker account credentials:

- **Host**: Your FileMaker Server URL
- **Database**: Your FileMaker database name
- **Authentication Type**: Basic Auth
- **Username**: FileMaker account username
- **Password**: FileMaker account password

## Examples

### Query Records with Filter

```
Resource: Record
Operation: Get Many
Table: Customers
Options:
  Filter: Status eq 'Active'
  Select: Name, Email, Phone
  Order By: Name asc
  Limit: 50
```

### Create a Record

```
Resource: Record
Operation: Create
Table: Orders
Data: {"CustomerID": "12345", "Product": "Widget", "Quantity": 5}
```

### Run a Script

```
Resource: Script
Operation: Run
Table: Customers
Script Name: ProcessNewOrder
Script Parameter: {"orderID": "ORD-001"}
```

## OData Filter Syntax

The node uses OData v4 filter syntax. Examples:

| Filter | Description |
|--------|-------------|
| `Name eq 'John'` | Name equals "John" |
| `Age gt 21` | Age greater than 21 |
| `Status ne 'Closed'` | Status not equal to "Closed" |
| `contains(Name, 'Smith')` | Name contains "Smith" |
| `startswith(Email, 'john')` | Email starts with "john" |
| `Date ge 2024-01-01` | Date on or after Jan 1, 2024 |
| `Active eq true and Age gt 18` | Combine with AND |
| `Status eq 'Open' or Status eq 'Pending'` | Combine with OR |

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
- [FileMaker OData API documentation](https://help.claris.com/en/odata-guide/)
- [fmodata library](https://github.com/proofgeist/fmodata)
- [OttoFMS](https://www.ottofms.com/)

## License

MIT

