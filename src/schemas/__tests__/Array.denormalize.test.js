// eslint-env jest
import { denormalize, normalize, schema } from '../../'

describe('ArraySchema denormalization', () => {
	describe('Object', () => {
		test('denormalizes a single entity', () => {
			expect(true).toBe(true)
			const cats = new schema.Entity('cats')
			const entities = {
				cats: {
					1: { id: 1, name: 'Milo' },
					2: { id: 2, name: 'Jake' },
				},
			}
			expect(denormalize([1, 2], [cats], entities)).toMatchSnapshot()
		})

		test('returns the input value if is not an array', () => {
			const filling = new schema.Entity('fillings')
			const taco = new schema.Entity('tacos', { fillings: [filling] })
			const entities = {
				tacos: {
					123: {
						id: '123',
						fillings: null,
					},
				},
			}

			expect(denormalize('123', taco, entities)).toMatchSnapshot()
		})
	})

	describe('Class', () => {
		test('denormalizes a single entity', () => {
			const cats = new schema.Entity('cats')
			const entities = {
				cats: {
					1: { id: 1, name: 'Milo' },
					2: { id: 2, name: 'Jake' },
				},
			}
			const catList = new schema.Array(cats)
			expect(denormalize([1, 2], catList, entities)).toMatchSnapshot()
		})

		test('denormalizes multiple entities', () => {
			const catSchema = new schema.Entity('cats')
			const peopleSchema = new schema.Entity('person')
			const listSchema = new schema.Array(
				{
					cats: catSchema,
					dogs: {},
					people: peopleSchema,
				},
				(input, _parent, _key) => input.type || 'dogs'
			)

			const entities = {
				cats: {
					123: {
						id: '123',
						type: 'cats',
					},
					456: {
						id: '456',
						type: 'cats',
					},
				},
				person: {
					123: {
						id: '123',
						type: 'people',
					},
				},
			}

			const input = [
				{ id: '123', schema: 'cats' },
				{ id: '123', schema: 'people' },
				{ id: { id: '789' }, schema: 'dogs' },
				{ id: '456', schema: 'cats' },
			]

			expect(denormalize(input, listSchema, entities)).toMatchSnapshot()
		})

		test('returns the input value if is not an array', () => {
			const filling = new schema.Entity('fillings')
			const fillings = new schema.Array(filling)
			const taco = new schema.Entity('tacos', { fillings })
			const entities = {
				tacos: {
					123: {
						id: '123',
						fillings: {},
					},
				},
			}

			expect(denormalize('123', taco, entities)).toMatchSnapshot()
		})

		test('does not assume mapping of schema to attribute values when schemaAttribute is not set', () => {
			const cats = new schema.Entity('cats')
			const catRecord = new schema.Object({
				cat: cats,
			})
			const catList = new schema.Array(catRecord)
			const input = [
				{ cat: { id: 1 }, id: 5 },
				{ cat: { id: 2 }, id: 6 },
			]
			const output = normalize(input, catList)
			expect(output).toMatchSnapshot()
			expect(denormalize(output.result, catList, output.entities)).toEqual(input)
		})
	})
})
