import { normalizeObject } from '../common.js';

export default class ObjectSchema {
	constructor(definition) {
		this.define(definition)
	}

	// TODO: DRY with EntitySchema.define
	define(definition) {
		this.schema = Object.assign(this.schema || {}, definition);
	}

	normalize(...args) {
		return normalizeObject(this.schema, ...args)
	}
}
