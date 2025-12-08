import type {
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class FileMakerODataApi implements ICredentialType {
	name = 'fileMakerODataApi';

	displayName = 'FileMaker OData API';

	icon: Icon = 'file:../icons/filemaker.svg';

	documentationUrl = 'https://github.com/proofgeist/fmodata';

	properties: INodeProperties[] = [
		{
			displayName: 'Host',
			name: 'host',
			type: 'string',
			default: '',
			placeholder: 'https://your-server.example.com',
			description: 'The FileMaker Server host URL (include https://)',
			required: true,
		},
		{
			displayName: 'Database',
			name: 'database',
			type: 'string',
			default: '',
			placeholder: 'YourDatabase',
			description: 'The name of the FileMaker database',
			required: true,
		},
		{
			displayName: 'Authentication Type',
			name: 'authType',
			type: 'options',
			options: [
				{
					name: 'OttoFMS API Key',
					value: 'otto',
				},
				{
					name: 'Basic Auth',
					value: 'basic',
				},
			],
			default: 'otto',
		},
		{
			displayName: 'OttoFMS API Key',
			name: 'ottoApiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			placeholder: 'dk_your-api-key',
			description: 'OttoFMS API key (starts with dk_)',
			displayOptions: {
				show: {
					authType: ['otto'],
				},
			},
		},
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
			displayOptions: {
				show: {
					authType: ['basic'],
				},
			},
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			displayOptions: {
				show: {
					authType: ['basic'],
				},
			},
		},
	];

	// Note: We can't use authenticate with dynamic paths, so we handle auth in the node's execute function
	// The test request below handles auth manually via the testedBy function

	test: ICredentialTestRequest = {
		request: {
			baseURL:
				'={{$credentials.host.replace(/\\/$/, "")}}',
			url: '={{$credentials.authType === "otto" ? "/otto/fmi/odata/v4/" + encodeURIComponent($credentials.database) : "/fmi/odata/v4/" + encodeURIComponent($credentials.database)}}',
			method: 'GET',
			headers: {
				Authorization:
					'={{$credentials.authType === "otto" ? "Bearer " + $credentials.ottoApiKey : "Basic " + Buffer.from($credentials.username + ":" + $credentials.password).toString("base64")}}',
			},
		},
	};
}
