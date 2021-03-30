import PolymorphicSchema from './Polymorphic'

export default class UnionSchema extends PolymorphicSchema {
	constructor(definition, schemaAttribute) {
		if (!schemaAttribute) {
			throw new Error('Expected option "schemaAttribute" not found on UnionSchema.')
		}
		super(definition, schemaAttribute)
	}

	normalize(input, parent, key, addEntity, visitedEntities) {
		return this.normalizeValue(input, parent, key, addEntity, visitedEntities)
	}

	denormalize(input, unvisit) {
		return this.denormalizeValue(input, unvisit)
	}
}
