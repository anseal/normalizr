// eslint-env jest
import { normalize, schema } from '../../'

describe('ObjectSchema normalization', () => {
	test('normalizes an object', () => {
		const userSchema = new schema.Entity('user')
		const object = new schema.Object({
			user: userSchema,
		})
		expect(normalize({ user: { id: 1 } }, object)).toMatchSnapshot()
	})

	test('normalizes plain objects as shorthand for ObjectSchema', () => {
		const userSchema = new schema.Entity('user')
		expect(normalize({ user: { id: 1 } }, { user: userSchema })).toMatchSnapshot()
	})

	test('filters out undefined and null values', () => {
		const userSchema = new schema.Entity('user')
		const users = { foo: userSchema, bar: userSchema, baz: userSchema }
		expect(normalize({ foo: {}, bar: { id: '1' } }, users)).toMatchSnapshot()
	})
})
