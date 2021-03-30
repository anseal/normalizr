export const visit = (value, parent, key, schema, addEntity, visitedEntities) => {
	if (typeof value !== 'object' || !value) {
		return value
	}

	if (typeof schema === 'object' && (!schema.normalize || typeof schema.normalize !== 'function')) {
		const method = Array.isArray(schema) ? normalizeArray : normalizeObject
		return method(schema, value, parent, key, visit, addEntity, visitedEntities)
	}

	return schema.normalize(value, parent, key, visit, addEntity, visitedEntities)
}

export const getValues = (input) => (Array.isArray(input) ? input : Object.keys(input).map((key) => input[key]))

export const validateSchema = (definition) => {
	const isArray = Array.isArray(definition)
	if (isArray && definition.length > 1) {
		throw new Error(`Expected schema definition to be a single schema, but found ${definition.length}.`)
	}

	return definition[0]
}

export const normalizeArray = (schema, input, parent, key, visit, addEntity, visitedEntities) => {
	schema = validateSchema(schema)

	const values = getValues(input)

	// Special case: Arrays pass *their* parent on to their children, since there
	// is not any special information that can be gathered from themselves directly
	return values.map((value, index) => visit(value, parent, key, schema, addEntity, visitedEntities))
}

export const normalizeObject = (schema, input, parent, key, visit, addEntity, visitedEntities) => {
	const object = { ...input }
	Object.keys(schema).forEach((key) => {
		const localSchema = schema[key]
		const resolvedLocalSchema = typeof localSchema === 'function' ? localSchema(input) : localSchema
		const value = visit(input[key], input, key, resolvedLocalSchema, addEntity, visitedEntities)
		if (value === undefined || value === null) {
			delete object[key]
		} else {
			object[key] = value
		}
	})
	return object
}
