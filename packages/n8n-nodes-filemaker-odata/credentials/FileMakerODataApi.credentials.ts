import type {
	IAuthenticateGeneric,
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

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization:
					'={{$credentials.authType === "otto" ? "KEY " + $credentials.ottoApiKey : "Basic " + $credentials.username.concat(":").concat($credentials.password).toBase64()}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.host}}',
			url: '=/fmi/odata/v4/{{$credentials.database}}',
			method: 'GET',
		},
	};
}
