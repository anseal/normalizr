import { isImmutable } from './ImmutableUtils.js'

const getDefaultGetId = (idAttribute) => (input) =>
	isImmutable(input) ? input.get(idAttribute) : input[idAttribute]

export const compileSchema = (schema) => {
	// TODO: looks like monkey-patching
	if (typeof schema === 'object' && (!schema.normalize || typeof schema.normalize !== 'function')) {
		if( Array.isArray(schema) ) {
			// TODO: schema.length === 0 ?
			if (schema.length > 1) {
				throw new Error(`Expected schema definition to be a single schema, but found ${schema.length}.`)
			}
			schema = new ArraySchema(schema[0], undefined, false)
		} else {
			schema = new ObjectSchema(schema)
		}
	}
	return schema
}

export class EntitySchema {
	constructor(key, definition = {}, options = {}) {
		if (!key || typeof key !== 'string') {
			throw new Error(`Expected a string key for Entity, but found ${key}.`)
		}

		const {
			idAttribute = 'id',
			mergeStrategy = (entityA, entityB) => ({ ...entityA, ...entityB }), // TODO: `Object.assign()` or even `retrun entityA` as a default
			processStrategy = (input) => ({ ...input }), // TODO: don't copy, at least before merge/return?
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
		// TODO: check if `definition` is an object?
		// TODO: check if it's a plain object, so that it's safe to iterate over schema without `hasOwnProperty`
		for(const key in definition) { definition[key] = compileSchema(definition[key]) }
		this.schema = Object.assign(this.schema || {}, definition);
	}

	getId(input, parent, key) {
		return this._getId(input, parent, key)
	}

	normalize(input, parent, key, entities, visited) {
		// TODO: why `!input` and not `input === null` ? because `0` will be returned and `1` will be `normalize`d
		if (typeof input !== 'object' || !input) {
			return input
		}
		const id = this.getId(input, parent, key)
		const entityType = this.key

		if(visited(input, entityType, id)) { return id }

		const processedEntity = this._processStrategy(input, parent, key)
		for(const key in this.schema) {
			if (processedEntity.hasOwnProperty(key) && typeof processedEntity[key] === 'object') { // TODO: switch places
				const schema = this.schema[key]
				const resolvedSchema = typeof schema === 'function' ? schema(input) : schema // TODO: function instead of if?
				processedEntity[key] = resolvedSchema.normalize(
					processedEntity[key],
					processedEntity,
					key,
					entities,
					visited
				)
			}
		}

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

	// TODO: DRY with EntitySchema.define?
	// TODO: now there is a difference, should we compile children schemas and should there be more tests?
	define(definition) {
		// TODO: check if `definition` is an object?
		// TODO: check if it's a plain object, so that it's safe to iterate over schema without `hasOwnProperty`
		this.schema = Object.assign(this.schema || {}, definition);
	}

	normalize(input, parent, key, entities, visited) {
		// TODO: why `!input` and not `input === null` ? because `0` will be returned and `1` will be `normalize`d
		if (typeof input !== 'object' || !input) {
			return input
		}
		// TODO: don't copy... why do we even need this? just iterate other `input`s keys and check if there's a schema for this key
		const object = { ...input }
		for(const key in this.schema) {
			const localSchema = this.schema[key] // TODO: DRY with `EntitySchema.normalize`
			const resolvedLocalSchema = typeof localSchema === 'function' ? localSchema(input) : localSchema
			const value = resolvedLocalSchema.normalize(input[key], input, key, entities, visited)
			if (value === undefined || value === null) { // TODO: options?
				delete object[key] // TODO: delete's are evil
			} else {
				object[key] = value
			}
		}
		return object
	}
}

class PolymorphicSchema {
	constructor(definition, schemaAttribute) {
		if (schemaAttribute) {
			this._schemaAttribute = typeof schemaAttribute === 'string' ? (input) => input[schemaAttribute] : schemaAttribute
			this._normalizeValue = this._normalizeValue2
		} else {
			this._normalizeValue = this._normalizeValue1
		}
		this.define(definition)
	}

	define(definition) {
		this.schema = definition
	}

	_normalizeValue1(value, parent, key, entities, visited) {
		if (!this.schema) { // TODO: _normalizeValue3?
			return value
		}
		return this.schema.normalize(value, parent, key, entities, visited)
	}

	_normalizeValue2(value, parent, key, entities, visited) {
		// TODO: just a function whould be simpler compared to function & map
		const attr = this._schemaAttribute(value, parent, key)
		const schema = this.schema[attr]

		if (!schema) { // TODO: can we precompile this?
			return value
		}
		const normalizedValue = schema.normalize(value, parent, key, entities, visited)
		return normalizedValue === undefined || normalizedValue === null
			? normalizedValue
			: {
				id: normalizedValue,
				schema: attr
			}
	}
}

export class ValuesSchema extends PolymorphicSchema {
	normalize(input, parent, key, entities, visited) {
		// TODO: why `!input` and not `input === null` ? because `0` will be returned and `1` will be `normalize`d
		if (typeof input !== 'object' || !input) {
			return input
		}
		const output = {}
		for(const key in input) { // TODO: hasOwnProperty?
			const value = input[key]
			if( value !== undefined && value !== null ) {
				output[key] = this._normalizeValue(value, input, key, entities, visited)
			}
		}
		return output
	}
}

export class ArraySchema extends PolymorphicSchema {
	constructor(definition, schemaAttribute, filterNullish = true) {
		super(definition, schemaAttribute)
		this.filterNullish = filterNullish
	}
	normalize(input, parent, key, entities, visited) {
		// TODO: why `!input` and not `input === null` ? because `0` will be returned and `1` will be `normalize`d
		if (typeof input !== 'object' || !input) {
			return input
		}
		// TODO: what is it for? maybe change API and remove?
		if( Array.isArray(input) === false ) {
			input = Object.keys(input).map((key) => input[key]) // TODO: Object.values()
		}

		// TODO: preallocate, and then cut by length?
		const normArray = []
		for(const value of input) {
			// Special case: Arrays pass *their* parent on to their children, since there
			// is not any special information that can be gathered from themselves directly
			const normValue = this._normalizeValue(value, parent, key, entities, visited)
			// TODO: what is it for, and why here and not before `_normalizeValue`?
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

	normalize(input, parent, key, entities, visited) {
		// TODO: why `!input` and not `input === null` ? because `0` will be returned and `1` will be `normalize`d
		if (typeof input !== 'object' || !input) {
			return input
		}
		return this._normalizeValue(input, parent, key, entities, visited) // TODO: something tells me that there is already a `!input` check inside
	}
}
