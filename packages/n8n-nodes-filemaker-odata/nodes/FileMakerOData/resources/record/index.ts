import type { INodeProperties } from 'n8n-workflow';
import { tableNameField, recordKeyField } from '../../shared/descriptions';

const showOnlyForRecord = {
	resource: ['record'],
};

export const recordDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForRecord,
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a record',
				description: 'Create a new record in a table',
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a record',
				description: 'Delete a record by primary key',
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a record',
				description: 'Get a single record by primary key',
			},
			{
				name: 'Get Count',
				value: 'getCount',
				action: 'Get record count',
				description: 'Get the count of records in a table',
			},
			{
				name: 'Get Field Value',
				value: 'getFieldValue',
				action: 'Get field value',
				description: 'Get a specific field value from a record',
			},
			{
				name: 'Get Many',
				value: 'getMany',
				action: 'Get many records',
				description: 'Query multiple records with filters and pagination',
			},
			{
				name: 'Get Related',
				value: 'getRelated',
				action: 'Get related records',
				description: 'Navigate to related records through a relationship',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a record',
				description: 'Update an existing record by primary key',
			},
		],
		default: 'getMany',
	},
	{
		...tableNameField,
		displayOptions: {
			show: showOnlyForRecord,
		},
	},
	// Record Key - for operations that need it
	{
		...recordKeyField,
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['get', 'update', 'delete', 'getFieldValue', 'getRelated'],
			},
		},
	},
	// Field name - for getFieldValue
	{
		displayName: 'Field Name',
		name: 'field',
		type: 'string',
		default: '',
		required: true,
		description: 'The name of the field to retrieve',
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['getFieldValue'],
			},
		},
	},
	// Navigation property - for getRelated
	{
		displayName: 'Navigation Property',
		name: 'navigation',
		type: 'string',
		default: '',
		required: true,
		description: 'The navigation property (relationship) name',
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['getRelated'],
			},
		},
	},
	// Data - for create/update
	{
		displayName: 'Record Data',
		name: 'data',
		type: 'json',
		default: '{}',
		required: true,
		description: 'Record data as JSON object',
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['create', 'update'],
			},
		},
	},
	// Query options for getMany
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['getMany'],
			},
		},
		options: [
			{
				displayName: 'Filter',
				name: 'filter',
				type: 'string',
				default: '',
				description: "OData $filter expression (e.g., \"Name eq 'John'\")",
			},
			{
				displayName: 'Select Fields',
				name: 'select',
				type: 'multiOptions',
				typeOptions: {
					loadOptionsMethod: 'loadFields',
					loadOptionsDependsOn: ['table'],
				},
				default: [],
				description: 'Fields to return (leave empty for all fields)',
			},
			{
				displayName: 'Expand Relations',
				name: 'expand',
				type: 'string',
				default: '',
				description: 'Navigation properties to expand',
			},
			{
				displayName: 'Order By',
				name: 'orderby',
				type: 'string',
				default: '',
				description: 'Field to sort by (e.g., "Name asc" or "CreatedAt desc")',
			},
			{
				displayName: 'Limit',
				name: 'top',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				default: 100,
				description: 'Max number of results to return',
			},
			{
				displayName: 'Skip',
				name: 'skip',
				type: 'number',
				typeOptions: {
					minValue: 0,
				},
				default: 0,
				description: 'Number of records to skip (for pagination)',
			},
			{
				displayName: 'Include Count',
				name: 'count',
				type: 'boolean',
				default: false,
				description: 'Whether to include total count in response',
			},
		],
	},
	// Query options for get single record
	{
		displayName: 'Options',
		name: 'getOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['get'],
			},
		},
		options: [
			{
				displayName: 'Select Fields',
				name: 'select',
				type: 'multiOptions',
				typeOptions: {
					loadOptionsMethod: 'loadFields',
					loadOptionsDependsOn: ['table'],
				},
				default: [],
				description: 'Fields to return (leave empty for all fields)',
			},
			{
				displayName: 'Expand Relations',
				name: 'expand',
				type: 'string',
				default: '',
				description: 'Navigation properties to expand',
			},
		],
	},
	// Query options for getRelated
	{
		displayName: 'Options',
		name: 'relatedOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['getRelated'],
			},
		},
		options: [
			{
				displayName: 'Filter',
				name: 'filter',
				type: 'string',
				default: '',
				description: 'OData $filter expression',
			},
			{
				displayName: 'Select Fields',
				name: 'select',
				type: 'multiOptions',
				typeOptions: {
					loadOptionsMethod: 'loadFields',
					loadOptionsDependsOn: ['table'],
				},
				default: [],
				description: 'Fields to return (leave empty for all fields)',
			},
			{
				displayName: 'Limit',
				name: 'top',
				type: 'number',
				default: 100,
				description: 'Max number of results to return',
			},
			{
				displayName: 'Skip',
				name: 'skip',
				type: 'number',
				default: 0,
				description: 'Number of records to skip',
			},
		],
	},
	// Query options for getCount
	{
		displayName: 'Options',
		name: 'countOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['getCount'],
			},
		},
		options: [
			{
				displayName: 'Filter',
				name: 'filter',
				type: 'string',
				default: '',
				description: 'OData $filter expression',
			},
		],
	},
];
