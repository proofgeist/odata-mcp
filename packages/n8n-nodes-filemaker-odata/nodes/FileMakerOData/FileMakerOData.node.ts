import {
	NodeConnectionTypes,
	type IExecuteFunctions,
	type ILoadOptionsFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type IDataObject,
	type IHttpRequestMethods,
	NodeOperationError,
} from 'n8n-workflow';
import { recordDescription } from './resources/record';
import { tableDescription } from './resources/table';
import { schemaDescription } from './resources/schema';
import { scriptDescription } from './resources/script';

export class FileMakerOData implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'FileMaker OData',
		name: 'fileMakerOData',
		icon: 'file:../../icons/filemaker.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with FileMaker databases via OData API',
		defaults: {
			name: 'FileMaker OData',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'fileMakerODataApi',
				required: true,
			},
		],
		properties: [
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
			...recordDescription,
			...tableDescription,
			...schemaDescription,
			...scriptDescription,
		],
	};

	methods = {
		loadOptions: {
			async loadTables(this: ILoadOptionsFunctions) {
				try {
					// Get credentials
					const credentials = await this.getCredentials('fileMakerODataApi');
					const host = (credentials.host as string).replace(/\/$/, '');
					const database = credentials.database as string;
					const authType = credentials.authType as string;

					// Build base URL - handle OttoFMS vs Basic Auth
					let baseUrl: string;
					if (authType === 'otto') {
						// OttoFMS uses /otto/fmi/odata/v4 path
						baseUrl = `${host}/otto/fmi/odata/v4/${encodeURIComponent(database)}`;
					} else {
						baseUrl = `${host}/fmi/odata/v4/${encodeURIComponent(database)}`;
					}

					// Build auth header
					let authHeader: string;
					if (authType === 'otto') {
						authHeader = `Bearer ${credentials.ottoApiKey}`;
					} else {
						const basicAuth = Buffer.from(
							`${credentials.username}:${credentials.password}`,
						).toString('base64');
						authHeader = `Basic ${basicAuth}`;
					}

					// Make request to list tables (GET to base URL)
					const response = await this.helpers.httpRequest({
						method: 'GET',
						url: baseUrl,
						headers: {
							Authorization: authHeader,
							Accept: 'application/json',
						},
						json: true,
					});

					// Extract table names from OData response
					// Response format: { value: [{ name: "Table1", ... }] } or { value: [{ Name: "Table1", ... }] }
					const tables: Array<{ name: string; value: string }> = [];
					
					if (response && typeof response === 'object' && 'value' in response) {
						const value = response.value;
						if (Array.isArray(value)) {
							for (const table of value) {
								if (table && typeof table === 'object') {
									// Try both 'name' (OData standard) and 'Name' (FileMaker might use)
									const tableName = (table.name as string) || (table.Name as string);
									if (tableName) {
										tables.push({
											name: String(tableName),
											value: String(tableName),
										});
									}
								}
							}
						}
					}

					// Sort tables alphabetically
					tables.sort((a, b) => a.name.localeCompare(b.name));

					return tables;
				} catch (error) {
					// If loading fails, return empty array so user can still type manually
					return [];
				}
			},

			async loadScripts(this: ILoadOptionsFunctions) {
				try {
					// Get credentials
					const credentials = await this.getCredentials('fileMakerODataApi');
					const host = (credentials.host as string).replace(/\/$/, '');
					const database = credentials.database as string;
					const authType = credentials.authType as string;

					// Build base URL - handle OttoFMS vs Basic Auth
					let baseUrl: string;
					if (authType === 'otto') {
						baseUrl = `${host}/otto/fmi/odata/v4/${encodeURIComponent(database)}`;
					} else {
						baseUrl = `${host}/fmi/odata/v4/${encodeURIComponent(database)}`;
					}

					// Build auth header
					let authHeader: string;
					if (authType === 'otto') {
						authHeader = `Bearer ${credentials.ottoApiKey}`;
					} else {
						const basicAuth = Buffer.from(
							`${credentials.username}:${credentials.password}`,
						).toString('base64');
						authHeader = `Basic ${basicAuth}`;
					}

					// Fetch metadata XML
					const metadataXml = await this.helpers.httpRequest({
						method: 'GET',
						url: `${baseUrl}/$metadata`,
						headers: {
							Authorization: authHeader,
							Accept: 'application/xml',
						},
					});

					// Parse script names from metadata
					// Scripts can be exposed as FunctionImport, ActionImport, or other elements with Name="Script.ScriptName"
					const scripts: Array<{ name: string; value: string }> = [];
					
					if (typeof metadataXml === 'string') {
						// Match any element with Name="Script.ScriptName" pattern
						// This covers FunctionImport, ActionImport, and other possible formats
						const scriptRegex = /Name="Script\.([^"]+)"/g;
						let match;
						const seenScripts = new Set<string>();

						while ((match = scriptRegex.exec(metadataXml)) !== null) {
							const scriptName = match[1];
							if (scriptName && !seenScripts.has(scriptName)) {
								seenScripts.add(scriptName);
								scripts.push({
									name: scriptName,
									value: scriptName,
								});
							}
						}
					}

					// Sort scripts alphabetically
					scripts.sort((a, b) => a.name.localeCompare(b.name));

					return scripts;
				} catch (error) {
					// If loading fails, return empty array so user can still type manually
					return [];
				}
			},

			async loadFields(this: ILoadOptionsFunctions) {
				try {
					// Get the selected table name
					const table = this.getCurrentNodeParameter('table') as string;
					if (!table) {
						return [];
					}

					// Get credentials
					const credentials = await this.getCredentials('fileMakerODataApi');
					const host = (credentials.host as string).replace(/\/$/, '');
					const database = credentials.database as string;
					const authType = credentials.authType as string;

					// Build base URL - handle OttoFMS vs Basic Auth
					let baseUrl: string;
					if (authType === 'otto') {
						baseUrl = `${host}/otto/fmi/odata/v4/${encodeURIComponent(database)}`;
					} else {
						baseUrl = `${host}/fmi/odata/v4/${encodeURIComponent(database)}`;
					}

					// Build auth header
					let authHeader: string;
					if (authType === 'otto') {
						authHeader = `Bearer ${credentials.ottoApiKey}`;
					} else {
						const basicAuth = Buffer.from(
							`${credentials.username}:${credentials.password}`,
						).toString('base64');
						authHeader = `Basic ${basicAuth}`;
					}

					// Fetch metadata XML
					const metadataXml = await this.helpers.httpRequest({
						method: 'GET',
						url: `${baseUrl}/$metadata`,
						headers: {
							Authorization: authHeader,
							Accept: 'application/xml',
						},
					});

					// Parse field names from metadata for the selected table
					// Fields are exposed as Property elements within EntityType
					// EntityType Name has underscore suffix (e.g., "Projects_" for table "Projects")
					const fields: Array<{ name: string; value: string }> = [];
					
					if (typeof metadataXml === 'string') {
						// Find the EntityType for this table (with underscore suffix)
						// Match: <EntityType Name="TableName_">...properties...</EntityType>
						const entityTypeRegex = new RegExp(
							`<EntityType\\s+Name="${table}_"[^>]*>([\\s\\S]*?)</EntityType>`,
							'i'
						);
						const entityMatch = entityTypeRegex.exec(metadataXml);

						if (entityMatch && entityMatch[1]) {
							const entityContent = entityMatch[1];
							// Extract Property names from the EntityType content
							const propertyRegex = /<Property\s+Name="([^"]+)"/g;
							let match;

							while ((match = propertyRegex.exec(entityContent)) !== null) {
								const fieldName = match[1];
								if (fieldName) {
									fields.push({
										name: fieldName,
										value: fieldName,
									});
								}
							}
						}
					}

					// Sort fields alphabetically
					fields.sort((a, b) => a.name.localeCompare(b.name));

					return fields;
				} catch (error) {
					// If loading fails, return empty array so user can still type manually
					return [];
				}
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		// Get credentials
		const credentials = await this.getCredentials('fileMakerODataApi');
		const host = (credentials.host as string).replace(/\/$/, '');
		const database = credentials.database as string;
		const authType = credentials.authType as string;

		// Build base URL - handle OttoFMS vs Basic Auth
		let baseUrl: string;
		if (authType === 'otto') {
			// OttoFMS uses /otto/fmi/odata/v4 path
			baseUrl = `${host}/otto/fmi/odata/v4/${encodeURIComponent(database)}`;
		} else {
			baseUrl = `${host}/fmi/odata/v4/${encodeURIComponent(database)}`;
		}

		// Build auth header
		let authHeader: string;
		if (authType === 'otto') {
			authHeader = `Bearer ${credentials.ottoApiKey}`;
		} else {
			const basicAuth = Buffer.from(
				`${credentials.username}:${credentials.password}`,
			).toString('base64');
			authHeader = `Basic ${basicAuth}`;
		}

		/**
		 * Encode OData filter expression for FileMaker
		 * FileMaker OData expects filter expressions to be minimally encoded.
		 * Per FileMaker documentation examples, most characters remain literal.
		 */
		const encodeODataFilter = (filter: string): string => {
			// FileMaker OData examples show filters with spaces, commas, quotes as literal characters
			// Only encode characters that absolutely break URL syntax: & # % (for query param safety)
			return filter
				.replace(/%/g, '%25') // Encode % first
				.replace(/&/g, '%26') // Ampersand
				.replace(/#/g, '%23'); // Hash
		};

		/**
		 * Build OData query string manually to avoid URLSearchParams encoding issues
		 * n8n's httpRequest qs option may over-encode OData parameters
		 */
		const buildODataQueryString = (qs: IDataObject): string => {
			const parts: string[] = [];

			if (qs.$filter) {
				const encodedFilter = encodeODataFilter(String(qs.$filter));
				parts.push(`$filter=${encodedFilter}`);
			}
			if (qs.$select) {
				// Remove spaces from $select - FileMaker expects comma-separated with no spaces
				const selectFields = String(qs.$select).replace(/\s+/g, '');
				parts.push(`$select=${selectFields}`);
			}
			if (qs.$expand) {
				parts.push(`$expand=${encodeURIComponent(String(qs.$expand))}`);
			}
			if (qs.$orderby) {
				parts.push(`$orderby=${encodeURIComponent(String(qs.$orderby))}`);
			}
			if (qs.$top !== undefined) {
				parts.push(`$top=${qs.$top}`);
			}
			if (qs.$skip !== undefined) {
				parts.push(`$skip=${qs.$skip}`);
			}
			if (qs.$count) {
				parts.push('$count=true');
			}

			return parts.join('&');
		};

		// Helper function to make requests
		const makeRequest = async (
			method: IHttpRequestMethods,
			endpoint: string,
			body?: IDataObject,
			qs?: IDataObject,
		): Promise<IDataObject> => {
			// Build URL with OData query string manually to avoid encoding issues
			let url = `${baseUrl}${endpoint}`;

			if (qs && Object.keys(qs).length > 0) {
				const queryString = buildODataQueryString(qs);
				if (queryString) {
					url += `?${queryString}`;
				}
			}

			const options: {
				method: IHttpRequestMethods;
				url: string;
				headers: Record<string, string>;
				body?: IDataObject;
				json: boolean;
			} = {
				method,
				url,
				headers: {
					Authorization: authHeader,
					'Content-Type': 'application/json',
					Accept: 'application/json',
				},
				json: true,
			};

			if (body) {
				options.body = body;
			}

			return this.helpers.httpRequest(options);
		};

		// Helper to format record key (UUID vs numeric)
		const formatKey = (key: string): string => {
			return isNaN(Number(key)) ? `'${key}'` : key;
		};

		for (let i = 0; i < items.length; i++) {
			try {
				let result: IDataObject | IDataObject[] | number | string | undefined;

				if (resource === 'record') {
					const table = this.getNodeParameter('table', i) as string;

					switch (operation) {
						case 'getMany': {
							const options = this.getNodeParameter('options', i, {}) as IDataObject;
							const qs: IDataObject = {};
							if (options.filter) qs.$filter = options.filter;
							if (options.select) {
								// Handle both array (multiOptions) and string formats
								qs.$select = Array.isArray(options.select) 
									? (options.select as string[]).join(',') 
									: options.select;
							}
							if (options.expand) qs.$expand = options.expand;
							if (options.orderby) qs.$orderby = options.orderby;
							if (options.top) qs.$top = options.top;
							if (options.skip) qs.$skip = options.skip;
							if (options.count) qs.$count = 'true';
							result = await makeRequest('GET', `/${encodeURIComponent(table)}`, undefined, qs);
							break;
						}

						case 'get': {
							const key = this.getNodeParameter('key', i) as string;
							const options = this.getNodeParameter('getOptions', i, {}) as IDataObject;
							const qs: IDataObject = {};
							if (options.select) {
								// Handle both array (multiOptions) and string formats
								qs.$select = Array.isArray(options.select) 
									? (options.select as string[]).join(',') 
									: options.select;
							}
							if (options.expand) qs.$expand = options.expand;
							result = await makeRequest(
								'GET',
								`/${encodeURIComponent(table)}(${formatKey(key)})`,
								undefined,
								qs,
							);
							break;
						}

						case 'getCount': {
							const options = this.getNodeParameter('countOptions', i, {}) as IDataObject;
							// Build URL with filter manually to avoid encoding issues
							let countUrl = `${baseUrl}/${encodeURIComponent(table)}/$count`;
							if (options.filter) {
								const encodedFilter = encodeODataFilter(String(options.filter));
								countUrl += `?$filter=${encodedFilter}`;
							}
							const response = await this.helpers.httpRequest({
								method: 'GET',
								url: countUrl,
								headers: {
									Authorization: authHeader,
									Accept: 'text/plain',
								},
							});
							result = { count: parseInt(response as string, 10) };
							break;
						}

						case 'getFieldValue': {
							const key = this.getNodeParameter('key', i) as string;
							const field = this.getNodeParameter('field', i) as string;
							const response = await this.helpers.httpRequest({
								method: 'GET',
								url: `${baseUrl}/${encodeURIComponent(table)}(${formatKey(key)})/${encodeURIComponent(field)}/$value`,
								headers: {
									Authorization: authHeader,
								},
							});
							result = { value: response };
							break;
						}

						case 'getRelated': {
							const key = this.getNodeParameter('key', i) as string;
							const navigation = this.getNodeParameter('navigation', i) as string;
							const options = this.getNodeParameter('relatedOptions', i, {}) as IDataObject;
							const qs: IDataObject = {};
							if (options.filter) qs.$filter = options.filter;
							if (options.select) {
								// Handle both array (multiOptions) and string formats
								qs.$select = Array.isArray(options.select) 
									? (options.select as string[]).join(',') 
									: options.select;
							}
							if (options.top) qs.$top = options.top;
							if (options.skip) qs.$skip = options.skip;
							result = await makeRequest(
								'GET',
								`/${encodeURIComponent(table)}(${formatKey(key)})/${encodeURIComponent(navigation)}`,
								undefined,
								qs,
							);
							break;
						}

						case 'create': {
							const dataString = this.getNodeParameter('data', i) as string;
							const data = JSON.parse(dataString);
							result = await makeRequest('POST', `/${encodeURIComponent(table)}`, data);
							break;
						}

						case 'update': {
							const key = this.getNodeParameter('key', i) as string;
							const dataString = this.getNodeParameter('data', i) as string;
							const data = JSON.parse(dataString);
							result = await makeRequest(
								'PATCH',
								`/${encodeURIComponent(table)}(${formatKey(key)})`,
								data,
							);
							break;
						}

						case 'delete': {
							const key = this.getNodeParameter('key', i) as string;
							await makeRequest('DELETE', `/${encodeURIComponent(table)}(${formatKey(key)})`);
							result = { success: true };
							break;
						}
					}
				} else if (resource === 'table') {
					switch (operation) {
						case 'list':
							result = await makeRequest('GET', '');
							break;
						case 'getMetadata':
							const response = await this.helpers.httpRequest({
								method: 'GET',
								url: `${baseUrl}/$metadata`,
								headers: {
									Authorization: authHeader,
									Accept: 'application/xml',
								},
							});
							result = { metadata: response };
							break;
					}
				} else if (resource === 'schema') {
					switch (operation) {
						case 'createTable': {
							const tableName = this.getNodeParameter('tableName', i) as string;
							const fieldsData = this.getNodeParameter('fields', i) as IDataObject;
							const fields = (fieldsData.field as IDataObject[]) || [];
							const body = {
								TableName: tableName,
								Fields: fields.map((f) => ({
									Name: f.name,
									Type: f.type,
									Nullable: f.nullable ?? true,
								})),
							};
							await makeRequest('POST', '/FileMaker_Tables', body);
							result = { success: true, tableName };
							break;
						}

						case 'addFields': {
							const table = this.getNodeParameter('table', i) as string;
							const fieldsData = this.getNodeParameter('newFields', i) as IDataObject;
							const fields = (fieldsData.field as IDataObject[]) || [];
							const body = {
								Fields: fields.map((f) => ({
									Name: f.name,
									Type: f.type,
									Nullable: f.nullable ?? true,
								})),
							};
							await makeRequest('POST', `/${encodeURIComponent(table)}/FileMaker_Fields`, body);
							result = { success: true, table, fieldsAdded: fields.length };
							break;
						}

						case 'deleteTable': {
							const table = this.getNodeParameter('table', i) as string;
							await makeRequest('DELETE', `/FileMaker_Tables('${encodeURIComponent(table)}')`);
							result = { success: true, table };
							break;
						}

						case 'deleteField': {
							const table = this.getNodeParameter('table', i) as string;
							const field = this.getNodeParameter('fieldToDelete', i) as string;
							await makeRequest(
								'DELETE',
								`/${encodeURIComponent(table)}/FileMaker_Fields('${encodeURIComponent(field)}')`,
							);
							result = { success: true, table, field };
							break;
						}
					}
				} else if (resource === 'script') {
					if (operation === 'run') {
						const script = this.getNodeParameter('script', i) as string;
						const param = this.getNodeParameter('scriptParam', i, '') as string;

						// Script endpoint uses POST with scriptParameterValue in body
						const body = param ? { scriptParameterValue: param } : {};
						result = await makeRequest('POST', `/Script.${encodeURIComponent(script)}`, body);
					}
				}

				// Handle response
				if (result !== undefined) {
					if (
						typeof result === 'object' &&
						result !== null &&
						'value' in result &&
						Array.isArray(result.value)
					) {
						// OData collection response
						for (const item of result.value as IDataObject[]) {
							returnData.push({
								json: item,
								pairedItem: { item: i },
							});
						}
						if (result['@odata.count'] !== undefined) {
							returnData.push({
								json: { '@odata.count': result['@odata.count'] },
								pairedItem: { item: i },
							});
						}
					} else {
						returnData.push({
							json: result as IDataObject,
							pairedItem: { item: i },
						});
					}
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
