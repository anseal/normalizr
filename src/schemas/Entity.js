import { isImmutable } from './ImmutableUtils'

const getDefaultGetId = (idAttribute) => (input) =>
	isImmutable(input) ? input.get(idAttribute) : input[idAttribute]

export class EntitySchema {
	constructor(key, definition = {}, options = {}) {
		if (!key || typeof key !== 'string') {
			throw new Error(`Expected a string key for Entity, but found ${key}.`)
		}

		const {
			idAttribute = 'id',
			mergeStrategy = (entityA, entityB) => {
				return { ...entityA, ...entityB }
			},
			processStrategy = (input) => ({ ...input }),
		} = options

		this._key = key
		this._getId = typeof idAttribute === 'function' ? idAttribute : getDefaultGetId(idAttribute)
		this._idAttribute = idAttribute
		this._mergeStrategy = mergeStrategy
		this._processStrategy = processStrategy
		this.define(definition)
	}

	get key() {
		return this._key
	}

	get idAttribute() {
		return this._idAttribute
	}

	define(definition) {
		this.schema = Object.assign(this.schema || {}, definition);
	}

	getId(input, parent, key) {
		return this._getId(input, parent, key)
	}

	merge(entityA, entityB) {
		return this._mergeStrategy(entityA, entityB)
	}

	normalize(input, parent, key, addEntity, visitedEntities) {
		const id = this.getId(input, parent, key)
		const entityType = this.key

		if (!(entityType in visitedEntities)) {
			visitedEntities[entityType] = {}
		}
		if (!(id in visitedEntities[entityType])) {
			visitedEntities[entityType][id] = []
		}
		if (visitedEntities[entityType][id].some((entity) => entity === input)) {
			return id
		}
		visitedEntities[entityType][id].push(input)

		const processedEntity = this._processStrategy(input, parent, key)
		Object.keys(this.schema).forEach((key) => {
			if (processedEntity.hasOwnProperty(key) && typeof processedEntity[key] === 'object') {
				const schema = this.schema[key]
				const resolvedSchema = typeof schema === 'function' ? schema(input) : schema
				processedEntity[key] = visit(
					processedEntity[key],
					processedEntity,
					key,
					resolvedSchema,
					addEntity,
					visitedEntities
				)
			}
		})

		addEntity(this, processedEntity, input, parent, key)
		return id
	}
}

export class ObjectSchema {
	constructor(definition) {
		this.define(definition)
	}

	// TODO: DRY with EntitySchema.define
	define(definition) {
		this.schema = Object.assign(this.schema || {}, definition);
	}

	normalize(...args) {
		return normalizeObject(this.schema, ...args)
	}
}

class PolymorphicSchema {
	constructor(definition, schemaAttribute) {
		if (schemaAttribute) {
			this._schemaAttribute = typeof schemaAttribute === 'string' ? (input) => input[schemaAttribute] : schemaAttribute
		}
		this.define(definition)
	}

	get isSingleSchema() {
		return !this._schemaAttribute
	}

	define(definition) {
		this.schema = definition
	}

	getSchemaAttribute(input, parent, key) {
		return !this.isSingleSchema && this._schemaAttribute(input, parent, key)
	}

	inferSchema(input, parent, key) {
		if (this.isSingleSchema) {
			return this.schema
		}

		const attr = this.getSchemaAttribute(input, parent, key)
		return this.schema[attr]
	}

	normalizeValue(value, parent, key, addEntity, visitedEntities) {
		const schema = this.inferSchema(value, parent, key)
		if (!schema) {
			return value
		}
		const normalizedValue = visit(value, parent, key, schema, addEntity, visitedEntities)
		return this.isSingleSchema || normalizedValue === undefined || normalizedValue === null
			? normalizedValue
			: { id: normalizedValue, schema: this.getSchemaAttribute(value, parent, key) }
	}

	denormalizeValue(value, unvisit) {
		const schemaKey = isImmutable(value) ? value.get('schema') : value.schema
		if (!this.isSingleSchema && !schemaKey) {
			return value
		}
		const id = this.isSingleSchema ? undefined : isImmutable(value) ? value.get('id') : value.id
		const schema = this.isSingleSchema ? this.schema : this.schema[schemaKey]
		return unvisit(id || value, schema)
	}
}

export class ValuesSchema extends PolymorphicSchema {
	normalize(input, parent, key, addEntity, visitedEntities) {
		return Object.keys(input).reduce((output, key) => {
			const value = input[key]
			return value !== undefined && value !== null
				? {
						...output,
						[key]: this.normalizeValue(value, input, key, addEntity, visitedEntities),
				  }
				: output
		}, {})
	}
}

export class ArraySchema extends PolymorphicSchema {
	normalize(input, parent, key, addEntity, visitedEntities) {
		// TODO: what is it for? in denormalization - probably. but here... why?
		// const getValues = (input) => (Array.isArray(input) ? input : Object.keys(input).map((key) => input[key]))
		// maybe replace with
		// const values = input
		const values = getValues(input)

		// TODO: preallocate, and then cut by length?
		const normArray = []
		for(const value of values) {
			const normValue = this.normalizeValue(value, parent, key, addEntity, visitedEntities)
			// TODO: what is it for, and why here and not before `normalizeValue`?
			if( normValue !== undefined && normValue !== null ) {
				normArray.push(normValue)
			}
		}
		return normArray
	}
}

export class UnionSchema extends PolymorphicSchema {
	constructor(definition, schemaAttribute) {
		if (!schemaAttribute) {
			throw new Error('Expected option "schemaAttribute" not found on UnionSchema.')
		}
		super(definition, schemaAttribute)
	}

	normalize(input, parent, key, addEntity, visitedEntities) {
		return this.normalizeValue(input, parent, key, addEntity, visitedEntities)
	}
}

export const visit = (value, parent, key, schema, addEntity, visitedEntities) => {
	// TODO: why `!value` and not `value === null` ? because `0` will be returned and `1` will be `normalize`d
	if (typeof value !== 'object' || !value) {
		return value
	}

	// TODO: I suppose this is for [schema] and {schema} shortcuts... but it has a flavor of monkey-patching
	if (typeof schema === 'object' && (!schema.normalize || typeof schema.normalize !== 'function')) {
		const method = Array.isArray(schema) ? normalizeArray : normalizeObject
		return method(schema, value, parent, key, addEntity, visitedEntities)
	}

	return schema.normalize(value, parent, key, addEntity, visitedEntities)
}

export const getValues = (input) => (Array.isArray(input) ? input : Object.keys(input).map((key) => input[key]))

export const validateSchema = (definition) => {
	const isArray = Array.isArray(definition)
	if (isArray && definition.length > 1) {
		throw new Error(`Expected schema definition to be a single schema, but found ${definition.length}.`)
	}

	return definition[0]
}

export const normalizeArray = (schema, input, parent, key, addEntity, visitedEntities) => {
	schema = validateSchema(schema)

	const values = getValues(input)

	// Special case: Arrays pass *their* parent on to their children, since there
	// is not any special information that can be gathered from themselves directly
	return values.map((value) => visit(value, parent, key, schema, addEntity, visitedEntities))
}

export const normalizeObject = (schema, input, parent, key, addEntity, visitedEntities) => {
	const object = { ...input }
	Object.keys(schema).forEach((key) => {
		const localSchema = schema[key]
		const resolvedLocalSchema = typeof localSchema === 'function' ? localSchema(input) : localSchema
		const value = visit(input[key], input, key, resolvedLocalSchema, addEntity, visitedEntities)
		if (value === undefined || value === null) {
			delete object[key]
		} else {
			object[key] = value
		}
	})
	return object
}
