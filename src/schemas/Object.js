import { normalizeObject } from '../common.js';

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
}
