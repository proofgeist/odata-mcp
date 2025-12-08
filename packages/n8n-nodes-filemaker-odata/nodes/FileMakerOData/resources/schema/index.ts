import type { INodeProperties } from 'n8n-workflow';
import { tableNameField, fieldTypes } from '../../shared/descriptions';

const showOnlyForSchema = {
	resource: ['schema'],
};

export const schemaDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForSchema,
		},
		options: [
			{
				name: 'Add Fields',
				value: 'addFields',
				action: 'Add fields to a table',
				description: 'Add fields to an existing table',
				routing: {
					request: {
						method: 'POST',
						url: '=/{{$parameter.table}}/FileMaker_Fields',
					},
				},
			},
			{
				name: 'Create Table',
				value: 'createTable',
				action: 'Create a table',
				description: 'Create a new table in the database',
				routing: {
					request: {
						method: 'POST',
						url: '/FileMaker_Tables',
					},
				},
			},
			{
				name: 'Delete Field',
				value: 'deleteField',
				action: 'Delete a field',
				description: 'Delete a field from a table',
				routing: {
					request: {
						method: 'DELETE',
						url: "=/{{$parameter.table}}/FileMaker_Fields('{{$parameter.fieldToDelete}}')",
					},
				},
			},
			{
				name: 'Delete Table',
				value: 'deleteTable',
				action: 'Delete a table',
				description: 'Delete a table from the database',
				routing: {
					request: {
						method: 'DELETE',
						url: "=/FileMaker_Tables('{{$parameter.table}}')",
					},
				},
			},
		],
		default: 'createTable',
	},
	// Table name for addFields, deleteTable, deleteField
	{
		...tableNameField,
		displayOptions: {
			show: {
				resource: ['schema'],
				operation: ['addFields', 'deleteTable', 'deleteField'],
			},
		},
	},
	// New table name for createTable
	{
		displayName: 'New Table Name',
		name: 'tableName',
		type: 'string',
		default: '',
		required: true,
		description: 'The name of the table to create',
		displayOptions: {
			show: {
				resource: ['schema'],
				operation: ['createTable'],
			},
		},
	},
	// Fields for createTable
	{
		displayName: 'Fields',
		name: 'fields',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		default: {},
		required: true,
		description: 'Fields to create in the table',
		displayOptions: {
			show: {
				resource: ['schema'],
				operation: ['createTable'],
			},
		},
		options: [
			{
				name: 'field',
				displayName: 'Field',
				values: [
					{
						displayName: 'Name',
						name: 'name',
						type: 'string',
						default: '',
						required: true,
						description: 'Field name',
					},
					{
						displayName: 'Type',
						name: 'type',
						type: 'options',
						options: fieldTypes,
						default: 'VARCHAR',
						description: 'Field data type',
					},
					{
						displayName: 'Nullable',
						name: 'nullable',
						type: 'boolean',
						default: true,
						description: 'Whether the field can be null',
					},
				],
			},
		],
		routing: {
			send: {
				type: 'body',
				value:
					'={{ { "TableName": $parameter.tableName, "Fields": ($parameter.fields?.field || []).map(f => ({ "Name": f.name, "Type": f.type, "Nullable": f.nullable })) } }}',
			},
		},
	},
	// Fields for addFields
	{
		displayName: 'Fields',
		name: 'newFields',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		default: {},
		required: true,
		description: 'Fields to add to the table',
		displayOptions: {
			show: {
				resource: ['schema'],
				operation: ['addFields'],
			},
		},
		options: [
			{
				name: 'field',
				displayName: 'Field',
				values: [
					{
						displayName: 'Name',
						name: 'name',
						type: 'string',
						default: '',
						required: true,
						description: 'Field name',
					},
					{
						displayName: 'Type',
						name: 'type',
						type: 'options',
						options: fieldTypes,
						default: 'VARCHAR',
						description: 'Field data type',
					},
					{
						displayName: 'Nullable',
						name: 'nullable',
						type: 'boolean',
						default: true,
						description: 'Whether the field can be null',
					},
				],
			},
		],
		routing: {
			send: {
				type: 'body',
				value:
					'={{ { "Fields": ($parameter.newFields?.field || []).map(f => ({ "Name": f.name, "Type": f.type, "Nullable": f.nullable })) } }}',
			},
		},
	},
	// Field to delete
	{
		displayName: 'Field to Delete',
		name: 'fieldToDelete',
		type: 'string',
		default: '',
		required: true,
		description: 'The name of the field to delete',
		displayOptions: {
			show: {
				resource: ['schema'],
				operation: ['deleteField'],
			},
		},
	},
];

