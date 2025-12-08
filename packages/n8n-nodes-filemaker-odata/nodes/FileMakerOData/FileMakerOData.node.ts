import {
	NodeConnectionTypes,
	type IExecuteFunctions,
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

		// Helper function to make requests
		const makeRequest = async (
			method: IHttpRequestMethods,
			endpoint: string,
			body?: IDataObject,
			qs?: IDataObject,
		): Promise<IDataObject> => {
			// Build query string manually to handle OData $ params properly
			let url = `${baseUrl}${endpoint}`;
			if (qs && Object.keys(qs).length > 0) {
				const params = new URLSearchParams();
				for (const [key, value] of Object.entries(qs)) {
					if (value !== undefined && value !== null && value !== '') {
						params.append(key, String(value));
					}
				}
				const queryString = params.toString();
				if (queryString) {
					url += `?${queryString}`;
				}
			}

			const options = {
				method,
				url,
				headers: {
					Authorization: authHeader,
					'Content-Type': 'application/json',
					Accept: 'application/json',
				},
				body,
				json: true,
			};

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
							if (options.select) qs.$select = options.select;
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
							if (options.select) qs.$select = options.select;
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
							const qs: IDataObject = {};
							if (options.filter) qs.$filter = options.filter;
							const response = await this.helpers.httpRequest({
								method: 'GET',
								url: `${baseUrl}/${encodeURIComponent(table)}/$count`,
								headers: {
									Authorization: authHeader,
									Accept: 'text/plain',
								},
								qs,
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
							if (options.select) qs.$select = options.select;
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
