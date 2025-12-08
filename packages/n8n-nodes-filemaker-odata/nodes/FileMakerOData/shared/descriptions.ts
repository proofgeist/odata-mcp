import type { INodeProperties } from 'n8n-workflow';

export const tableNameField: INodeProperties = {
	displayName: 'Table Name',
	name: 'table',
	type: 'string',
	default: '',
	required: true,
	description: 'The name of the table',
};

export const recordKeyField: INodeProperties = {
	displayName: 'Record Key',
	name: 'key',
	type: 'string',
	default: '',
	required: true,
	description: 'Primary key value of the record (UUID or ROWID)',
};

export const fieldTypes = [
	{ name: 'Varchar', value: 'VARCHAR' },
	{ name: 'Numeric', value: 'NUMERIC' },
	{ name: 'Decimal', value: 'DECIMAL' },
	{ name: 'Int', value: 'INT' },
	{ name: 'Date', value: 'DATE' },
	{ name: 'Time', value: 'TIME' },
	{ name: 'Timestamp', value: 'TIMESTAMP' },
	{ name: 'Blob', value: 'BLOB' },
	{ name: 'Varbinary', value: 'VARBINARY' },
	{ name: 'Long Varbinary', value: 'LONGVARBINARY' },
	{ name: 'Binary Varying', value: 'BINARY VARYING' },
	{ name: 'Character Varying', value: 'CHARACTER VARYING' },
];

