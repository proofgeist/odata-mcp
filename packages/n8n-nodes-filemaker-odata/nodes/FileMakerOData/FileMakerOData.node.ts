import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow';
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
		requestDefaults: {
			baseURL:
				'={{$credentials.host.replace(/\\/$/, "")}}/fmi/odata/v4/{{encodeURIComponent($credentials.database)}}',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
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
}
