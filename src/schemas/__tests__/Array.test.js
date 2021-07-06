// eslint-env jest
import { normalize, schema } from '../../'

describe('ArraySchema normalization', () => {
	describe('Object', () => {
		test('normalizes plain arrays as shorthand for ArraySchema', () => {
			const userSchema = new schema.Entity('user')
			expect(normalize([{ id: 1 }, { id: 2 }], [userSchema])).toMatchSnapshot()
		})

		test('throws an error if created with more than one schema', () => {
			const userSchema = new schema.Entity('users')
			const catSchema = new schema.Entity('cats')
			expect(() => normalize([{ id: 1 }], [catSchema, userSchema])).toThrow()
		})

		test('passes its parent to its children when normalizing', () => {
			const processStrategy = (entity, parent, key) => {
				return { ...entity, parentId: parent.id, parentKey: key }
			}
			const childEntity = new schema.Entity('children', {}, { processStrategy })
			const parentEntity = new schema.Entity('parents', {
				children: [childEntity],
			})

			expect(
				normalize(
					{
						id: 1,
						content: 'parent',
						children: [{ id: 4, content: 'child' }],
					},
					parentEntity
				)
			).toMatchSnapshot()
		})

		test('normalizes Objects using their values', () => {
			const userSchema = new schema.Entity('user')
			expect(normalize({ foo: { id: 1 }, bar: { id: 2 } }, [userSchema])).toMatchSnapshot()
		})
	})

	describe('Class', () => {
		test('normalizes a single entity', () => {
			const cats = new schema.Entity('cats')
			const listSchema = new schema.Array(cats)
			expect(normalize([{ id: 1 }, { id: 2 }], listSchema)).toMatchSnapshot()
		})

		test('normalizes multiple entities', () => {
			const inferSchemaFn = jest.fn((input, parent, key) => input.type || 'dogs')
			const catSchema = new schema.Entity('cats')
			const peopleSchema = new schema.Entity('person')
			const listSchema = new schema.Array(
				{
					cats: catSchema,
					people: peopleSchema,
				},
				inferSchemaFn
			)

			expect(
				normalize(
					[
						{ type: 'cats', id: '123' },
						{ type: 'people', id: '123' },
						{ id: '789', name: 'fido' },
						{ type: 'cats', id: '456' },
					],
					listSchema
				)
			).toMatchSnapshot()
			// expect(inferSchemaFn.mock.calls).toMatchSnapshot()
		})

		test('normalizes Objects using their values', () => {
			const userSchema = new schema.Entity('user')
			const users = new schema.Array(userSchema)
			expect(normalize({ foo: { id: 1 }, bar: { id: 2 } }, users)).toMatchSnapshot()
		})

		test('filters out undefined and null normalized values', () => {
			const userSchema = new schema.Entity('user')
			const users = new schema.Array(userSchema)
			expect(normalize([undefined, { id: 123 }, null], users)).toMatchSnapshot()
		})
	})
})
