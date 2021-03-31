import { ArraySchema, compileSchema, EntitySchema, ObjectSchema, UnionSchema, ValuesSchema } from './schemas/Entity.js'

export const schema = {
	Array: ArraySchema,
	Entity: EntitySchema,
	Object: ObjectSchema,
	Union: UnionSchema,
	Values: ValuesSchema,
}

export const normalize = (input, schema, circularDependencies = false) => {
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
