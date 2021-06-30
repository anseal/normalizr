
import {performance} from 'perf_hooks'

export type StrategyFunction = (value: Input, parent: Input, keyInParent: KeyInParent) => any
export type SchemaFunction = (value: Input, parent: Input, keyInParent: KeyInParent) => string
export type MergeFunction = (entityA: Input, entityB: Input) => any
export type FallbackFunction = (key: string, schema: EntitySchema) => any
export type SchemaValueFunction = (t: any) => Schema
export type SchemaValue = Schema | SchemaValueFunction

export type SingularArraySchema = [Schema]
export type PlainObjectSchema = {
	[key: string] : Schema
}
export type CompiledPlainObjectSchema = {
	[key: string] : CompiledSchema //| ((input: Input) => CompiledSchema)
}
export type CompiledSchema = EntitySchema | ArraySchema | ValuesSchema | UnionSchema | ObjectSchema
export type Schema = SingularArraySchema | PlainObjectSchema | CompiledSchema
export type DepricatedSchema = Schema | undefined
export interface ISchema {
	schema: CompiledSchema
}

type NormalizeValue = (value: Input, parent: Input, keyInParent: KeyInParent, entities: Entities, visited: Visited) => Output
type SchemaAttribute = (value: Input, parent: Input, keyInParent: KeyInParent) => any

type Entities = any
type Input = any
type Output = any
type Key = string // TODO: remove symbol? add number?
type KeyInParent = string | null
type Visited = (input: any, entityType: Key, id: Key) => boolean
type Unvisit = (input: Input, schema: CompiledSchema) => any

export interface EntityOptions {
	idAttribute?: string | SchemaFunction
	mergeStrategy?: MergeFunction
	processStrategy?: StrategyFunction
	fallbackStrategy?: FallbackFunction
}

const compileSchema = (schema: Schema): CompiledSchema => {
	if( schema === undefined || schema === null ) {
		console.warn("Nil schemas are depricated.")
		// @ts-ignore // TODO: remove? some TS versions (4.2.4?) do not understand that `schema` is actually `never` in here
		return schema
	}
	// TODO: looks like monkey-patching
	if (
		schema instanceof EntitySchema ||
		schema instanceof ValuesSchema ||
		schema instanceof ArraySchema ||
		schema instanceof ObjectSchema ||
		schema instanceof UnionSchema
	) {
		return schema
	}
	if( Array.isArray(schema) ) {
		return compileArraySchema(schema)
	}
	// TODO: else - function for example. remove somehow
	if( typeof schema === 'object' ) {
		return new ObjectSchema(schema)
	}
	return schema
}

const compileArraySchema = (schema: SingularArraySchema) => {
	// TODO: schema.length === 0 ?
	if (schema.length > 1) {
		throw new Error(`Expected schema definition to be a single schema, but found ${schema.length}.`)
	}
	return new ArraySchema(schema[0], undefined, false)
}
const mapPlainObject = <T1,T2>(obj: Record<string|symbol,T1>, fn: (val:T1) => T2): Record<string|symbol,T2> => {
	const newObj: Record<string|symbol,T2> = {}
	for(const key in obj) {
		newObj[key] = fn(obj[key])
	}
	return newObj
}
const filterPlainObject = <T>(obj: Record<string|symbol,T>, fn: (val:T) => boolean): Record<string|symbol,T> => {
	const newObj: Record<string|symbol,T> = {}
	for(const key in obj) {
		if( fn(obj[key]) ) {
			newObj[key] = obj[key]
		}
	}
	return newObj
}
const compilePlainObjectMapping = (definition: PlainObjectSchema): CompiledPlainObjectSchema => {
	const compiledDefinition = mapPlainObject(definition, compileSchema)
	// TODO: I consider this to be a client error, but for backward compatibility let it be for now. remove!
	return filterPlainObject(compiledDefinition, schema => {
		if( !schema ) {
			console.warn("Nil schemas are depricated.")
			return false
		}
		return true
	})
}

let maxId = 0

const originalIdAttribute = 'id'
const defaultIdAttribute = originalIdAttribute

const noMergeStrategy = (entityA: Input, _entityB: Input) => entityA
// TODO: replace `originalMergeStrategy` with `simpleMergeStrategy`
const simpleMergeStrategy = (entityA: Input, entityB: Input) => Object.assign(entityA, entityB)
const originalMergeStrategy = (entityA: Input, entityB: Input) => ({ ...entityA, ...entityB })
const defaultMergeStrategy = originalMergeStrategy
// const defaultMergeStrategy = noMergeStrategy

const inplaceProcessStrategy = (input: Input) => input
const originalProcessStrategy = (input: Input) => ({ ...input }) // TODO: while using this strategy try not to copy, at least before merge/return?
const defaultProcessStrategy = originalProcessStrategy
// const defaultProcessStrategy = inplaceProcessStrategy

const originalFallbackStrategy = (_key: Key, _schema: Schema) => undefined
const defaultFallbackStrategy = originalFallbackStrategy

export const overrideDefaultsDuringMigration = (schema: DepricatedSchema, defaults: EntityOptions = {}) => {
	defaults = {
		idAttribute: defaultIdAttribute,
		mergeStrategy: noMergeStrategy,
		processStrategy: inplaceProcessStrategy,
		fallbackStrategy: originalFallbackStrategy,
		...defaults
	}
	// TODO: I consider this to be a client error, but for backward compatibility let it be for now. remove!
	if( !schema ) {
		throw new Error("Nil schemas are depricated.")
	}
	return _overrideDefaultsDuringMigration(compileSchema(schema), defaults, new Map())
}

const _overrideDefaultsDuringMigration = (schema: CompiledSchema | CompiledPlainObjectSchema, defaults: EntityOptions, visitedSchemaElements: Map<CompiledSchema | CompiledPlainObjectSchema,CompiledSchema | CompiledPlainObjectSchema>): CompiledSchema | CompiledPlainObjectSchema=> {
	if( !schema ) {
		console.warn("Nil schemas are depricated.")
		return schema
	}
	const cachedSchema = visitedSchemaElements.get(schema)
	if( cachedSchema !== undefined ) { return cachedSchema }
	const newSchema: CompiledSchema | CompiledPlainObjectSchema = Object.create(Object.getPrototypeOf(schema))
	Object.assign(newSchema, schema)
	visitedSchemaElements.set(schema, newSchema)

	if(
		schema instanceof ArraySchema ||
		schema instanceof UnionSchema ||
		schema instanceof ValuesSchema
	) {
		const newSubSchema = _overrideDefaultsDuringMigration(schema.schema, defaults, visitedSchemaElements)
		// TODO: I consider this to be a client error, but for backward compatibility let it be for now. remove!
		if( !newSubSchema ) {
			throw new Error("Nil schemas are depricated.")
		}
		newSchema.schema = newSubSchema
	} else if( schema instanceof ObjectSchema ) {
		for(const key in schema.schema) {
			const newSubSchema = _overrideDefaultsDuringMigration(schema.schema[key], defaults, visitedSchemaElements)
			// TODO: I consider this to be a client error, but for backward compatibility let it be for now. remove!
			if( !newSubSchema ) {
				console.warn("Nil schemas are depricated.")
				continue
			}
			(newSchema.schema as CompiledPlainObjectSchema)[key] = newSubSchema as CompiledSchema
		}
	} else if( schema instanceof EntitySchema ) {
		const _newSchema = newSchema as EntitySchema
		_newSchema.__id = _newSchema.__id + "*" // TODO: for debugging purposes. remove?
		const override = (prop: keyof EntityOptions, defaultValue: any) => {
			if( (schema as any)[`_${prop}`] === defaultValue ) {
				(newSchema as any)[`_${prop}`] = defaults[prop]
			} else {
				(newSchema as any)[`_${prop}`] = (schema as any)[`_${prop}`]
			}
		}
		override('idAttribute', defaultIdAttribute)
		override('mergeStrategy', defaultMergeStrategy)
		override('processStrategy', defaultProcessStrategy)
		override('fallbackStrategy', defaultFallbackStrategy)
		for(const key in schema.schema) {
			const newSubSchema = _overrideDefaultsDuringMigration(schema.schema[key], defaults, visitedSchemaElements)
			// TODO: I consider this to be a client error, but for backward compatibility let it be for now. remove!
			if( !newSubSchema ) {
				console.warn("Nil schemas are depricated.")
				continue
			}
			(newSchema.schema as CompiledPlainObjectSchema)[key] = newSubSchema as CompiledSchema
		}
	} else {
		throw new Error('Uexpected schema element')
	}
	return newSchema
}

class EntitySchema {
	__id: string | number = maxId++ // TODO: for debugging purposes. remove?
	_key: string
	_getId: SchemaFunction
	_idAttribute: string | SchemaFunction
	_mergeStrategy: MergeFunction
	_processStrategy: StrategyFunction
	_fallbackStrategy: FallbackFunction
	schema: CompiledPlainObjectSchema = {}

	constructor(key: Key, definition: PlainObjectSchema = {}, options: EntityOptions = {}) {
		if (!key || typeof key !== 'string') {
			throw new Error(`Expected a string key for Entity, but found ${key}.`)
		}

		const {
			idAttribute = defaultIdAttribute,
			mergeStrategy = defaultMergeStrategy,
			processStrategy = defaultProcessStrategy,
			fallbackStrategy = defaultFallbackStrategy,
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

	define(definition: PlainObjectSchema) {
		// TODO: check if `definition` is an object?
		// TODO: check if it's a plain object, so that it's safe to iterate over schema without `hasOwnProperty`
		this.schema = Object.assign(this.schema || {}, compilePlainObjectMapping(definition));
	}

	normalize(input: Input, parent: Input, keyInParent: KeyInParent, entities: Entities, visited: Visited) {
		if (typeof input !== 'object' || input === null) {
			return input
		}
		const id = this._getId(input, parent, keyInParent) // TODO: what if id === `undefined`?
		const entityType = this._key

		// check the presence first, then check if there would be any merge or it just `identity()` function
		// and in the latter case skip normalization entirely
		// TODO: preallocate all `entityType`s?
		if (entityType in entities === false) {
			entities[entityType] = {}
		}
		const entitiesOfKind = entities[entityType]
	
		const existingEntity = entitiesOfKind[id]
		if (existingEntity && this._mergeStrategy === noMergeStrategy ) {
			return id
		}

		// TODO: does `existingEntity === undefined` means that `visited() === false`?
		if(visited(input, entityType, id)) { return id }

		// TODO: default Strategy - copy over existingEntity ?
		const start = performance.now()
		const processedEntity = this._processStrategy(input, parent, keyInParent)
		entitiesOfKind.__process_time = (entitiesOfKind.__process_time || 0) + performance.now() - start
		entitiesOfKind.__process_runs = (entitiesOfKind.__process_runs || 0) + 1
		for(const key in this.schema) {
			// TODO: do we need this? all tests are passing
			// it looks like optimizations... but in reality perf is dropping
			// there should be no difference because:
			// 1) typeof === 'object' will be checked inside
			// 2) if `hasOwnProperty(key) === false`, and the key is in the `schema` it surely looks like an error
			//    or... we just hsouldn't care - user can define similar attributes with the help of `prototype`
			//    and I see no reason not to let him do this
			// 3) but if the key is not in the `schema` then we just won't get here because we iterate over `schema`'s keys,
			//    not over `processedEntity`'s keys
			// but the point 2 changes the API in rare but possible cases, so the removal of this if is a breaking change
			// if (typeof processedEntity[key] === 'object' && processedEntity.hasOwnProperty(key)) { // TODO: switch places
			// if (processedEntity.hasOwnProperty(key) && typeof processedEntity[key] === 'object') { // TODO: switch places
				const schema = this.schema[key]
				// @ts-ignore
				const resolvedSchema: CompiledSchema = typeof schema === 'function' ? schema(input) : schema // TODO: function instead of if?
				// TODO: I consider this to be a client error, but for backward compatibility let it be for now. remove!
				if( !resolvedSchema ) {
					// console output here is really bad, left it for debuging
					// console.warn("Nil schemas are depricated.", this.schema, key)
					continue
				}

				// when there is a schema defined for some field, but there's no such field in the data - skip it
				// TODO:
				// 	1)	not sure if it's really necessary.
				//		probably not necessary but good - saves memory, and there can be less checks when user iterates over the entity
				// 	2)	and if it is - it'd be better to extract the check from inside of the `normalize()`
				// TODO: but actually originally there was the `typeof processedEntity[key] === 'object'` check for that
				// that's not the same as this (e.g processedEntity[key] is a number)
				// Also the point to think about: `undefined` - can be seen as the absence of data, but null - is the data - `no data`
				// TODO: test these cases:
				// 	-	no field, but there's schema
				// 	-	atomic value, but there's schema, as if it should be an object
				// 	-	separate cases for `null` and `undefined`

				// const value = resolvedSchema.normalize(processedEntity[key], processedEntity, key, entities, visited)
				// if( value !== undefined && value !== null ) {
				// 	processedEntity[key] = value
				// }

				// when the result is nil - originally it's allowed... I'd say it should be forbidden
				// we a replacing object with ids here, and id = null|undefined is strange to say the least
				// if you really need something like this you can return 'undefined'|'null' - strings. ids would be strings in entities' keys anyway
				// ok, so to skip nonexistent field we just need to check `typeof processedEntity[key] === 'object'`
				// that also check that the field is not for exmaple an id already
				// which is quite possible in case of inplace stratagies or just because the data was normalized already
				// not a great idea (to pass data of different types, I mean), but for backward compatibility - ok, let it be
				// but I'd add warnings for this
				if( typeof processedEntity[key] === 'object' ) { // TODO: what about null?
					processedEntity[key] = resolvedSchema.normalize(processedEntity[key], processedEntity, key, entities, visited);
				}
			// }
		}

		if (existingEntity) {
			const start = performance.now()
			entitiesOfKind[id] = this._mergeStrategy(existingEntity, processedEntity)
			entitiesOfKind.__merge_time = (entitiesOfKind.__merge_time || 0) + performance.now() - start
			entitiesOfKind.__merge_runs = (entitiesOfKind.__merge_runs || 0) + 1
		} else {
			entitiesOfKind[id] = processedEntity
		}
		return id
	}

	denormalize(entity: Input, unvisit: Unvisit) {
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
	schema: CompiledPlainObjectSchema = {}

	constructor(definition: PlainObjectSchema) {
		this.define(definition)
	}

	// TODO: DRY with EntitySchema.define?
	// TODO: stale comment: // TODO: now there is a difference, should we compile children schemas and should there be more tests?
	define(definition: PlainObjectSchema) {
		// TODO: check if `definition` is an object?
		// TODO: check if it's a plain object, so that it's safe to iterate over schema without `hasOwnProperty`
		this.schema = Object.assign(this.schema || {}, compilePlainObjectMapping(definition));
	}

	normalize(input: Input, _parent: Input, _keyInParent: KeyInParent, entities: Entities, visited: Visited) {
		if (typeof input !== 'object' || input === null) {
			return input
		}
		// TODO: DRY with `EntitySchema.normalize`
		// TODO: + _processStrategy ?
		const output: Output = {}
		for(const key in input) {
			if( input.hasOwnProperty(key) === false ) { // TODO: doesn't looks like it degrades perf much
				continue
			}
			const localSchema = this.schema[key]
			if( localSchema ) {
				// @ts-ignore
				const resolvedLocalSchema: CompiledSchema = typeof localSchema === 'function' ? localSchema(input) : localSchema
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

	denormalize(input: Input, unvisit: Unvisit) {
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
	_schemaAttribute: SchemaAttribute | undefined // TODO: | Key
	_normalizeValue: NormalizeValue
	schema: CompiledSchema | CompiledPlainObjectSchema = {}

	constructor(definition: Schema, schemaAttribute?: SchemaValueFunction) {
		this._schemaAttribute = undefined
		if (schemaAttribute) {
			this._schemaAttribute = typeof schemaAttribute === 'string' ? (input: Input) => input[schemaAttribute] : schemaAttribute
			this._normalizeValue = this._normalizeValue2
		} else {
			this._normalizeValue = this._normalizeValue1
		}
		this.define(definition)
	}

	define(definition: Schema) {
		if( this._schemaAttribute !== undefined ) {
			if(
				definition instanceof EntitySchema ||
				definition instanceof ArraySchema ||
				definition instanceof ObjectSchema ||
				definition instanceof ValuesSchema ||
				definition instanceof UnionSchema
			) {
				this.schema = definition
			} else {
				if( Array.isArray(definition) ) {
					this.schema = compileArraySchema(definition)
				} else {
					this.schema = compilePlainObjectMapping(definition)
				}
			}
		} else {
			this.schema = compileSchema(definition)
		}
	}

	_normalizeValue1(value: Input, parent: Input, keyInParent: KeyInParent, entities: Entities, visited: Visited) {
		// @ts-ignore
		return this.schema.normalize(value, parent, keyInParent, entities, visited)
	}

	_normalizeValue2(value: Input, parent: Input, keyInParent: KeyInParent, entities: Entities, visited: Visited) {
		// TODO: just a function whould be simpler compared to function & map
		const attr = (this._schemaAttribute as SchemaAttribute)(value, parent, keyInParent)
		const schema = (this.schema as CompiledPlainObjectSchema)[attr]

		if (!schema) { // TODO: can we precompile this?
			return value
		}
		const normalizedValue = schema.normalize(value, parent, keyInParent, entities, visited)
		return normalizedValue === undefined || normalizedValue === null
			? normalizedValue
			: {
				id: normalizedValue,
				schema: attr
			}
	}

	denormalizeValue(value: Input, unvisit: Unvisit): Output {
		const schemaKey: Key = value.schema
		if (this._schemaAttribute && !schemaKey) {
			return value
		}
		const id = !this._schemaAttribute ? undefined : value.id
		const schema: CompiledSchema = !this._schemaAttribute ? (this.schema as CompiledSchema) : (this.schema as CompiledPlainObjectSchema)[schemaKey]
		return unvisit(id || value, schema)
	}
}

class ValuesSchema extends PolymorphicSchema {
	normalize(input: Input, _parent: Input, _keyInParent: KeyInParent, entities: Entities, visited: Visited) {
		if (typeof input !== 'object' || input === null) {
			return input
		}
		const output: Output = {}
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

	denormalize(input: Input, unvisit: Unvisit) {
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
	filterNullish: boolean

	constructor(definition: Schema, schemaAttribute?: SchemaValueFunction, filterNullish = true) {
		super(definition, schemaAttribute)
		this.filterNullish = filterNullish
	}
	normalize(input: Input, parent: Input, keyInParent: KeyInParent, entities: Entities, visited: Visited) {
		if (typeof input !== 'object' || input === null) {
			return input
		}
		// TODO: what is it for? maybe change API and remove?
		// from docs: "If the input value is an Object instead of an Array, the normalized result will be an Array of the Object's values."
		// disagree on this - just make this explicit in a schema
		// ...but the output will be an Object then, not an Array... so it needs to be customizable
		if( Array.isArray(input) === false ) {
			input = Object.keys(input).map((key) => input[key]) // TODO: Object.values()
		}

		// TODO: preallocate, and then cut by length?
		const normArray = []
		for(const value of input) {
			// Special case: Arrays pass *their* parent on to their children, since there
			// is not any special information that can be gathered from themselves directly
			const normValue = this._normalizeValue(value, parent, keyInParent, entities, visited)
			// TODO: what is it for, and why here and not before `_normalizeValue`?
			// TODO: filtration of falsies present in tests, but not in docs, and I have no idea why the difference
			// between [mySchema] and schema.Array(mySchema)
			if( this.filterNullish === false || (normValue !== undefined && normValue !== null) ) {
				normArray.push(normValue)
			}
		}
		return normArray
	}

	denormalize(input: Input, unvisit: Unvisit): Output {
		return Array.isArray(input) ? input.map((value) => this.denormalizeValue(value, unvisit)) : input
	}
}

// TODO: this one has meaning only with _normalizeValue2
class UnionSchema extends PolymorphicSchema {
	constructor(definition: Schema, schemaAttribute: SchemaValueFunction) {
		if (!schemaAttribute) {
			throw new Error('Expected option "schemaAttribute" not found on UnionSchema.')
		}
		super(definition, schemaAttribute)
	}

	normalize(input: Input, parent: Input, keyInParent: KeyInParent, entities: Entities, visited: Visited) {
		return this._normalizeValue(input, parent, keyInParent, entities, visited)
	}

	denormalize(input: Input, unvisit: Unvisit): Output {
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

// TODO: something like:
// type NormalizeResult<Result, Collections> = {
// 	result: Result,
// 	entities: Collections,
// }

export const normalize = (input: Input, schema: Schema, circularDependencies = false) => {
	// TODO: not sure why we should throw here but not deeper in the tree (there we just return value)
	if (typeof input !== 'object' || input === null) {
		throw new Error(
			`Unexpected input given to normalize. Expected type to be "object", found "${
				input === null ? 'null' : typeof input
			}".`
		)
	}
	if( schema === undefined || schema === null ) {
		throw new Error("Nil schemas are depricated.")
	}

	const entities: Record<string,any> = {}
	const visitedEntities: Record<Key,Record<Key,Set<Input>>> = {}

	const visited = circularDependencies ? (input: Input, entityType: Key, id: Key) => {
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
		return false
	} : () => false
	
	const result = compileSchema(schema).normalize(input, input, null, entities, visited)
	const log = []
	log.push('entityType'.padStart(30) + 'process_runs'.padStart(13) + 'merge_runs'.padStart(13) + 'process_time'.padStart(25) + 'merge_time'.padStart(25))
	for( const entityType in entities ) {
		const entitiesOfKind = entities[entityType]
		log.push(String(entityType).padStart(30) + String(entitiesOfKind.__process_runs).padStart(13) + String(entitiesOfKind.__merge_runs).padStart(13) + String(entitiesOfKind.__process_time).padStart(25) + String(entitiesOfKind.__merge_time).padStart(25))
		delete entitiesOfKind.__process_time
		delete entitiesOfKind.__process_runs
		delete entitiesOfKind.__merge_time
		delete entitiesOfKind.__merge_runs
	}
	console.log(log.join('\n'))

	return { entities, result }
}

export const denormalize = (input: Input, schema: Schema, entities: Entities) => {
	if( schema === undefined || schema === null ) {
		throw new Error("Nil schemas are depricated.")
	}
	if( input === undefined ) { return undefined }

	const cache: Record<Key,Record<Key, Input>> = {}

	function unvisit(input: Input, schema: CompiledSchema) {
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

		return schema.denormalize(input, unvisit)
	}

	return unvisit(input, compileSchema(schema))
}
