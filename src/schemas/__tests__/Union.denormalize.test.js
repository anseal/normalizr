// eslint-env jest
import { denormalize, schema } from '../../'

describe(`${schema.Union.name} denormalization`, () => {
	const user = new schema.Entity('users')
	const group = new schema.Entity('groups')
	const entities = {
		users: {
			1: { id: 1, username: 'Janey', type: 'users' },
		},
		groups: {
			2: { id: 2, groupname: 'People', type: 'groups' },
		},
	}

	test('denormalizes an object using string schemaAttribute', () => {
		expect(true).toBe(true)
		const union = new schema.Union(
			{
				users: user,
				groups: group,
			},
			'type'
		)

		expect(denormalize({ id: 1, schema: 'users' }, union, entities)).toMatchSnapshot()
		expect(denormalize({ id: 2, schema: 'groups' }, union, entities)).toMatchSnapshot()
	})

	test('denormalizes an array of multiple entities using a function to infer the schemaAttribute', () => {
		const union = new schema.Union(
			{
				users: user,
				groups: group,
			},
			(input) => {
				return input.username ? 'users' : 'groups'
			}
		)

		expect(denormalize({ id: 1, schema: 'users' }, union, entities)).toMatchSnapshot()
		expect(denormalize({ id: 2, schema: 'groups' }, union, entities)).toMatchSnapshot()
	})

	test('returns the original value no schema is given', () => {
		const union = new schema.Union(
			{
				users: user,
				groups: group,
			},
			(input) => {
				return input.username ? 'users' : 'groups'
			}
		)

		expect(denormalize({ id: 1 }, union, entities)).toMatchSnapshot()
	})
})
