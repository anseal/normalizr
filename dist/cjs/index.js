"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.denormalize = exports.normalize = exports.schema = exports.overrideDefaultsDuringMigration = exports.strategy = void 0;
const compileSchema = (schema) => {
    if (schema === undefined || schema === null) {
        // TODO: OK, `console` is not a great idea. it interferes with some tools (e.g jest). Can I think of something better?
        // console.warn("Nil schemas are depricated.")
        // @ts-ignore // TODO: remove? some TS versions (4.2.4?) do not understand that `schema` is actually `never` in here
        return schema;
    }
    if (schema instanceof CompiledSchema) {
        return schema;
    }
    if (Array.isArray(schema)) {
        return compileArraySchema(schema);
    }
    // TODO: else - function for example. remove somehow
    if (typeof schema === 'object') {
        return new ObjectSchema(schema);
    }
    return schema;
};
const compileArraySchema = (schema) => {
    // TODO: schema.length === 0 ?
    if (schema.length > 1) {
        throw new Error(`Expected schema definition to be a single schema, but found ${schema.length}.`);
    }
    return new ArraySchema(schema[0], undefined, false);
};
const mapPlainObject = (obj, fn) => {
    const newObj = {};
    for (const key in obj) {
        newObj[key] = fn(obj[key]);
    }
    return newObj;
};
const filterPlainObject = (obj, fn) => {
    const newObj = {};
    for (const key in obj) {
        if (fn(obj[key])) {
            newObj[key] = obj[key];
        }
    }
    return newObj;
};
const compilePlainObjectMapping = (definition) => {
    // /*
    // TODO: !!! that was a good hunt. but don't know wat to do with a catch
    // there is some code in a wild that depends on the sequence of props in schemas (which is obviously wrong, but I need to support it for now)
    // and filtering out undefined schemas (the existance of which is also wrong) here can change the sequence
    return mapPlainObject(definition, compileSchema);
    /*/
    const compiledDefinition = mapPlainObject(definition, compileSchema)
    // TODO: I consider this to be a client error, but for backward compatibility let it be for now. remove!
    return filterPlainObject(compiledDefinition, schema => {
        if( !schema ) {
            // TODO: OK. console is not a great idea. it interferes with some tools (e.g jest). Can I think of something better?
            // console.warn("Nil schemas are depricated.")
            return false
        }
        return true
    })
    //*/
};
let maxId = 0;
const originalIdAttribute = 'id';
const defaultIdAttribute = originalIdAttribute;
const noMergeStrategy = (entityA, _entityB) => entityA;
// TODO: replace `originalMergeStrategy` with `simpleMergeStrategy`
const simpleMergeStrategy = (entityA, entityB) => Object.assign(entityA, entityB);
const originalMergeStrategy = (entityA, entityB) => (Object.assign(Object.assign({}, entityA), entityB));
const defaultMergeStrategy = originalMergeStrategy;
// const defaultMergeStrategy = noMergeStrategy
const inplaceProcessStrategy = (input) => input;
const originalProcessStrategy = (input) => (Object.assign({}, input)); // TODO: while using this strategy try not to copy, at least before merge/return?
const defaultProcessStrategy = originalProcessStrategy;
// const defaultProcessStrategy = inplaceProcessStrategy
const originalFallbackStrategy = (_key, _schema) => undefined;
const defaultFallbackStrategy = originalFallbackStrategy;
exports.strategy = {
    noMerge: noMergeStrategy,
    inplaceMerge: simpleMergeStrategy,
    fullMerge: originalMergeStrategy,
    inplaceProcess: inplaceProcessStrategy,
    aggregateProcess: (input, _parent, _keyInParent, existingEntity) => {
        return Object.assign(existingEntity || {}, input);
    },
    aggregateInplaceProcess: (input, _parent, _keyInParent, existingEntity) => {
        if (existingEntity) {
            return Object.assign(existingEntity, input);
        }
        return input;
    },
    copyAndProcess: originalProcessStrategy,
    noFallback: originalFallbackStrategy,
};
const overrideDefaultsDuringMigration = (schema, defaults = {}, replacements = new Map()) => {
    defaults = Object.assign({ idAttribute: defaultIdAttribute, mergeStrategy: noMergeStrategy, processStrategy: inplaceProcessStrategy, fallbackStrategy: originalFallbackStrategy }, defaults);
    // TODO: I consider this to be a client error, but for backward compatibility let it be for now. remove!
    if (!schema) {
        throw new Error("Nil schemas are depricated.");
    }
    return _overrideDefaultsDuringMigration(compileSchema(schema), defaults, replacements, new Map());
};
exports.overrideDefaultsDuringMigration = overrideDefaultsDuringMigration;
const _overrideDefaultsDuringMigration = (schema, defaults, replacements, visitedSchemaElements) => {
    if (!schema) {
        // TODO: OK, `console` is not a great idea. it interferes with some tools (e.g jest). Can I think of something better?
        // console.warn("Nil schemas are depricated.")
        return schema;
    }
    const cachedSchema = visitedSchemaElements.get(schema);
    if (cachedSchema !== undefined) {
        return cachedSchema;
    }
    const replacement = replacements.get(schema);
    const newSchema = Object.create(Object.getPrototypeOf(replacement || schema));
    Object.assign(newSchema, schema);
    visitedSchemaElements.set(schema, newSchema);
    if (schema.schema instanceof CompiledSchema) {
        const newSubSchema = _overrideDefaultsDuringMigration(schema.schema, defaults, replacements, visitedSchemaElements);
        // TODO: I consider this to be a client error, but for backward compatibility let it be for now. remove!
        if (!newSubSchema) {
            throw new Error("Nil schemas are depricated.");
        }
        newSchema.schema = newSubSchema;
    }
    else {
        for (const key in schema.schema) {
            const newSubSchema = _overrideDefaultsDuringMigration(schema.schema[key], defaults, replacements, visitedSchemaElements);
            // TODO: I consider this to be a client error, but for backward compatibility let it be for now. remove!
            if (!newSubSchema) {
                // TODO: OK, `console` is not a great idea. it interferes with some tools (e.g jest). Can I think of something better?
                // console.warn("Nil schemas are depricated.")
                continue;
            }
            newSchema.schema[key] = newSubSchema;
        }
        if (schema instanceof EntitySchema) {
            const _newSchema = newSchema;
            _newSchema.__id = _newSchema.__id + "*"; // TODO: for debugging purposes. remove?
            const override = (prop, defaultValue) => {
                if (schema[`_${prop}`] === defaultValue) {
                    newSchema[`_${prop}`] = defaults[prop];
                }
                else {
                    newSchema[`_${prop}`] = schema[`_${prop}`];
                }
            };
            override('idAttribute', defaultIdAttribute);
            override('mergeStrategy', defaultMergeStrategy);
            override('processStrategy', defaultProcessStrategy);
            override('fallbackStrategy', defaultFallbackStrategy);
        }
    }
    return newSchema;
};
class CompiledSchema {
}
class EntitySchema extends CompiledSchema {
    constructor(key, definition = {}, options = {}) {
        super();
        this.__id = maxId++; // TODO: for debugging purposes. remove?
        this.schema = {};
        if (!key || typeof key !== 'string') {
            throw new Error(`Expected a string key for Entity, but found ${key}.`);
        }
        const { idAttribute = defaultIdAttribute, mergeStrategy = defaultMergeStrategy, processStrategy = defaultProcessStrategy, fallbackStrategy = defaultFallbackStrategy, } = options;
        this._key = key;
        this._getId = typeof idAttribute === 'function' ? idAttribute : (input) => input[idAttribute];
        this._idAttribute = idAttribute;
        this._mergeStrategy = mergeStrategy;
        this._processStrategy = processStrategy;
        this._fallbackStrategy = fallbackStrategy;
        this.define(definition);
    }
    // TODO: remove from API? not used internally
    get key() {
        return this._key;
    }
    // TODO: remove from API (and altogether)? not used internally
    get idAttribute() {
        return this._idAttribute;
    }
    define(definition) {
        // TODO: check if `definition` is an object?
        // TODO: check if it's a plain object, so that it's safe to iterate over schema without `hasOwnProperty`
        this.schema = Object.assign(this.schema || {}, compilePlainObjectMapping(definition));
    }
    normalize(input, parent, keyInParent, entities, visited) {
        if (typeof input !== 'object' || input === null) {
            return input;
        }
        let id = this._getId(input, parent, keyInParent);
        // TODO: what if `id` is not unique?
        // TODO: add after deprication process is complete... or maybe not
        // if (id === undefined) {
        // 	throw new Error('normalizr: `id` is required and setting it in `processStrategy` is depricated')
        // }
        const entityType = this._key;
        // check the presence first, then check if there would be any merge or it just `identity()` function
        // and in the latter case skip normalization entirely
        // TODO: preallocate all `entityType`s?
        if (entityType in entities === false) {
            entities[entityType] = {};
        }
        const entitiesOfKind = entities[entityType];
        const existingEntity = entitiesOfKind[id];
        if (existingEntity && this._mergeStrategy === noMergeStrategy) {
            return id;
        }
        // TODO: move cirular check up.
        // TODO: does `existingEntity === undefined` means that `visited() === false`?
        if (visited(input, entityType, id)) {
            return id;
        }
        // TODO: default Strategy - copy over existingEntity ?
        const processedEntity = this._processStrategy(input, parent, keyInParent, existingEntity, id);
        for (const key in this.schema) {
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
            const schema = this.schema[key];
            // @ts-ignore
            const resolvedSchema = typeof schema === 'function' ? schema(input) : schema; // TODO: function instead of if?
            // TODO: I consider this to be a client error, but for backward compatibility let it be for now. remove!
            if (!resolvedSchema) {
                // TODO: `console` output here is really bad, left it for debuging
                // console.warn("Nil schemas are depricated.", this.schema, key)
                continue;
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
            if (typeof processedEntity[key] === 'object') { // TODO: what about null?
                processedEntity[key] = resolvedSchema.normalize(processedEntity[key], processedEntity, key, entities, visited);
            }
            // }
        }
        // TODO: remove after deprication process is complete
        if (id === undefined) {
            id = this._getId(input, parent, keyInParent); // if a user adds `id` while mutating the `input`
            // TODO: probable not needed, because v3.3.0 (which is my target) takes id from the `input` and not the `processedEntity`
            // if(id === undefined) {
            // 	id = this._getId(processedEntity, parent, keyInParent) // if a user adds `id` to the `processedEntity` without mutating the `input`
            // }
        }
        if (existingEntity) {
            entitiesOfKind[id] = this._mergeStrategy(existingEntity, processedEntity);
        }
        else {
            entitiesOfKind[id] = processedEntity;
        }
        return id;
    }
    denormalize(input, unvisit) {
        if (input === undefined || input === null) {
            return input;
        }
        Object.keys(this.schema).forEach((key) => {
            if (input.hasOwnProperty(key)) {
                const schema = this.schema[key];
                input[key] = unvisit(input[key], schema);
            }
        });
        return input;
    }
}
class ObjectSchema extends CompiledSchema {
    constructor(definition) {
        super();
        this.schema = {};
        this.define(definition);
    }
    // TODO: DRY with EntitySchema.define?
    // TODO: stale comment: // TODO: now there is a difference, should we compile children schemas and should there be more tests?
    define(definition) {
        // TODO: check if `definition` is an object?
        // TODO: check if it's a plain object, so that it's safe to iterate over schema without `hasOwnProperty`
        this.schema = Object.assign(this.schema || {}, compilePlainObjectMapping(definition));
    }
    normalize(input, _parent, _keyInParent, entities, visited) {
        if (typeof input !== 'object' || input === null) {
            return input;
        }
        // TODO: DRY with `EntitySchema.normalize`
        // TODO: + _processStrategy ?
        const output = {};
        for (const key in input) {
            if (input.hasOwnProperty(key) === false) { // TODO: doesn't looks like it degrades perf much
                continue;
            }
            const localSchema = this.schema[key];
            if (localSchema) {
                // @ts-ignore
                const resolvedLocalSchema = typeof localSchema === 'function' ? localSchema(input) : localSchema;
                const value = resolvedLocalSchema.normalize(input[key], input, key, entities, visited);
                // TODO: there're only two cases when it can return null|unefined
                // 1) [null, value, ...]
                // 2) if( !schema ) return input
                if (value !== undefined && value !== null) { // TODO: options?
                    output[key] = value;
                }
            }
            else {
                output[key] = input[key];
            }
        }
        return output;
    }
    denormalize(input, unvisit) {
        if (input === undefined || input === null) {
            return input;
        }
        const object = Object.assign({}, input);
        Object.keys(this.schema).forEach((key) => {
            if (object[key] != null) {
                object[key] = unvisit(object[key], this.schema[key]);
            }
        });
        return object;
    }
}
class PolymorphicSchema extends CompiledSchema {
    constructor(definition, schemaAttribute) {
        super();
        this.schema = {};
        this._schemaAttribute = undefined;
        if (schemaAttribute) {
            this._schemaAttribute = typeof schemaAttribute === 'string' ? (input) => input[schemaAttribute] : schemaAttribute;
            this._normalizeValue = this._normalizeValue2;
        }
        else {
            this._normalizeValue = this._normalizeValue1;
        }
        this.define(definition);
    }
    define(definition) {
        if (this._schemaAttribute !== undefined) {
            if (definition instanceof CompiledSchema) {
                this.schema = definition;
            }
            else {
                if (Array.isArray(definition)) {
                    this.schema = compileArraySchema(definition);
                }
                else {
                    this.schema = compilePlainObjectMapping(definition);
                }
            }
        }
        else {
            this.schema = compileSchema(definition);
        }
    }
    _normalizeValue1(value, parent, keyInParent, entities, visited) {
        // @ts-ignore
        return this.schema.normalize(value, parent, keyInParent, entities, visited);
    }
    _normalizeValue2(value, parent, keyInParent, entities, visited) {
        // TODO: just a function whould be simpler compared to function & map
        const attr = this._schemaAttribute(value, parent, keyInParent);
        const schema = this.schema[attr];
        if (!schema) { // TODO: can we precompile this?
            return value;
        }
        const normalizedValue = schema.normalize(value, parent, keyInParent, entities, visited);
        return normalizedValue === undefined || normalizedValue === null
            ? normalizedValue
            : {
                id: normalizedValue,
                schema: attr
            };
    }
    denormalizeValue(input, unvisit) {
        if (input === undefined || input === null) {
            return input;
        }
        const schemaKey = input.schema;
        if (this._schemaAttribute && !schemaKey) {
            return input;
        }
        const id = !this._schemaAttribute ? undefined : input.id;
        const schema = !this._schemaAttribute ? this.schema : this.schema[schemaKey];
        return unvisit(id || input, schema);
    }
}
class ValuesSchema extends PolymorphicSchema {
    normalize(input, _parent, _keyInParent, entities, visited) {
        if (typeof input !== 'object' || input === null) {
            return input;
        }
        const output = {};
        for (const key in input) {
            if (input.hasOwnProperty(key) === false) { // TODO: doesn't looks like it degrades perf much, but anyway - try to move after !value checks
                continue;
            }
            const value = input[key];
            // TODO: ? if( typeof value === 'object' && value !== null ) ... else if( value !== undefined && value !== ... ) output[key] = value
            // TODO: ? normValue = this._normalizeValue(value, input, key, entities, visited); if( cond(normValue) ) output[key] = normValue
            if (value !== undefined && value !== null) {
                output[key] = this._normalizeValue(value, input, key, entities, visited);
            }
        }
        return output;
    }
    denormalize(input, unvisit) {
        if (input === undefined || input === null) {
            return input;
        }
        return Object.keys(input).reduce((output, key) => {
            const entityOrId = input[key];
            return Object.assign(Object.assign({}, output), { [key]: this.denormalizeValue(entityOrId, unvisit) });
        }, {});
    }
}
class ArraySchema extends PolymorphicSchema {
    constructor(definition, schemaAttribute, filterNullish = true) {
        super(definition, schemaAttribute);
        this.filterNullish = filterNullish;
    }
    normalize(input, parent, keyInParent, entities, visited) {
        if (typeof input !== 'object' || input === null) {
            return input;
        }
        // TODO: what is it for? maybe change API and remove?
        // from docs: "If the input value is an Object instead of an Array, the normalized result will be an Array of the Object's values."
        // disagree on this - just make this explicit in a schema
        // ...but the output will be an Object then, not an Array... so it needs to be customizable
        if (Array.isArray(input) === false) {
            input = Object.keys(input).map((key) => input[key]); // TODO: Object.values()
        }
        // TODO: preallocate, and then cut by length?
        const normArray = [];
        for (const value of input) {
            // Special case: Arrays pass *their* parent on to their children, since there
            // is not any special information that can be gathered from themselves directly
            const normValue = this._normalizeValue(value, parent, keyInParent, entities, visited);
            // TODO: what is it for, and why here and not before `_normalizeValue`?
            // TODO: filtration of falsies present in tests, but not in docs, and I have no idea why the difference
            // between [mySchema] and schema.Array(mySchema)
            if (this.filterNullish === false || (normValue !== undefined && normValue !== null)) {
                normArray.push(normValue);
            }
        }
        return normArray;
    }
    denormalize(input, unvisit) {
        return Array.isArray(input) ? input.map((value) => this.denormalizeValue(value, unvisit)) : input;
    }
}
// TODO: this one has meaning only with _normalizeValue2
class UnionSchema extends PolymorphicSchema {
    constructor(definition, schemaAttribute) {
        if (!schemaAttribute) {
            throw new Error('Expected option "schemaAttribute" not found on UnionSchema.');
        }
        super(definition, schemaAttribute);
    }
    normalize(input, parent, keyInParent, entities, visited) {
        return this._normalizeValue(input, parent, keyInParent, entities, visited);
    }
    denormalize(input, unvisit) {
        return this.denormalizeValue(input, unvisit);
    }
}
exports.schema = {
    Array: ArraySchema,
    Entity: EntitySchema,
    Object: ObjectSchema,
    Union: UnionSchema,
    Values: ValuesSchema,
};
// TODO: something like:
// type NormalizeResult<Result, Collections> = {
// 	result: Result,
// 	entities: Collections,
// }
const normalize = (input, schema, circularDependencies = false) => {
    // TODO: not sure why we should throw here but not deeper in the tree (there we just return value)
    if (typeof input !== 'object' || input === null) {
        throw new Error(`Unexpected input given to normalize. Expected type to be "object", found "${input === null ? 'null' : typeof input}".`);
    }
    if (schema === undefined || schema === null) {
        throw new Error("Nil schemas are depricated.");
    }
    const entities = {};
    const visitedEntities = {};
    const visited = circularDependencies ? (input, entityType, id) => {
        // TODO: we can't use a single `Set` because the same input can be processed with a different schema
        // but do we really need `Set`s for each id?
        // this code is a dirty optimization from the original - just a leftover
        // and in the original `Array`s were used, so that made some sense... but most probably not with `Set`s
        if (!(entityType in visitedEntities)) {
            visitedEntities[entityType] = {};
        }
        if (!(id in visitedEntities[entityType])) {
            visitedEntities[entityType][id] = new Set();
        }
        if (visitedEntities[entityType][id].has(input)) {
            return true;
        }
        visitedEntities[entityType][id].add(input);
        return false;
    } : () => false;
    const result = compileSchema(schema).normalize(input, input, null, entities, visited);
    return { entities, result };
};
exports.normalize = normalize;
const denormalize = (input, schema, entities) => {
    if (schema === undefined || schema === null) {
        throw new Error("Nil schemas are depricated.");
    }
    if (input === undefined || input === null) { // TODO: remove. there're checks deeper in the call stack
        return input;
    }
    const cache = {};
    function unvisit(input, schema) {
        if (input === undefined || input === null) {
            return input;
        }
        if (schema instanceof EntitySchema) {
            const id = input;
            const schemaKey = schema.key;
            let entity;
            if (typeof id === 'object') {
                entity = id;
            }
            else {
                entity = entities[schemaKey] && entities[schemaKey][id];
            }
            if (entity === undefined && schema instanceof EntitySchema) {
                entity = schema._fallbackStrategy(id, schema);
            }
            if (typeof entity !== 'object' || entity === null) {
                return entity;
            }
            if (!cache[schema.key]) {
                cache[schema.key] = {};
            }
            if (!cache[schema.key][id]) {
                // Ensure we don't mutate it non-immutable objects
                const entityCopy = Object.assign({}, entity);
                // Need to set this first so that if it is referenced further within the
                // denormalization the reference will already exist.
                cache[schema.key][id] = entityCopy;
                cache[schema.key][id] = schema.denormalize(entityCopy, unvisit);
            }
            return cache[schema.key][id];
        }
        return schema.denormalize(input, unvisit);
    }
    return unvisit(input, compileSchema(schema));
};
exports.denormalize = denormalize;
//# sourceMappingURL=index.js.map