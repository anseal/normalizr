// eslint-env jest
import { compileSchema } from '../schemas/Entity.js'
import { normalize, schema } from '../'

describe('normalize', () => {
	;[42, null, undefined, '42', () => {}].forEach((input) => {
		test(`cannot normalize input that == ${input}`, () => {
			expect(() => normalize(input, new schema.Entity('test'))).toThrow()
		})
	})

	test('cannot normalize without a schema', () => {
		expect(() => normalize({})).toThrow()
	})

	test('cannot normalize with null input', () => {
		const mySchema = new schema.Entity('tacos')
		expect(() => normalize(null, mySchema)).toThrow(/null/)
	})

	test('normalizes entities', () => {
		const mySchema = new schema.Entity('tacos')

		expect(
			normalize(
				[
					{ id: 1, type: 'foo' },
					{ id: 2, type: 'bar' },
				],
				[mySchema]
			)
		).toMatchSnapshot()
	})

	test('normalizes entities with circular references', () => {
		const user = new schema.Entity('users')
		user.define({
			friends: [user],
		})

		const input = { id: 123, friends: [] }
		input.friends.push(input)

		expect(normalize(input, user, true)).toMatchSnapshot()
	})

	test('normalizes nested entities', () => {
		const user = new schema.Entity('users')
		const comment = new schema.Entity('comments', {
			user: user,
		})
		const article = new schema.Entity('articles', {
			author: user,
			comments: [comment],
		})

		const input = {
			id: '123',
			title: 'A Great Article',
			author: {
				id: '8472',
				name: 'Paul',
			},
			body: 'This article is great.',
			comments: [
				{
					id: 'comment-123-4738',
					comment: 'I like it!',
					user: {
						id: '10293',
						name: 'Jane',
					},
				},
			],
		}
		expect(normalize(input, article)).toMatchSnapshot()
	})

	test('does not modify the original input', () => {
		const user = new schema.Entity('users')
		const article = new schema.Entity('articles', { author: user })
		const input = Object.freeze({
			id: '123',
			title: 'A Great Article',
			author: Object.freeze({
				id: '8472',
				name: 'Paul',
			}),
		})
		expect(() => normalize(input, article)).not.toThrow()
	})

	test('ignores null values', () => {
		const myEntity = new schema.Entity('myentities')
		expect(normalize([null], [myEntity])).toMatchSnapshot()
		expect(normalize([undefined], [myEntity])).toMatchSnapshot()
		expect(normalize([false], [myEntity])).toMatchSnapshot()
	})

	// TODO: remove? basically it tests that a user can break encapsulation. why whould we allow this?!
	test('can use fully custom entity classes', () => {
		class MyEntity extends schema.Entity {
			schema = {
				children: compileSchema([new schema.Entity('children')]),
			}

			getId(entity, parent, key) {
				return entity.uuid
			}

			normalize(input, parent, key, entities, visitedEntities) {
				const entity = { ...input }
				Object.keys(this.schema).forEach((key) => {
					const schema = this.schema[key]
					entity[key] = schema.normalize(input[key], input, key, entities, visitedEntities)
				})
				// TODO: inherit this part from `EntitySchema.normalize`?
				const entityType = this.key
				const id = this.getId(entity)
				if (entityType in entities === false) {
					entities[entityType] = {}
				}
				const entitiesOfKind = entities[entityType]
			
				const existingEntity = entitiesOfKind[id]
				if (existingEntity) {
					entitiesOfKind[id] = this._mergeStrategy(existingEntity, entity)
				} else {
					entitiesOfKind[id] = entity
				}

				return {
					uuid: id,
					schema: entityType,
				}
			}
		}

		const mySchema = new MyEntity('food')
		expect(
			normalize(
				{
					uuid: '1234',
					name: 'tacos',
					children: [{ id: 4, name: 'lettuce' }],
				},
				mySchema
			)
		).toMatchSnapshot()
	})

	test('uses the non-normalized input when getting the ID for an entity', () => {
		const userEntity = new schema.Entity('users')
		const idAttributeFn = jest.fn((nonNormalized, parent, key) => nonNormalized.user.id)
		const recommendation = new schema.Entity(
			'recommendations',
			{ user: userEntity },
			{
				idAttribute: idAttributeFn,
			}
		)
		expect(normalize({ user: { id: '456' } }, recommendation)).toMatchSnapshot()
		expect(idAttributeFn.mock.calls).toMatchSnapshot()
		expect(recommendation.idAttribute).toBe(idAttributeFn)
	})

	test('passes over pre-normalized values', () => {
		const userEntity = new schema.Entity('users')
		const articleEntity = new schema.Entity('articles', { author: userEntity })

		expect(normalize({ id: '123', title: 'normalizr is great!', author: 1 }, articleEntity)).toMatchSnapshot()
	})

	test('can normalize object without proper object prototype inheritance', () => {
		const test = { id: 1, elements: [] }
		test.elements.push(
			Object.assign(Object.create(null), {
				id: 18,
				name: 'test',
			})
		)

		const testEntity = new schema.Entity('test', {
			elements: [new schema.Entity('elements')],
		})

		expect(() => normalize(test, testEntity)).not.toThrow()
	})

	test('can normalize entity nested inside entity using property from parent', () => {
		const linkablesSchema = new schema.Entity('linkables')
		const mediaSchema = new schema.Entity('media')
		const listsSchema = new schema.Entity('lists')

		const schemaMap = {
			media: mediaSchema,
			lists: listsSchema,
		}

		linkablesSchema.define({
			data: (parent) => schemaMap[parent.schema_type],
		})

		const input = {
			id: 1,
			module_type: 'article',
			schema_type: 'media',
			data: {
				id: 2,
				url: 'catimage.jpg',
			},
		}

		expect(normalize(input, linkablesSchema)).toMatchSnapshot()
	})

	test('can normalize entity nested inside object using property from parent', () => {
		const mediaSchema = new schema.Entity('media')
		const listsSchema = new schema.Entity('lists')

		const schemaMap = {
			media: mediaSchema,
			lists: listsSchema,
		}

		const linkablesSchema = {
			data: (parent) => schemaMap[parent.schema_type],
		}

		const input = {
			id: 1,
			module_type: 'article',
			schema_type: 'media',
			data: {
				id: 2,
				url: 'catimage.jpg',
			},
		}

		expect(normalize(input, linkablesSchema)).toMatchSnapshot()
	})
})
