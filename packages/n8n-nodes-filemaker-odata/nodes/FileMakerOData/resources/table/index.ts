import type { INodeProperties } from 'n8n-workflow';

const showOnlyForTable = {
	resource: ['table'],
};

export const tableDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForTable,
		},
		options: [
			{
				name: 'List Tables',
				value: 'list',
				action: 'List all tables',
				description: 'Get a list of all tables in the database',
				routing: {
					request: {
						method: 'GET',
						url: '',
					},
				},
			},
			{
				name: 'Get Metadata',
				value: 'getMetadata',
				action: 'Get metadata',
				description: 'Get OData metadata schema for the database',
				routing: {
					request: {
						method: 'GET',
						url: '/$metadata',
						headers: {
							Accept: 'application/xml',
						},
					},
				},
			},
		],
		default: 'list',
	},
];

