// eslint-env jest
import { denormalize, schema } from '../../'

describe('EntitySchema denormalization', () => {
	test('denormalizes an entity', () => {
		expect(true).toBe(true)
		const mySchema = new schema.Entity('tacos')
		const entities = {
			tacos: {
				1: { id: 1, type: 'foo' },
			},
		}
		expect(denormalize(1, mySchema, entities)).toMatchSnapshot()
	})

	test('denormalizes deep entities', () => {
		const foodSchema = new schema.Entity('foods')
		const menuSchema = new schema.Entity('menus', {
			food: foodSchema,
		})

		const entities = {
			menus: {
				1: { id: 1, food: 1 },
				2: { id: 2 },
			},
			foods: {
				1: { id: 1 },
			},
		}

		expect(denormalize(1, menuSchema, entities)).toMatchSnapshot()
		expect(denormalize(2, menuSchema, entities)).toMatchSnapshot()
	})

	test('denormalizes to undefined for missing data', () => {
		const foodSchema = new schema.Entity('foods')
		const menuSchema = new schema.Entity('menus', {
			food: foodSchema,
		})

		const entities = {
			menus: {
				1: { id: 1, food: 2 },
			},
			foods: {
				1: { id: 1 },
			},
		}

		expect(denormalize(1, menuSchema, entities)).toMatchSnapshot()
		expect(denormalize(2, menuSchema, entities)).toMatchSnapshot()
	})

	test('can denormalize already partially denormalized data', () => {
		const foodSchema = new schema.Entity('foods')
		const menuSchema = new schema.Entity('menus', {
			food: foodSchema,
		})

		const entities = {
			menus: {
				1: { id: 1, food: { id: 1 } },
			},
			foods: {
				1: { id: 1 },
			},
		}

		expect(denormalize(1, menuSchema, entities)).toMatchSnapshot()
	})

	test('denormalizes recursive dependencies', () => {
		const user = new schema.Entity('users')
		const report = new schema.Entity('reports')

		user.define({
			reports: [report],
		})
		report.define({
			draftedBy: user,
			publishedBy: user,
		})

		const entities = {
			reports: {
				123: {
					id: '123',
					title: 'Weekly report',
					draftedBy: '456',
					publishedBy: '456',
				},
			},
			users: {
				456: {
					id: '456',
					role: 'manager',
					reports: ['123'],
				},
			},
		}
		expect(denormalize('123', report, entities)).toMatchSnapshot()
		expect(denormalize('456', user, entities)).toMatchSnapshot()
	})

	test('denormalizes entities with referential equality', () => {
		const user = new schema.Entity('users')
		const report = new schema.Entity('reports')

		user.define({
			reports: [report],
		})
		report.define({
			draftedBy: user,
			publishedBy: user,
		})

		const entities = {
			reports: {
				123: {
					id: '123',
					title: 'Weekly report',
					draftedBy: '456',
					publishedBy: '456',
				},
			},
			users: {
				456: {
					id: '456',
					role: 'manager',
					reports: ['123'],
				},
			},
		}

		const denormalizedReport = denormalize('123', report, entities)

		expect(denormalizedReport).toBe(denormalizedReport.draftedBy.reports[0])
		expect(denormalizedReport.publishedBy).toBe(denormalizedReport.draftedBy)

		// NOTE: Given how immutable data works, referential equality can't be
		// maintained with nested denormalization.
	})

	test('denormalizes with fallback strategy', () => {
		const user = new schema.Entity(
			'users',
			{},
			{
				idAttribute: 'userId',
				fallbackStrategy: (id, schema) => ({
					[schema.idAttribute]: id,
					name: 'John Doe',
				}),
			}
		)
		const report = new schema.Entity('reports', {
			draftedBy: user,
			publishedBy: user,
		})

		const entities = {
			reports: {
				123: {
					id: '123',
					title: 'Weekly report',
					draftedBy: '456',
					publishedBy: '456',
				},
			},
			users: {},
		}

		const denormalizedReport = denormalize('123', report, entities)

		expect(denormalizedReport.publishedBy).toBe(denormalizedReport.draftedBy)
		expect(denormalizedReport.publishedBy.name).toBe('John Doe')
		expect(denormalizedReport.publishedBy.userId).toBe('456')
		//
	})
})
