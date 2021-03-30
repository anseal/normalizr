import * as ImmutableUtils from './ImmutableUtils'
import { normalizeObject } from '../common.js';

export const denormalize = (schema, input, unvisit) => {
	if (ImmutableUtils.isImmutable(input)) {
		return ImmutableUtils.denormalizeImmutable(schema, input, unvisit)
	}

	const object = { ...input }
	Object.keys(schema).forEach((key) => {
		if (object[key] != null) {
			object[key] = unvisit(object[key], schema[key])
		}
	})
	return object
}

export default class ObjectSchema {
	constructor(definition) {
		this.define(definition)
	}

	define(definition) {
		this.schema = Object.keys(definition).reduce((entitySchema, key) => {
			const schema = definition[key]
			return { ...entitySchema, [key]: schema }
		}, this.schema || {})
	}

	normalize(...args) {
		return normalizeObject(this.schema, ...args)
	}

	denormalize(...args) {
		return denormalize(this.schema, ...args)
	}
}
