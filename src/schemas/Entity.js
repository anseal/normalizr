import { isImmutable } from './ImmutableUtils.js'

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

	normalize(input, parent, key, entities, visitedEntities) {
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
					entities,
					visitedEntities
				)
			}
		})

		if (entityType in entities === false) {
			entities[entityType] = {}
		}
		const entitiesOfKind = entities[entityType]
	
		const existingEntity = entitiesOfKind[id]
		if (existingEntity) {
			entitiesOfKind[id] = this._mergeStrategy(existingEntity, processedEntity)
		} else {
			entitiesOfKind[id] = processedEntity
		}
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

	normalize(input, parent, key, entities, visitedEntities) {
		const object = { ...input }
		Object.keys(this.schema).forEach((key) => {
			const localSchema = this.schema[key]
			const resolvedLocalSchema = typeof localSchema === 'function' ? localSchema(input) : localSchema
			const value = visit(input[key], input, key, resolvedLocalSchema, entities, visitedEntities)
			if (value === undefined || value === null) {
				delete object[key]
			} else {
				object[key] = value
			}
		})
		return object
	}
}

class PolymorphicSchema {
	constructor(definition, schemaAttribute) {
		if (schemaAttribute) {
			this._schemaAttribute = typeof schemaAttribute === 'string' ? (input) => input[schemaAttribute] : schemaAttribute
		}
		this.define(definition)
	}

	define(definition) {
		this.schema = definition
	}

	normalizeValue(value, parent, key, entities, visitedEntities) {
		// TODO: get rid of `let`
		let schema
		let attr
		if (!this._schemaAttribute) {
			schema = this.schema
		} else {
			attr = this._schemaAttribute && this._schemaAttribute(value, parent, key)
			schema = this.schema[attr]
		}

		if (!schema) {
			return value
		}
		const normalizedValue = visit(value, parent, key, schema, entities, visitedEntities)
		return !this._schemaAttribute || normalizedValue === undefined || normalizedValue === null
			? normalizedValue
			: {
				id: normalizedValue,
				schema: attr
			}
	}
}

export class ValuesSchema extends PolymorphicSchema {
	normalize(input, parent, key, entities, visitedEntities) {
		return Object.keys(input).reduce((output, key) => {
			const value = input[key]
			return value !== undefined && value !== null
				? {
						...output,
						[key]: this.normalizeValue(value, input, key, entities, visitedEntities),
				  }
				: output
		}, {})
	}
}

export class ArraySchema extends PolymorphicSchema {
	constructor(definition, schemaAttribute, filterNullish = true) {
		super(definition, schemaAttribute)
		this.filterNullish = filterNullish
	}
	normalize(input, parent, key, entities, visitedEntities) {
		// TODO: what is it for? in denormalization - probably. but here... why? maybe replace with
		// const values = input
		const values = getValues(input)

		// TODO: preallocate, and then cut by length?
		const normArray = []
		for(const value of values) {
			// Special case: Arrays pass *their* parent on to their children, since there
			// is not any special information that can be gathered from themselves directly
			const normValue = this.normalizeValue(value, parent, key, entities, visitedEntities)
			// TODO: what is it for, and why here and not before `normalizeValue`?
			// TODO: filtration of falsies present in tests, but not in docs, and I have no idea why the difference
			// between [mySchema] and schema.Array(mySchema)
			if( this.filterNullish === false || (normValue !== undefined && normValue !== null) ) {
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

	normalize(input, parent, key, entities, visitedEntities) {
		return this.normalizeValue(input, parent, key, entities, visitedEntities)
	}
}

export const visit = (value, parent, key, schema, entities, visitedEntities) => {
	// TODO: why `!value` and not `value === null` ? because `0` will be returned and `1` will be `normalize`d
	if (typeof value !== 'object' || !value) {
		return value
	}

	// TODO: I suppose this is for [schema] and {schema} shortcuts... but it has a flavor of monkey-patching
	if (typeof schema === 'object' && (!schema.normalize || typeof schema.normalize !== 'function')) {
		schema = Array.isArray(schema) ? new ArraySchema(validateSchema(schema), undefined, false) : new ObjectSchema(schema)
	}

	return schema.normalize(value, parent, key, entities, visitedEntities)
}

export const getValues = (input) => (Array.isArray(input) ? input : Object.keys(input).map((key) => input[key]))

export const validateSchema = (definition) => {
	const isArray = Array.isArray(definition)
	if (isArray && definition.length > 1) {
		throw new Error(`Expected schema definition to be a single schema, but found ${definition.length}.`)
	}

	return definition[0]
}
