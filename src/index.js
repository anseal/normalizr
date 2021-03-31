import { ArraySchema, compileSchema, EntitySchema, ObjectSchema, UnionSchema, ValuesSchema, visit } from './schemas/Entity.js'

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

	const result = visit(input, input, null, compileSchema(schema), entities, visitedEntities)
	return { entities, result }
}
