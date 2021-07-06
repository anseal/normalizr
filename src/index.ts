import * as original from './original.js'
import { getCallFrames, clonePojoTree, clonePojoGraph, clonePojoGraphAndSortProps, deepEqualSameShape, deepEqualWithJSON, deepEqualDiffShape } from './utils.js'
import _ from 'lodash'

export type StrategyFunction = (value: Input, parent: Input, keyInParent: KeyInParent, existingEntity: Input, id: Key) => any
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

export const strategy = {
	noMerge: noMergeStrategy,
	inplaceMerge: simpleMergeStrategy,
	fullMerge: originalMergeStrategy,
	inplaceProcess: inplaceProcessStrategy,
	aggregateProcess: (input: Input, _parent: Input, _keyInParent: KeyInParent, existingEntity: Input) => {
		return Object.assign(existingEntity || {}, input)
	},
	aggregateInplaceProcess: (input: Input, _parent: Input, _keyInParent: KeyInParent, existingEntity: Input) => {
		if (existingEntity) {
			return Object.assign(existingEntity, input)
		}
		return input
	},
	copyAndProcess: originalProcessStrategy,
	noFallback: originalFallbackStrategy,
}

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

const getOriginalSchema = (schema: Schema, visitedSchemaElements = new Map()): Schema => {
	const cachedSchema = visitedSchemaElements.get(schema)
	if( cachedSchema !== undefined ) { return cachedSchema }

	let originalSchema: Schema

	if (
		schema instanceof EntitySchema ||
		schema instanceof ValuesSchema ||
		schema instanceof ArraySchema ||
		schema instanceof ObjectSchema ||
		schema instanceof UnionSchema
	) {
		originalSchema = schema.original
	} else if( Array.isArray(schema) ) {
		originalSchema = [ getOriginalSchema(schema[0], visitedSchemaElements) ]
	} else if( typeof schema === 'object' ) {
		originalSchema = {}
		for( const key in schema ) {
			originalSchema[key] = getOriginalSchema(schema[key], visitedSchemaElements)
		}
	} else {
		originalSchema = schema
	}

	visitedSchemaElements.set(schema, originalSchema)
	return originalSchema
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
	original: any
	__globalId: string = ""

	constructor(key: Key, definition: PlainObjectSchema = {}, options: EntityOptions = {}) {
		const path = getCallFrames(2)
		if( path && path.length ) {
			this.__globalId = path[0]
		}
		this.original = new original.schema.Entity(key, getOriginalSchema(definition), options)
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
		this.original.define(getOriginalSchema(definition))
		// TODO: check if `definition` is an object?
		// TODO: check if it's a plain object, so that it's safe to iterate over schema without `hasOwnProperty`
		this.schema = Object.assign(this.schema || {}, compilePlainObjectMapping(definition));
	}

	normalize(input: Input, parent: Input, keyInParent: KeyInParent, entities: Entities, visited: Visited) {
		if (typeof input !== 'object' || input === null) {
			return input
		}
		let id = this._getId(input, parent, keyInParent)
		// TODO: what if `id` is not unique?
		// TODO: add after deprication process is complete... or maybe not
		// if (id === undefined) {
		// 	throw new Error('normalizr: `id` is required and setting it in `processStrategy` is depricated')
		// }
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

		// TODO: move cirular check up.
		// TODO: does `existingEntity === undefined` means that `visited() === false`?
		if(visited(input, entityType, id)) { return id }

		// TODO: default Strategy - copy over existingEntity ?
		const processedEntity = this._processStrategy(input, parent, keyInParent, existingEntity, id)
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

		// TODO: remove after deprication process is complete
		if (id === undefined) {
			id = this._getId(input, parent, keyInParent) // if a user adds `id` while mutating the `input`
			// TODO: probable not needed, because v3.3.0 (which is my target) takes id from the `input` and not the `processedEntity`
			// if(id === undefined) {
			// 	id = this._getId(processedEntity, parent, keyInParent) // if a user adds `id` to the `processedEntity` without mutating the `input`
			// }
		}

		if (existingEntity) {
			entitiesOfKind[id] = this._mergeStrategy(existingEntity, processedEntity)
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
	original: any
	__globalId: string = ""

	constructor(definition: PlainObjectSchema) {
		const path = getCallFrames(2)
		if( path && path.length ) {
			this.__globalId = path[0]
		}
		this.original = new original.schema.Object(getOriginalSchema(definition))
		this.define(definition)
	}

	// TODO: DRY with EntitySchema.define?
	// TODO: stale comment: // TODO: now there is a difference, should we compile children schemas and should there be more tests?
	define(definition: PlainObjectSchema) {
		this.original.define(getOriginalSchema(definition))
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
	_normalizeValue: NormalizeValue = this._normalizeValue1
	schema: CompiledSchema | CompiledPlainObjectSchema = {}
	original: any

	_constructor(definition: Schema, schemaAttribute?: SchemaValueFunction) {
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
		this.original.define(getOriginalSchema(definition))
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
	original: any
	__globalId: string = ""

	constructor(definition: Schema, schemaAttribute?: SchemaValueFunction) {
		super()
		const path = getCallFrames(2)
		if( path && path.length ) {
			this.__globalId = path[0]
		}
		this.original = new original.schema.Values(getOriginalSchema(definition), schemaAttribute)
		this._constructor(definition, schemaAttribute)
	}
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
	original: any
	__globalId: string = ""

	constructor(definition: Schema, schemaAttribute?: SchemaValueFunction, filterNullish = true) {
		super()
		const path = getCallFrames(2)
		if( path && path.length ) {
			this.__globalId = path[0]
		}
		this.original = new original.schema.Array(getOriginalSchema(definition), schemaAttribute)
		this._constructor(definition, schemaAttribute)
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
	original: any
	__globalId: string = ""

	constructor(definition: Schema, schemaAttribute: SchemaValueFunction) {
		super()
		const path = getCallFrames(2)
		if( path && path.length ) {
			this.__globalId = path[0]
		}
		this.original = new original.schema.Union(getOriginalSchema(definition), schemaAttribute)
		if (!schemaAttribute) {
			throw new Error('Expected option "schemaAttribute" not found on UnionSchema.')
		}
		this._constructor(definition, schemaAttribute)
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

let __getId: any
let __resetId: any
let fs: any = { writeFileSync: (_file: string, data: string) => console.log(_file, data) }
export const setupParallelRun = (getId: any, resetId: any, _fs: any) => {
	__getId = getId
	__resetId = resetId
	fs = _fs && _fs.writeFileSync ? _fs : fs
}

let fileNum = 0
function logMismatch(rawRes: any, oldRes: any, newRes: any) {
	++fileNum
	try {
		const loc = String(new Error('normalizr: mismatch with the original').stack)
		fs.writeFileSync(`./normalizr-${fileNum}-loc.log`, loc)
	} catch(e) {
		console.error('normalizr: oops - can`t write log', e, rawRes, oldRes, newRes)
		process.exit(111)
	}
	try {
		fs.writeFileSync(`./normalizr-${fileNum}-raw.log`, JSON.stringify(rawRes, undefined, '\t'))
	} catch(e) {
		console.error(`normalizr: oops (raw ${fileNum})`, e, rawRes)
	}
	try {
		fs.writeFileSync(`./normalizr-${fileNum}-old.log`, JSON.stringify(clonePojoGraphAndSortProps(oldRes), undefined, '\t'))
	} catch(e) {
		console.error(`normalizr: oops (old ${fileNum})`, e, oldRes)
	}
	try {
		fs.writeFileSync(`./normalizr-${fileNum}-new.log`, JSON.stringify(clonePojoGraphAndSortProps(newRes), undefined, '\t'))
	} catch(e) {
		console.error(`normalizr: oops (new ${fileNum})`, e, newRes)
	}
}
function logException(rawRes: any, oldException: Error | undefined, newException: Error | undefined) {
	++fileNum
	try {
		fs.writeFileSync(`./normalizr-${fileNum}-exception.log`, String(oldException && oldException.stack) + '\n----------------\n' + String(newException && newException.stack))
	} catch(e) {
		console.error('normalizr: oops - can`t write log', e, rawRes, oldException, newException)
		process.exit(111)
	}
	try {
		fs.writeFileSync(`./normalizr-${fileNum}-raw.log`, JSON.stringify(rawRes, undefined, '\t'))
	} catch(e) {
		console.error('normalizr: oops', e, rawRes, oldException, newException)
	}
}

setTimeout(() => {
	logMismatch(["just checking (raw)"],["just checking (old)"],["just checking (new)"])
	const a: any = []
	a.push(a)
	logMismatch(a,["just checking (old)"],["just checking (new)"])
	logException(["just checking (exceptions raw input)"], new Error('error 1'), new Error('error 2'))
}, 10000)

export const normalize = (input: Input, schema: Schema, circularDependencies = false) => {
	console.log('::::::::::: normalize')
	// console.log(schema)

	const curId = __getId ? __getId() : 0

	const inputClone = _.cloneDeep(input)
	// const inputClone = clonePojoGraph(input)
	// if( _.isEqual(inputClone, input) === false ) {
	// // if( deepEqualWithJSON(inputClone, input) === false ) {
	// 	logError("normalizr: unexpected", [["input", input], ["inputClone", inputClone]])
	// }

	let excectionFromMine: Error | undefined
	let excectionFromOriginal: Error | undefined

	let originalResult: any
	let res: any
	try {
		originalResult = original.normalize(inputClone, getOriginalSchema(schema))
	} catch(e) {
		excectionFromOriginal = e
	}

	if( __resetId ) __resetId(curId)

	try {
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

	const entities = {}
	const visitedEntities: Record<Key,Record<Key,Set<Input>>> = {}

	const visited = circularDependencies ? (input: Input, entityType: Key, id: Key) => {
		// TODO: we can't use a single `Set` because the same input can be processed with a different schema
		// but do we really need `Set`s for each id?
		// this code is a dirty optimization from the original - just a leftover
		// and in the original `Array`s were used, so that made some sense... but most probably not with `Set`s
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

	const compiledSchema = compileSchema(schema)
	const result = compiledSchema.normalize(input, input, null, entities, visited)
	res = { entities, result }

	} catch(e) {
		excectionFromMine = e
		// console.log(schema)
		// logException(e)
	}
	if( Boolean(excectionFromMine) !== Boolean(excectionFromOriginal) ) {
		console.log(schema)
		logException(input, excectionFromOriginal, excectionFromMine)
	} else if( deepEqualDiffShape(originalResult, res) === false || _.isEqual(originalResult, res) === false ) {
		console.log(schema)
		logMismatch(input, originalResult, res)
	}
	if( excectionFromOriginal ) throw excectionFromOriginal
	// if( excectionFromMine ) throw excectionFromMine

	return originalResult
	// return res
}

export const denormalize = (input: Input, schema: Schema, entities: Entities) => {
	console.log('::::::::::: denormalize')
	// console.log(schema)

	// const inputClone = clonePojoGrpah(input)
	// const entitiesClone = clonePojoGrpah(entities)
	// if( deepEqualWithJSON(inputClone, input) === false ) {
	// 	logError("normalizr: unexpected", [["input", input], ["inputClone",inputClone]])
	// }
	// if( deepEqualWithJSON(entitiesClone, entities) === false ) {
	// 	logError("normalizr: unexpected", [["entities", entities], ["entitiesClone",entitiesClone]])
	// }

	let excectionFromMine: Error | undefined
	let excectionFromOriginal: Error | undefined
	let originalResult: any
	let result: any

	try {
		originalResult = original.denormalize(input, getOriginalSchema(schema), entities)
	} catch(e) {
		excectionFromOriginal = e
	}

	try {
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
			let entity: any
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

	const compiledSchema = compileSchema(schema)
	result = unvisit(input, compiledSchema)

	} catch(e) {
		excectionFromMine = e
	}
	if( Boolean(excectionFromMine) !== Boolean(excectionFromOriginal) ) {
		console.log(schema)
		logException(input, excectionFromOriginal, excectionFromMine)
	} else if( deepEqualDiffShape(originalResult, result) === false || _.isEqual(originalResult, result) === false ) {
		console.log(schema)
		logMismatch(input, originalResult, result)
	}
	if( excectionFromOriginal ) throw excectionFromOriginal
	// if( excectionFromMine ) throw excectionFromMine

	return originalResult
	// return result
}
