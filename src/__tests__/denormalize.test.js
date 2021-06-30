// eslint-env jest
import { denormalize, schema } from '../'

describe('denormalize', () => {
	test('cannot denormalize without a schema', () => {
		expect(() => denormalize({})).toThrow()
	})

	test('returns the input if undefined', () => {
		expect(denormalize(undefined, {}, {})).toBeUndefined()
	})

	test('denormalizes entities', () => {
		const mySchema = new schema.Entity('tacos')
		const entities = {
			tacos: {
				1: { id: 1, type: 'foo' },
				2: { id: 2, type: 'bar' },
			},
		}
		expect(denormalize([1, 2], [mySchema], entities)).toMatchSnapshot()
	})

	test('denormalizes nested entities', () => {
		const user = new schema.Entity('users')
		const comment = new schema.Entity('comments', {
			user: user,
		})
		const article = new schema.Entity('articles', {
			author: user,
			comments: [comment],
		})

		const entities = {
			articles: {
				123: {
					author: '8472',
					body: 'This article is great.',
					comments: ['comment-123-4738'],
					id: '123',
					title: 'A Great Article',
				},
			},
			comments: {
				'comment-123-4738': {
					comment: 'I like it!',
					id: 'comment-123-4738',
					user: '10293',
				},
			},
			users: {
				10293: {
					id: '10293',
					name: 'Jane',
				},
				8472: {
					id: '8472',
					name: 'Paul',
				},
			},
		}
		expect(denormalize('123', article, entities)).toMatchSnapshot()
	})
/*
	test('set to undefined if schema key is not in entities', () => {
		const user = new schema.Entity('users')
		const comment = new schema.Entity('comments', {
			user: user,
		})
		const article = new schema.Entity('articles', {
			author: user,
			comments: [comment],
		})

		const entities = {
			articles: {
				123: {
					id: '123',
					author: '8472',
					comments: ['1'],
				},
			},
			comments: {
				1: {
					user: '123',
				},
			},
		}
		expect(denormalize('123', article, entities)).toMatchSnapshot()
	})
*/
	test('does not modify the original entities', () => {
		const user = new schema.Entity('users')
		const article = new schema.Entity('articles', { author: user })
		const entities = Object.freeze({
			articles: Object.freeze({
				123: Object.freeze({
					id: '123',
					title: 'A Great Article',
					author: '8472',
				}),
			}),
			users: Object.freeze({
				8472: Object.freeze({
					id: '8472',
					name: 'Paul',
				}),
			}),
		})
		expect(() => denormalize('123', article, entities)).not.toThrow()
	})

	test('denormalizes with function as idAttribute', () => {
		const normalizedData = {
			entities: {
				patrons: {
					1: { id: '1', guest: null, name: 'Esther' },
					2: { id: '2', guest: 'guest-2-1', name: 'Tom' },
				},
				guests: { 'guest-2-1': { guest_id: 1 } },
			},
			result: ['1', '2'],
		}

		const guestSchema = new schema.Entity(
			'guests',
			{},
			{
				idAttribute: (value, parent, key) => `${key}-${parent.id}-${value.guest_id}`,
			}
		)

		const patronsSchema = new schema.Entity('patrons', {
			guest: guestSchema,
		})

		expect(denormalize(normalizedData.result, [patronsSchema], normalizedData.entities)).toMatchSnapshot()
	})
})
