import {
	NodeConnectionTypes,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type IDataObject,
	NodeOperationError,
} from 'n8n-workflow';
import { ODataApi, FetchAdapter, OttoAdapter, type ODataApiClient } from 'fmodata';
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

		// Create the fmodata client
		let client: ODataApiClient;

		if (authType === 'otto') {
			const apiKey = credentials.ottoApiKey as string;
			client = ODataApi({
				adapter: new OttoAdapter({
					server: host,
					database,
					auth: { apiKey: apiKey as `dk_${string}` },
				}),
			});
		} else {
			client = ODataApi({
				adapter: new FetchAdapter({
					server: host,
					database,
					auth: {
						username: credentials.username as string,
						password: credentials.password as string,
					},
				}),
			});
		}

		for (let i = 0; i < items.length; i++) {
			try {
				let result: unknown;

				if (resource === 'record') {
					const table = this.getNodeParameter('table', i) as string;

					switch (operation) {
						case 'getMany': {
							const options = this.getNodeParameter('options', i, {}) as IDataObject;
							result = await client.getRecords(table, {
								$filter: options.filter as string | undefined,
								$select: options.select as string | undefined,
								$expand: options.expand as string | undefined,
								$orderby: options.orderby as string | undefined,
								$top: options.top as number | undefined,
								$skip: options.skip as number | undefined,
								$count: options.count as boolean | undefined,
							});
							break;
						}

						case 'get': {
							const key = this.getNodeParameter('key', i) as string;
							const options = this.getNodeParameter('getOptions', i, {}) as IDataObject;
							result = await client.getRecord(table, key, {
								$select: options.select as string | undefined,
								$expand: options.expand as string | undefined,
							});
							break;
						}

						case 'getCount': {
							const options = this.getNodeParameter('countOptions', i, {}) as IDataObject;
							result = await client.getRecordCount(table, {
								$filter: options.filter as string | undefined,
							});
							break;
						}

						case 'getFieldValue': {
							const key = this.getNodeParameter('key', i) as string;
							const field = this.getNodeParameter('field', i) as string;
							result = await client.getFieldValue(table, key, field);
							break;
						}

						case 'getRelated': {
							const key = this.getNodeParameter('key', i) as string;
							const navigation = this.getNodeParameter('navigation', i) as string;
							const options = this.getNodeParameter('relatedOptions', i, {}) as IDataObject;
							result = await client.navigateRelated(table, key, navigation, {
								$filter: options.filter as string | undefined,
								$select: options.select as string | undefined,
								$top: options.top as number | undefined,
								$skip: options.skip as number | undefined,
							});
							break;
						}

						case 'create': {
							const dataString = this.getNodeParameter('data', i) as string;
							const data = JSON.parse(dataString);
							result = await client.createRecord(table, { data });
							break;
						}

						case 'update': {
							const key = this.getNodeParameter('key', i) as string;
							const dataString = this.getNodeParameter('data', i) as string;
							const data = JSON.parse(dataString);
							result = await client.updateRecord(table, key, { data });
							break;
						}

						case 'delete': {
							const key = this.getNodeParameter('key', i) as string;
							await client.deleteRecord(table, key);
							result = { success: true };
							break;
						}
					}
				} else if (resource === 'table') {
					switch (operation) {
						case 'list':
							result = await client.getTables();
							break;
						case 'getMetadata':
							result = await client.getMetadata();
							break;
					}
				} else if (resource === 'schema') {
					switch (operation) {
						case 'createTable': {
							const tableName = this.getNodeParameter('tableName', i) as string;
							const fieldsData = this.getNodeParameter('fields', i) as IDataObject;
							const fields = (fieldsData.field as IDataObject[]) || [];
							await client.createTable({
								tableName,
								fields: fields.map((f) => ({
									name: f.name as string,
									type: f.type as 'VARCHAR' | 'NUMERIC' | 'INT' | 'DATE' | 'TIME' | 'TIMESTAMP' | 'DECIMAL' | 'BLOB' | 'VARBINARY' | 'LONGVARBINARY' | 'BINARY VARYING' | 'CHARACTER VARYING',
									nullable: f.nullable as boolean | undefined,
								})),
							});
							result = { success: true, tableName };
							break;
						}

						case 'addFields': {
							const table = this.getNodeParameter('table', i) as string;
							const fieldsData = this.getNodeParameter('newFields', i) as IDataObject;
							const fields = (fieldsData.field as IDataObject[]) || [];
							await client.addFields(table, {
								fields: fields.map((f) => ({
									name: f.name as string,
									type: f.type as 'VARCHAR' | 'NUMERIC' | 'INT' | 'DATE' | 'TIME' | 'TIMESTAMP' | 'DECIMAL' | 'BLOB' | 'VARBINARY' | 'LONGVARBINARY' | 'BINARY VARYING' | 'CHARACTER VARYING',
									nullable: f.nullable as boolean | undefined,
								})),
							});
							result = { success: true, table, fieldsAdded: fields.length };
							break;
						}

						case 'deleteTable': {
							const table = this.getNodeParameter('table', i) as string;
							await client.deleteTable(table);
							result = { success: true, table };
							break;
						}

						case 'deleteField': {
							const table = this.getNodeParameter('table', i) as string;
							const field = this.getNodeParameter('fieldToDelete', i) as string;
							await client.deleteField(table, field);
							result = { success: true, table, field };
							break;
						}
					}
				} else if (resource === 'script') {
					if (operation === 'run') {
						const script = this.getNodeParameter('script', i) as string;
						const param = this.getNodeParameter('scriptParam', i, '') as string;
						result = await client.runScript({
							script,
							param: param || undefined,
						});
					}
				}

				// Handle different response types
				if (result !== undefined) {
					if (typeof result === 'object' && result !== null && 'value' in (result as object) && Array.isArray((result as { value: unknown[] }).value)) {
						// OData collection response - return each item separately
						const odataResult = result as { value: IDataObject[]; '@odata.count'?: number };
						for (const item of odataResult.value) {
							returnData.push({
								json: item,
								pairedItem: { item: i },
							});
						}
						// Include count if present
						if (odataResult['@odata.count'] !== undefined) {
							returnData.push({
								json: { '@odata.count': odataResult['@odata.count'] },
								pairedItem: { item: i },
							});
						}
					} else if (typeof result === 'number') {
						// Count result
						returnData.push({
							json: { count: result },
							pairedItem: { item: i },
						});
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
