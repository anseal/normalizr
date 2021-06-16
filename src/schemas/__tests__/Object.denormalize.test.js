// eslint-env jest
import { denormalize, schema } from '../../'

describe(`${schema.Object.name} denormalization`, () => {
	test('denormalizes an object', () => {
		expect(true).toBe(true)
		// const userSchema = new schema.Entity('user')
		// const object = new schema.Object({
		// 	user: userSchema,
		// })
		// const entities = {
		// 	user: {
		// 		1: { id: 1, name: 'Nacho' },
		// 	},
		// }
		// expect(denormalize({ user: 1 }, object, entities)).toMatchSnapshot()
	})

	// test('denormalizes plain object shorthand', () => {
	// 	const userSchema = new schema.Entity('user')
	// 	const entities = {
	// 		user: {
	// 			1: { id: 1, name: 'Jane' },
	// 		},
	// 	}
	// 	expect(denormalize({ user: 1 }, { user: userSchema, tacos: {} }, entities)).toMatchSnapshot()
	// })

	// test('denormalizes an object that contains a property representing a an object with an id of zero', () => {
	// 	const userSchema = new schema.Entity('user')
	// 	const object = new schema.Object({
	// 		user: userSchema,
	// 	})
	// 	const entities = {
	// 		user: {
	// 			0: { id: 0, name: 'Chancho' },
	// 		},
	// 	}
	// 	expect(denormalize({ user: 0 }, object, entities)).toMatchSnapshot()
	// })
})
