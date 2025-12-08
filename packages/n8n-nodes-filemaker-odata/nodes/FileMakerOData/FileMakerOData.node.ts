import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
	IHttpRequestMethods,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export class FileMakerOData implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'FileMaker OData',
		name: 'fileMakerOData',
		icon: 'file:filemaker.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with FileMaker databases via OData API',
		defaults: {
			name: 'FileMaker OData',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'fileMakerODataApi',
				required: true,
			},
		],
		properties: [
			// ----------------------------------
			//         Resource
			// ----------------------------------
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Record',
						value: 'record',
						description: 'Work with records in a table',
					},
					{
						name: 'Table',
						value: 'table',
						description: 'Get information about tables',
					},
					{
						name: 'Schema',
						value: 'schema',
						description: 'Modify database schema (create/delete tables and fields)',
					},
					{
						name: 'Script',
						value: 'script',
						description: 'Run FileMaker scripts',
					},
				],
				default: 'record',
			},

			// ----------------------------------
			//         Record Operations
			// ----------------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['record'],
					},
				},
				options: [
					{
						name: 'Create',
						value: 'create',
						description: 'Create a new record',
						action: 'Create a record',
					},
					{
						name: 'Delete',
						value: 'delete',
						description: 'Delete a record',
						action: 'Delete a record',
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Get a single record by key',
						action: 'Get a record',
					},
					{
						name: 'Get Count',
						value: 'getCount',
						description: 'Get count of records',
						action: 'Get record count',
					},
					{
						name: 'Get Field Value',
						value: 'getFieldValue',
						description: 'Get a specific field value from a record',
						action: 'Get field value',
					},
					{
						name: 'Get Many',
						value: 'getMany',
						description: 'Query multiple records',
						action: 'Get many records',
					},
					{
						name: 'Get Related',
						value: 'getRelated',
						description: 'Navigate to related records',
						action: 'Get related records',
					},
					{
						name: 'Update',
						value: 'update',
						description: 'Update an existing record',
						action: 'Update a record',
					},
				],
				default: 'getMany',
			},

			// ----------------------------------
			//         Table Operations
			// ----------------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['table'],
					},
				},
				options: [
					{
						name: 'Get Metadata',
						value: 'getMetadata',
						description: 'Get OData metadata schema',
						action: 'Get metadata',
					},
					{
						name: 'List',
						value: 'list',
						description: 'List all tables in the database',
						action: 'List tables',
					},
				],
				default: 'list',
			},

			// ----------------------------------
			//         Schema Operations
			// ----------------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['schema'],
					},
				},
				options: [
					{
						name: 'Add Fields',
						value: 'addFields',
						description: 'Add fields to an existing table',
						action: 'Add fields to table',
					},
					{
						name: 'Create Table',
						value: 'createTable',
						description: 'Create a new table',
						action: 'Create a table',
					},
					{
						name: 'Delete Field',
						value: 'deleteField',
						description: 'Delete a field from a table',
						action: 'Delete a field',
					},
					{
						name: 'Delete Table',
						value: 'deleteTable',
						description: 'Delete a table',
						action: 'Delete a table',
					},
				],
				default: 'createTable',
			},

			// ----------------------------------
			//         Script Operations
			// ----------------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['script'],
					},
				},
				options: [
					{
						name: 'Run',
						value: 'run',
						description: 'Run a FileMaker script',
						action: 'Run a script',
					},
				],
				default: 'run',
			},

			// ----------------------------------
			//         Common Fields
			// ----------------------------------
			{
				displayName: 'Table Name',
				name: 'table',
				type: 'string',
				default: '',
				required: true,
				description: 'The name of the table',
				displayOptions: {
					show: {
						resource: ['record', 'script'],
					},
				},
			},
			{
				displayName: 'Table Name',
				name: 'table',
				type: 'string',
				default: '',
				required: true,
				description: 'The name of the table',
				displayOptions: {
					show: {
						resource: ['schema'],
						operation: ['addFields', 'deleteTable', 'deleteField'],
					},
				},
			},

			// ----------------------------------
			//         Record: Get, Update, Delete, Get Field Value
			// ----------------------------------
			{
				displayName: 'Record Key',
				name: 'key',
				type: 'string',
				default: '',
				required: true,
				description: 'Primary key value of the record (UUID or ROWID)',
				displayOptions: {
					show: {
						resource: ['record'],
						operation: ['get', 'update', 'delete', 'getFieldValue', 'getRelated'],
					},
				},
			},

			// ----------------------------------
			//         Record: Get Field Value
			// ----------------------------------
			{
				displayName: 'Field Name',
				name: 'field',
				type: 'string',
				default: '',
				required: true,
				description: 'The name of the field to retrieve',
				displayOptions: {
					show: {
						resource: ['record'],
						operation: ['getFieldValue'],
					},
				},
			},

			// ----------------------------------
			//         Record: Get Related
			// ----------------------------------
			{
				displayName: 'Navigation Property',
				name: 'navigation',
				type: 'string',
				default: '',
				required: true,
				description: 'The navigation property (relationship) name',
				displayOptions: {
					show: {
						resource: ['record'],
						operation: ['getRelated'],
					},
				},
			},

			// ----------------------------------
			//         Record: Create, Update - Data
			// ----------------------------------
			{
				displayName: 'Data',
				name: 'data',
				type: 'json',
				default: '{}',
				required: true,
				description: 'Record data as JSON object',
				displayOptions: {
					show: {
						resource: ['record'],
						operation: ['create', 'update'],
					},
				},
			},

			// ----------------------------------
			//         Schema: Create Table
			// ----------------------------------
			{
				displayName: 'New Table Name',
				name: 'tableName',
				type: 'string',
				default: '',
				required: true,
				description: 'The name of the table to create',
				displayOptions: {
					show: {
						resource: ['schema'],
						operation: ['createTable'],
					},
				},
			},
			{
				displayName: 'Fields',
				name: 'fields',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				description: 'Fields to create in the table',
				displayOptions: {
					show: {
						resource: ['schema'],
						operation: ['createTable', 'addFields'],
					},
				},
				options: [
					{
						name: 'field',
						displayName: 'Field',
						values: [
							{
								displayName: 'Name',
								name: 'name',
								type: 'string',
								default: '',
								required: true,
								description: 'Field name',
							},
							{
								displayName: 'Type',
								name: 'type',
								type: 'options',
								options: [
									{ name: 'Binary Varying', value: 'BINARY VARYING' },
									{ name: 'Blob', value: 'BLOB' },
									{ name: 'Character Varying', value: 'CHARACTER VARYING' },
									{ name: 'Date', value: 'DATE' },
									{ name: 'Decimal', value: 'DECIMAL' },
									{ name: 'Int', value: 'INT' },
									{ name: 'Long Varbinary', value: 'LONGVARBINARY' },
									{ name: 'Numeric', value: 'NUMERIC' },
									{ name: 'Time', value: 'TIME' },
									{ name: 'Timestamp', value: 'TIMESTAMP' },
									{ name: 'Varbinary', value: 'VARBINARY' },
									{ name: 'Varchar', value: 'VARCHAR' },
								],
								default: 'VARCHAR',
								description: 'Field data type',
							},
							{
								displayName: 'Nullable',
								name: 'nullable',
								type: 'boolean',
								default: true,
								description: 'Whether the field can be null',
							},
						],
					},
				],
			},

			// ----------------------------------
			//         Schema: Delete Field
			// ----------------------------------
			{
				displayName: 'Field to Delete',
				name: 'fieldToDelete',
				type: 'string',
				default: '',
				required: true,
				description: 'The name of the field to delete',
				displayOptions: {
					show: {
						resource: ['schema'],
						operation: ['deleteField'],
					},
				},
			},

			// ----------------------------------
			//         Script: Run
			// ----------------------------------
			{
				displayName: 'Script Name',
				name: 'script',
				type: 'string',
				default: '',
				required: true,
				description: 'The name of the script to run',
				displayOptions: {
					show: {
						resource: ['script'],
						operation: ['run'],
					},
				},
			},
			{
				displayName: 'Script Parameter',
				name: 'scriptParam',
				type: 'string',
				default: '',
				description: 'Optional parameter to pass to the script',
				displayOptions: {
					show: {
						resource: ['script'],
						operation: ['run'],
					},
				},
			},

			// ----------------------------------
			//         Query Options (for getMany, getRelated)
			// ----------------------------------
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: {
						resource: ['record'],
						operation: ['getMany', 'getRelated', 'get', 'getCount'],
					},
				},
				options: [
					{
						displayName: 'Filter',
						name: 'filter',
						type: 'string',
						default: '',
						description: 'OData $filter expression (e.g., "Name eq \'John\'")',
						displayOptions: {
							show: {
								'/operation': ['getMany', 'getRelated', 'getCount'],
							},
						},
					},
					{
						displayName: 'Select Fields',
						name: 'select',
						type: 'string',
						default: '',
						description: 'Comma-separated list of fields to return',
					},
					{
						displayName: 'Expand Relations',
						name: 'expand',
						type: 'string',
						default: '',
						description: 'Navigation properties to expand',
						displayOptions: {
							show: {
								'/operation': ['getMany', 'get'],
							},
						},
					},
					{
						displayName: 'Order By',
						name: 'orderby',
						type: 'string',
						default: '',
						description: 'Field to sort by (e.g., "Name asc" or "CreatedAt desc")',
						displayOptions: {
							show: {
								'/operation': ['getMany'],
							},
						},
					},
					{
						displayName: 'Limit',
						name: 'top',
						type: 'number',
						default: 100,
						description: 'Maximum number of records to return',
						displayOptions: {
							show: {
								'/operation': ['getMany', 'getRelated'],
							},
						},
					},
					{
						displayName: 'Skip',
						name: 'skip',
						type: 'number',
						default: 0,
						description: 'Number of records to skip (for pagination)',
						displayOptions: {
							show: {
								'/operation': ['getMany', 'getRelated'],
							},
						},
					},
					{
						displayName: 'Include Count',
						name: 'count',
						type: 'boolean',
						default: false,
						description: 'Whether to include total count in response',
						displayOptions: {
							show: {
								'/operation': ['getMany'],
							},
						},
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		const credentials = await this.getCredentials('fileMakerODataApi');

		// Build base URL
		const host = (credentials.host as string).replace(/\/$/, '');
		const database = credentials.database as string;
		const baseUrl = `${host}/fmi/odata/v4/${encodeURIComponent(database)}`;

		// Build auth header
		let authHeader: string;
		if (credentials.authType === 'otto') {
			authHeader = `KEY ${credentials.ottoApiKey}`;
		} else {
			const basicAuth = Buffer.from(
				`${credentials.username}:${credentials.password}`,
			).toString('base64');
			authHeader = `Basic ${basicAuth}`;
		}

		for (let i = 0; i < items.length; i++) {
			try {
				let response: IDataObject;
				let method: IHttpRequestMethods = 'GET';
				let url = baseUrl;
				let body: IDataObject | undefined;
				const qs: IDataObject = {};

				if (resource === 'record') {
					const table = this.getNodeParameter('table', i) as string;

					switch (operation) {
						case 'getMany': {
							url = `${baseUrl}/${encodeURIComponent(table)}`;
							const options = this.getNodeParameter('options', i, {}) as IDataObject;
							if (options.filter) qs.$filter = options.filter;
							if (options.select) qs.$select = options.select;
							if (options.expand) qs.$expand = options.expand;
							if (options.orderby) qs.$orderby = options.orderby;
							if (options.top) qs.$top = options.top;
							if (options.skip) qs.$skip = options.skip;
							if (options.count) qs.$count = 'true';
							break;
						}

						case 'get': {
							const key = this.getNodeParameter('key', i) as string;
							const options = this.getNodeParameter('options', i, {}) as IDataObject;
							// Check if key is numeric or UUID
							const keyParam = isNaN(Number(key)) ? `'${key}'` : key;
							url = `${baseUrl}/${encodeURIComponent(table)}(${keyParam})`;
							if (options.select) qs.$select = options.select;
							if (options.expand) qs.$expand = options.expand;
							break;
						}

						case 'getCount': {
							url = `${baseUrl}/${encodeURIComponent(table)}/$count`;
							const options = this.getNodeParameter('options', i, {}) as IDataObject;
							if (options.filter) qs.$filter = options.filter;
							break;
						}

						case 'getFieldValue': {
							const key = this.getNodeParameter('key', i) as string;
							const field = this.getNodeParameter('field', i) as string;
							const keyParam = isNaN(Number(key)) ? `'${key}'` : key;
							url = `${baseUrl}/${encodeURIComponent(table)}(${keyParam})/${encodeURIComponent(field)}/$value`;
							break;
						}

						case 'getRelated': {
							const key = this.getNodeParameter('key', i) as string;
							const navigation = this.getNodeParameter('navigation', i) as string;
							const options = this.getNodeParameter('options', i, {}) as IDataObject;
							const keyParam = isNaN(Number(key)) ? `'${key}'` : key;
							url = `${baseUrl}/${encodeURIComponent(table)}(${keyParam})/${encodeURIComponent(navigation)}`;
							if (options.filter) qs.$filter = options.filter;
							if (options.select) qs.$select = options.select;
							if (options.top) qs.$top = options.top;
							if (options.skip) qs.$skip = options.skip;
							break;
						}

						case 'create': {
							method = 'POST';
							url = `${baseUrl}/${encodeURIComponent(table)}`;
							const data = this.getNodeParameter('data', i) as string;
							body = JSON.parse(data);
							break;
						}

						case 'update': {
							method = 'PATCH';
							const key = this.getNodeParameter('key', i) as string;
							const keyParam = isNaN(Number(key)) ? `'${key}'` : key;
							url = `${baseUrl}/${encodeURIComponent(table)}(${keyParam})`;
							const data = this.getNodeParameter('data', i) as string;
							body = JSON.parse(data);
							break;
						}

						case 'delete': {
							method = 'DELETE';
							const key = this.getNodeParameter('key', i) as string;
							const keyParam = isNaN(Number(key)) ? `'${key}'` : key;
							url = `${baseUrl}/${encodeURIComponent(table)}(${keyParam})`;
							break;
						}
					}
				} else if (resource === 'table') {
					switch (operation) {
						case 'list':
							url = baseUrl;
							break;
						case 'getMetadata':
							url = `${baseUrl}/$metadata`;
							break;
					}
				} else if (resource === 'schema') {
					switch (operation) {
						case 'createTable': {
							method = 'POST';
							url = `${baseUrl}/FileMaker_Tables`;
							const tableName = this.getNodeParameter('tableName', i) as string;
							const fieldsData = this.getNodeParameter('fields', i) as IDataObject;
							const fields = (fieldsData.field as IDataObject[]) || [];
							body = {
								TableName: tableName,
								Fields: fields.map((f) => ({
									Name: f.name,
									Type: f.type,
									Nullable: f.nullable ?? true,
								})),
							};
							break;
						}

						case 'addFields': {
							method = 'POST';
							const table = this.getNodeParameter('table', i) as string;
							url = `${baseUrl}/${encodeURIComponent(table)}/FileMaker_Fields`;
							const fieldsData = this.getNodeParameter('fields', i) as IDataObject;
							const fields = (fieldsData.field as IDataObject[]) || [];
							body = {
								Fields: fields.map((f) => ({
									Name: f.name,
									Type: f.type,
									Nullable: f.nullable ?? true,
								})),
							};
							break;
						}

						case 'deleteTable': {
							method = 'DELETE';
							const table = this.getNodeParameter('table', i) as string;
							url = `${baseUrl}/FileMaker_Tables('${encodeURIComponent(table)}')`;
							break;
						}

						case 'deleteField': {
							method = 'DELETE';
							const table = this.getNodeParameter('table', i) as string;
							const field = this.getNodeParameter('fieldToDelete', i) as string;
							url = `${baseUrl}/${encodeURIComponent(table)}/FileMaker_Fields('${encodeURIComponent(field)}')`;
							break;
						}
					}
				} else if (resource === 'script') {
					if (operation === 'run') {
						const table = this.getNodeParameter('table', i) as string;
						const script = this.getNodeParameter('script', i) as string;
						const param = this.getNodeParameter('scriptParam', i, '') as string;

						url = `${baseUrl}/${encodeURIComponent(table)}/Script.${encodeURIComponent(script)}`;
						if (param) {
							qs['$parameter'] = param;
						}
					}
				}

				// Make the request
				const requestOptions = {
					method,
					url,
					headers: {
						Authorization: authHeader,
						'Content-Type': 'application/json',
						Accept: 'application/json',
					},
					qs: Object.keys(qs).length > 0 ? qs : undefined,
					body,
					json: true,
				};

				response = (await this.helpers.httpRequest(requestOptions)) as IDataObject;

				// Handle different response types
				if (operation === 'getCount') {
					returnData.push({
						json: { count: response },
						pairedItem: { item: i },
					});
				} else if (operation === 'getFieldValue') {
					returnData.push({
						json: { value: response },
						pairedItem: { item: i },
					});
				} else if (operation === 'delete') {
					returnData.push({
						json: { success: true },
						pairedItem: { item: i },
					});
				} else if (response.value && Array.isArray(response.value)) {
					// OData collection response
					for (const item of response.value as IDataObject[]) {
						returnData.push({
							json: item,
							pairedItem: { item: i },
						});
					}
					// Add count if available
					if (response['@odata.count'] !== undefined) {
						returnData.push({
							json: { '@odata.count': response['@odata.count'] },
							pairedItem: { item: i },
						});
					}
				} else {
					returnData.push({
						json: response,
						pairedItem: { item: i },
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: (error as Error).message,
						},
						pairedItem: { item: i },
					});
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, {
					itemIndex: i,
				});
			}
		}

		return [returnData];
	}
}



