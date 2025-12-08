import type {
	IExecuteFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
	IHttpRequestMethods,
	IDataObject,
	IHttpRequestOptions,
} from 'n8n-workflow';

/**
 * Make a request to the FileMaker OData API
 */
export async function filemakerApiRequest(
	this: IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body?: IDataObject,
	qs: IDataObject = {},
) {
	const credentials = await this.getCredentials('fileMakerODataApi');

	const host = (credentials.host as string).replace(/\/$/, '');
	const database = credentials.database as string;

	const options: IHttpRequestOptions = {
		method,
		url: `${host}/fmi/odata/v4/${encodeURIComponent(database)}${endpoint}`,
		qs,
		body,
		json: true,
	};

	return this.helpers.httpRequestWithAuthentication.call(this, 'fileMakerODataApi', options);
}

/**
 * Format a record key for OData URL (handles UUID vs numeric keys)
 */
export function formatRecordKey(key: string): string {
	// If it's a number, use as-is; otherwise wrap in quotes for UUID
	return isNaN(Number(key)) ? `'${key}'` : key;
}

