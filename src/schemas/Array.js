import { getValues } from '../common.js';
import PolymorphicSchema from './Polymorphic'

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
}
