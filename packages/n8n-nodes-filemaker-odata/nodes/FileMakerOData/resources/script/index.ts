import type { INodeProperties } from 'n8n-workflow';
import { tableNameField } from '../../shared/descriptions';

const showOnlyForScript = {
	resource: ['script'],
};

export const scriptDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForScript,
		},
		options: [
			{
				name: 'Run Script',
				value: 'run',
				action: 'Run a script',
				description: 'Run a FileMaker script',
				routing: {
					request: {
						method: 'GET',
						url: '=/{{$parameter.table}}/Script.{{encodeURIComponent($parameter.script)}}',
					},
				},
			},
		],
		default: 'run',
	},
	{
		...tableNameField,
		displayOptions: {
			show: showOnlyForScript,
		},
	},
	{
		displayName: 'Script Name',
		name: 'script',
		type: 'string',
		default: '',
		required: true,
		description: 'The name of the script to run',
		displayOptions: {
			show: showOnlyForScript,
		},
	},
	{
		displayName: 'Script Parameter',
		name: 'scriptParam',
		type: 'string',
		default: '',
		description: 'Optional parameter to pass to the script',
		displayOptions: {
			show: showOnlyForScript,
		},
		routing: {
			send: {
				type: 'query',
				property: '$parameter',
				value: '={{$value || undefined}}',
			},
		},
	},
];

