// eslint-env jest
import { denormalize, schema } from '../../'

describe(`${schema.Values.name} denormalization`, () => {
	test('denormalizes the values of an object with the given schema', () => {
		expect(true).toBe(true)
		const cat = new schema.Entity('cats')
		const dog = new schema.Entity('dogs')
		const valuesSchema = new schema.Values(
			{
				dogs: dog,
				cats: cat,
			},
			(entity, _key) => entity.type
		)

		const entities = {
			cats: { 1: { id: 1, type: 'cats' } },
			dogs: { 1: { id: 1, type: 'dogs' } },
		}

		expect(
			denormalize(
				{
					fido: { id: 1, schema: 'dogs' },
					fluffy: { id: 1, schema: 'cats' },
				},
				valuesSchema,
				entities
			)
		).toMatchSnapshot()
	})
})
