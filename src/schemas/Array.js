import PolymorphicSchema from './Polymorphic'
import { getValues, validateSchema } from '../common.js';

export const denormalize = (schema, input, unvisit) => {
	schema = validateSchema(schema)
	return input && input.map ? input.map((entityOrId) => unvisit(entityOrId, schema)) : input
}

export default class ArraySchema extends PolymorphicSchema {
	normalize(input, parent, key, addEntity, visitedEntities) {
		// TODO: what is it for? in denormalization - probably. but here... why?
		// const getValues = (input) => (Array.isArray(input) ? input : Object.keys(input).map((key) => input[key]))
		// maybe replace with
		// const values = input
		const values = getValues(input)

		// TODO: preallocate, and then cut by length?
		const normArray = []
		for(const value of values) {
			const normValue = this.normalizeValue(value, parent, key, addEntity, visitedEntities)
			// TODO: what is it for, and why here and not before `normalizeValue`?
			if( normValue !== undefined && normValue !== null ) {
				normArray.push(normValue)
			}
		}
		return normArray
	}

	denormalize(input, unvisit) {
		return input && input.map ? input.map((value) => this.denormalizeValue(value, unvisit)) : input
	}
}
