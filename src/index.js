const compileSchema = (schema) => {
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

const noMerge = (entityA, _entityB) => entityA
const simpleMerge = (entityA, entityB) => Object.assign(entityA, entityB)
const defaultMerge = noMerge
// const defaultMerge = simpleMerge

// let cnt1 = 0;
// let cnt2 = 0;

class EntitySchema {
	constructor(key, definition = {}, options = {}) {
		if (!key || typeof key !== 'string') {
			throw new Error(`Expected a string key for Entity, but found ${key}.`)
		}

		const {
			idAttribute = 'id',
			mergeStrategy = defaultMerge, // TODO: or even `retrun entityA` as a default
			// mergeStrategy = (entityA, entityB) => ({ ...entityA, ...entityB }),
			processStrategy = (input) => ({ ...input }), // TODO: don't copy, at least before merge/return?
			// processStrategy = (input) => input, // TODO: don't copy, at least before merge/return?
			fallbackStrategy = (_key, _schema) => undefined,
		} = options

		this._key = key
		this._getId = typeof idAttribute === 'function' ? idAttribute : (input) => input[idAttribute]
		this._idAttribute = idAttribute
		this._mergeStrategy = mergeStrategy
		this._processStrategy = processStrategy
		this._fallbackStrategy = fallbackStrategy
		
		this.define(definition)
	}

	// TODO: remove from API? not used internally
	get key() {
		return this._key
	}

	// TODO: remove from API (and altogether)? not used internally
	get idAttribute() {
		return this._idAttribute
	}

	define(definition) {
		// TODO: check if `definition` is an object?
		// TODO: check if it's a plain object, so that it's safe to iterate over schema without `hasOwnProperty`
		for(const key in definition) { definition[key] = compileSchema(definition[key]) }
		this.schema = Object.assign(this.schema || {}, definition);
	}

	normalize(input, parent, key, entities, visited) {
		if (typeof input !== 'object' || input === null) {
			return input
		}
		const id = this._getId(input, parent, key) // TODO: what if id === `undefined`?
		const entityType = this._key

		// TODO: check the presence first
		// then check if there would be any merge or it just `identity()` function
		// and in the latter case skip normalization entirely
		// TODO: preallocate all `entityType`s?
		if (entityType in entities === false) {
			entities[entityType] = {}
		}
		const entitiesOfKind = entities[entityType]
	
		const existingEntity = entitiesOfKind[id]
		if (existingEntity && this._mergeStrategy === noMerge ) {
			// cnt1++
			return id
		}
		// cnt2++

		if(visited(input, entityType, id)) { return id }

		// TODO: default Strategy - copy over existingEntity ?
		const processedEntity = this._processStrategy(input, parent, key)
		for(const key in this.schema) {
			// TODO: do we need this? all tests are passing
			// it looks like optimizations... but in reality perf is dropping
			// there should be no difference because:
			// 1) typeof === 'object' will be checked inside
			// 2) if `hasOwnProperty(key) === false`, and the key is in the `schema` it surely looks like an error
			//    or... we just hsouldn't care - user can define similar attributes with the help of `prototype`
			//    and I see no reason not to let him do this
			// 3) but if the key is not in the `schema` them we just won't get here because we iterate over `schema`'s keys,
			//    not over `processedEntity`'s keys
			// but the 2 point changes the API in rare but possible cases, so the removal of this if is a breaking change
			// if (typeof processedEntity[key] === 'object' && processedEntity.hasOwnProperty(key)) { // TODO: switch places
			// if (processedEntity.hasOwnProperty(key) && typeof processedEntity[key] === 'object') { // TODO: switch places
				const schema = this.schema[key]
				const resolvedSchema = typeof schema === 'function' ? schema(input) : schema // TODO: function instead of if?
				processedEntity[key] = resolvedSchema.normalize(
					processedEntity[key],
					processedEntity,
					key,
					entities,
					visited
				)
			// }
		}

		if (existingEntity) {
			entitiesOfKind[id] = this._mergeStrategy(existingEntity, processedEntity)
		} else {
			entitiesOfKind[id] = processedEntity
		}
		return id
	}

	denormalize(entity, unvisit) {
		Object.keys(this.schema).forEach((key) => {
			if (entity.hasOwnProperty(key)) {
				const schema = this.schema[key]
				entity[key] = unvisit(entity[key], schema)
			}
		})
		return entity
	}
}

class ObjectSchema {
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
		if (typeof input !== 'object' || input === null) {
			return input
		}
		// TODO: DRY with `EntitySchema.normalize`
		// TODO: + _processStrategy ?
		const output = {}
		for(const key in input) {
			if( input.hasOwnProperty(key) === false ) { // TODO: doesn't looks like it degrades perf much
				continue
			}
			const localSchema = this.schema[key]
			if( localSchema ) {
				const resolvedLocalSchema = typeof localSchema === 'function' ? localSchema(input) : localSchema
				const value = resolvedLocalSchema.normalize(input[key], input, key, entities, visited)
				// TODO: there're only two cases when it can return null|unefined
				// 1) [null, value, ...]
				// 2) if( !schema ) return input
				if (value !== undefined && value !== null) { // TODO: options?
					output[key] = value
				}
			} else {
				output[key] = input[key]
			}
		}
		return output
	}

	denormalize(input, unvisit) {
		const object = { ...input }
		Object.keys(this.schema).forEach((key) => {
			if (object[key] != null) {
				object[key] = unvisit(object[key], this.schema[key])
			}
		})
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

	denormalizeValue(value, unvisit) {
		const schemaKey = value.schema
		if (this._schemaAttribute && !schemaKey) {
			return value
		}
		const id = !this._schemaAttribute ? undefined : value.id
		const schema = !this._schemaAttribute ? this.schema : this.schema[schemaKey]
		return unvisit(id || value, schema)
	}
}

class ValuesSchema extends PolymorphicSchema {
	normalize(input, parent, key, entities, visited) {
		if (typeof input !== 'object' || input === null) {
			return input
		}
		const output = {}
		for(const key in input) {
			if( input.hasOwnProperty(key) === false ) { // TODO: doesn't looks like it degrades perf much, but anyway - try to move after !value checks
				continue
			}
			const value = input[key]
			// TODO: ? if( typeof value === 'object' && value !== null ) ... else if( value !== undefined && value !== ... ) output[key] = value
			// TODO: ? normValue = this._normalizeValue(value, input, key, entities, visited); if( cond(normValue) ) output[key] = normValue
			if( value !== undefined && value !== null ) {
				output[key] = this._normalizeValue(value, input, key, entities, visited)
			}
		}
		return output
	}

	denormalize(input, unvisit) {
		return Object.keys(input).reduce((output, key) => {
			const entityOrId = input[key]
			return {
				...output,
				[key]: this.denormalizeValue(entityOrId, unvisit),
			}
		}, {})
	}
}

class ArraySchema extends PolymorphicSchema {
	constructor(definition, schemaAttribute, filterNullish = true) {
		super(definition, schemaAttribute)
		this.filterNullish = filterNullish
	}
	normalize(input, parent, key, entities, visited) {
		if (typeof input !== 'object' || input === null) {
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

	denormalize(input, unvisit) {
		return Array.isArray(input) ? input.map((value) => this.denormalizeValue(value, unvisit)) : input
	}
}

// TODO: this one has meaning only with _normalizeValue2
class UnionSchema extends PolymorphicSchema {
	constructor(definition, schemaAttribute) {
		if (!schemaAttribute) {
			throw new Error('Expected option "schemaAttribute" not found on UnionSchema.')
		}
		super(definition, schemaAttribute)
	}

	normalize(input, parent, key, entities, visited) {
		return this._normalizeValue(input, parent, key, entities, visited)
	}

	denormalize(input, unvisit) {
		return this.denormalizeValue(input, unvisit)
	}
}

export const schema = {
	Array: ArraySchema,
	Entity: EntitySchema,
	Object: ObjectSchema,
	Union: UnionSchema,
	Values: ValuesSchema,
}

export const normalize = (input, schema, circularDependencies = false) => {
	// TODO: not sure why we should throw here but not deeper in the tree (there we just return value)
	if (typeof input !== 'object' || input === null) {
		throw new Error(
			`Unexpected input given to normalize. Expected type to be "object", found "${
				input === null ? 'null' : typeof input
			}".`
		)
	}

	const entities = {}
	const visitedEntities = {}

	const visited = circularDependencies ? (input, entityType, id) => {
		//*
		if (!(entityType in visitedEntities)) {
			visitedEntities[entityType] = {}
		}
		if (!(id in visitedEntities[entityType])) {
			visitedEntities[entityType][id] = new Set()
		}
		if (visitedEntities[entityType][id].has(input)) {
			return true
		}
		visitedEntities[entityType][id].add(input)
		// eslint-disable-next-line spaced-comment
		/*/
		if (!(entityType in visitedEntities)) {
			visitedEntities[entityType] = {}
		}
		if (!(id in visitedEntities[entityType])) {
			visitedEntities[entityType][id] = []
		}
		if (visitedEntities[entityType][id].some((entity) => entity === input)) {
			return true
		}
		visitedEntities[entityType][id].push(input)
		//*/
		return false
	} : () => false
	
	const result = compileSchema(schema).normalize(input, input, null, entities, visited)
	return { entities, result }
}

export const denormalize = (input, schema, entities) => {
	if( input === undefined ) { return undefined }

	const cache = {}

	function unvisit(input, schema) {
		if (input === undefined || input === null) {
			return input
		}

		if (schema instanceof EntitySchema) {
			const id = input
			const schemaKey = schema.key
			let entity
			if (typeof id === 'object') {
				entity = id
			} else {
				entity = entities[schemaKey] && entities[schemaKey][id]
			}

			if (entity === undefined && schema instanceof EntitySchema) {
				entity = schema._fallbackStrategy(id, schema)
			}

			if (typeof entity !== 'object' || entity === null) {
				return entity
			}

			if (!cache[schema.key]) {
				cache[schema.key] = {}
			}
		
			if (!cache[schema.key][id]) {
				// Ensure we don't mutate it non-immutable objects
				const entityCopy = { ...entity }

				// Need to set this first so that if it is referenced further within the
				// denormalization the reference will already exist.
				cache[schema.key][id] = entityCopy
				cache[schema.key][id] = schema.denormalize(entityCopy, unvisit)
			}

			return cache[schema.key][id]
		}

		return compileSchema(schema).denormalize(input, unvisit)
	}

	return unvisit(input, schema)
}
