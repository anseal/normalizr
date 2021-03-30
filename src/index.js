import ArraySchema from './schemas/Array'
import EntitySchema from './schemas/Entity'
import ObjectSchema from './schemas/Object'
import UnionSchema from './schemas/Union'
import ValuesSchema from './schemas/Values'
import { visit } from './common.js'

export const schema = {
	Array: ArraySchema,
	Entity: EntitySchema,
	Object: ObjectSchema,
	Union: UnionSchema,
	Values: ValuesSchema,
}

export const normalize = (input, schema) => {
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
		if (!(schemaKey in entities)) {
			entities[schemaKey] = {}
		}
	
		const existingEntity = entities[schemaKey][id]
		if (existingEntity) {
			entities[schemaKey][id] = schema.merge(existingEntity, processedEntity)
		} else {
			entities[schemaKey][id] = processedEntity
		}
	}

	const result = visit(input, input, null, schema, addEntity, visitedEntities)
	return { entities, result }
}
