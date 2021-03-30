import PolymorphicSchema from './Polymorphic'

export default class ValuesSchema extends PolymorphicSchema {
	normalize(input, parent, key, addEntity, visitedEntities) {
		return Object.keys(input).reduce((output, key) => {
			const value = input[key]
			return value !== undefined && value !== null
				? {
						...output,
						[key]: this.normalizeValue(value, input, key, addEntity, visitedEntities),
				  }
				: output
		}, {})
	}
}
