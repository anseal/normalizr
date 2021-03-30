import PolymorphicSchema from './Polymorphic'
import { getValues, validateSchema } from '../common.js';

export const denormalize = (schema, input, unvisit) => {
	schema = validateSchema(schema)
	return input && input.map ? input.map((entityOrId) => unvisit(entityOrId, schema)) : input
}

export default class ArraySchema extends PolymorphicSchema {
	normalize(input, parent, key, addEntity, visitedEntities) {
		const values = getValues(input)

		return values
			.map((value, index) => this.normalizeValue(value, parent, key, addEntity, visitedEntities))
			.filter((value) => value !== undefined && value !== null)
	}

	denormalize(input, unvisit) {
		return input && input.map ? input.map((value) => this.denormalizeValue(value, unvisit)) : input
	}
}
