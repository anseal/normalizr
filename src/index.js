import { ArraySchema, EntitySchema, ObjectSchema, UnionSchema, ValuesSchema, visit } from './schemas/Entity'

export const schema = {
	Array: ArraySchema,
	Entity: EntitySchema,
	Object: ObjectSchema,
	Union: UnionSchema,
	Values: ValuesSchema,
}

export const normalize = (input, schema) => {
	// TODO: not sure why we should throw here but not deeper in the tree (there we just return value)
	if (!input || typeof input !== 'object') {
		throw new Error(
			`Unexpected input given to normalize. Expected type to be "object", found "${
				input === null ? 'null' : typeof input
			}".`
		)
	}

	const entities = {}
	const visitedEntities = {}
	const addEntity = (schema, processedEntity, value, parent, key) => {
		const schemaKey = schema.key
		const id = schema.getId(value, parent, key)
		if (schemaKey in entities === false) {
			entities[schemaKey] = {}
		}
		const entitiesOfKind = entities[schemaKey]
	
		const existingEntity = entitiesOfKind[id]
		if (existingEntity) {
			entitiesOfKind[id] = schema.merge(existingEntity, processedEntity)
		} else {
			entitiesOfKind[id] = processedEntity
		}
	}

	const result = visit(input, input, null, schema, addEntity, visitedEntities)
	return { entities, result }
}
