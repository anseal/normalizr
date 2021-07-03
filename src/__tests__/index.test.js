// eslint-env jest
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

	test('uses the non-normalized input when getting the ID for an entity', () => {
		const userEntity = new schema.Entity('users')
		// jest.fn() won't work if I choose to use `inplaceProcessStrategy`
		// TODO: maybe return jest.fn() and add explicit `shallowCopyProcessStrategy`
		const idAttributeFnArgsSnapshot = []
		const idAttributeFn = ((...args) => {
			const [nonNormalized] = args
			idAttributeFnArgsSnapshot.push(JSON.stringify(args))
			return nonNormalized.user.id
		})
		const recommendation = new schema.Entity(
			'recommendations',
			{ user: userEntity },
			{
				idAttribute: idAttributeFn,
			}
		)
		expect(normalize({ user: { id: '456' } }, recommendation)).toMatchSnapshot()
		expect(idAttributeFnArgsSnapshot).toMatchSnapshot()
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

	// TODO: remove after deprication process is complete
	test('works with ids generated in processStrategy', () => {
		let maxId = 0
		const someSchema = new schema.Entity('something', {}, {
			processStrategy: entity => {
				entity.id = maxId++;
				return entity;
			},
		});

		expect(normalize([{ x: 'a' }, { y: 'b' }], [someSchema])).toEqual({ entities: { something: { "0": { id: 0, x: 'a' }, "1": { id: 1, y: 'b' } } }, result: [ 0, 1 ] })
	})
})
