import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class FileMakerODataApi implements ICredentialType {
	name = 'fileMakerODataApi';
	displayName = 'FileMaker OData API';
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
					description: 'Use OttoFMS API key authentication',
				},
				{
					name: 'Basic Auth',
					value: 'basic',
					description: 'Use FileMaker username and password',
				},
			],
			default: 'otto',
			description: 'The authentication method to use',
		},
		{
			displayName: 'OttoFMS API Key',
			name: 'ottoApiKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
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
			placeholder: 'your-username',
			description: 'FileMaker account username',
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
			typeOptions: {
				password: true,
			},
			default: '',
			description: 'FileMaker account password',
			displayOptions: {
				show: {
					authType: ['basic'],
				},
			},
		},
	];

	// Test the credentials by listing tables
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.host}}',
			url: '=/fmi/odata/v4/{{$credentials.database}}',
			method: 'GET',
		},
	};

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization:
					'={{$credentials.authType === "otto" ? "KEY " + $credentials.ottoApiKey : "Basic " + Buffer.from($credentials.username + ":" + $credentials.password).toString("base64")}}',
			},
		},
	};
}

