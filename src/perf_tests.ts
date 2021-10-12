import { normalize, overrideDefaultsDuringMigration, schema, Schema, strategy } from './index.js'
import { cloneWithJSON, clonePojoTree, deepEqualWithJSON, deepEqualSameShape } from './utils.js'

const randomInRange = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const repeat = (cnt: number, fn: (i: number) => any) => {
	const results = []
	for (let i = 0; i !== cnt; ++i) {
		results[i] = fn(i)
	}
	return results
}

// Define a users schema
const user = new schema.Entity('users')

const content = new schema.Entity('content')
// Define your comments schema
const comment = new schema.Entity('comments', {
	commenter: user,
	comment: { content },
})

// Define your article
const article = new schema.Entity('articles', {
	author: user,
	comments: [comment],
})

const comments_cnt = 1000000
const users_cnt = 100
const users = repeat(users_cnt, (id) => {
	return {
		id,
		name: 'Paul',
		surname: 'Qu',
		age: 10,
		status: true,
	}
})
const author = users[randomInRange(0, users_cnt - 1)]
const originalData = {
	'id': 123,
	'author': author,
	'title': 'My awesome blog post',
	'comments': repeat(comments_cnt, (id) => {
		const user = users[randomInRange(0, users_cnt - 1)]
		return {
			'id': id,
			'commenter': {
				'id': randomInRange(0, users_cnt - 1),
				'name': user.name,
			},
			comment: { content: randomInRange(0,1) ? null : {} },
		}
	}),
}

// const article_ = article
const article_ = overrideDefaultsDuringMigration(article)
/*
export const test = (performance: { now: () => number }) => {
	const data = clonePojoTree(originalData)
	const data2 = cloneWithJSON(originalData)
	if( deepEqualWithJSON(data, data2) === false ) {
		if( deepEqualSameShape(data, data2) ) throw new Error('even more unexpected 1')
		throw new Error('unexpected')
	}
	if( deepEqualSameShape(data, data2) === false ) throw new Error('even more unexpected 2')
	const start = performance.now()
	const normalizedData = normalize(data, article_)
	const duration = performance.now() - start
	console.log(duration)
	console.log(Object.keys(normalizedData).length)
}
/*/
export const test = (performance: { now: () => number } = { now: () => 0 }) => {
/*	const addressSchema = new schema.Entity('address', {}, {
		processStrategy: (entity) => {
			console.log('address processed', entity)
			return entity
		}
	})
	const userSchema: [Schema] = [ new schema.Entity('user', { address: addressSchema }) ]

	const john = () => ({ id: 1, name: 'John', address: { id: 1, street: "Elm" } });
	const jane = () => ({ id: 2, name: 'Jane', address: { id: 2, town: "Silent hill" } });

	{
		const normalizedData = normalize([
			john(),
			john(),
			{ ...john(), surname: 'Doe' },
			jane(),
		], userSchema)
		console.log(JSON.stringify(normalizedData))
	}

	{
		const userSchemaNewStrategies = overrideDefaultsDuringMigration(userSchema)
		const normalizedData = normalize([
			john(),
			john(),
			{ ...john(), surname: 'Doe' },
			jane(),
		], userSchemaNewStrategies)
		console.log(JSON.stringify(normalizedData))
	}

	{
		const userSchemaNewStrategies = overrideDefaultsDuringMigration(userSchema)
		const normalizedData = normalize([
			{ ...john(), surname: 'Doe' },
			john(),
			john(),
			jane(),
		], userSchemaNewStrategies)
		console.log(JSON.stringify(normalizedData))
	}

	{
		const userSchema: [Schema] = [
			new schema.Entity('user', { address: addressSchema }, {
				processStrategy: (entity, _parent, _keyInParent, existingEntity, id) => {
					if( existingEntity && entity.surname !== undefined ) {
						existingEntity.surname = entity.surname
						return existingEntity
					}
					return entity
				},
				mergeStrategy: x => x,
			})
		]
		const userSchemaNewStrategies = overrideDefaultsDuringMigration(userSchema)
		const normalizedData = normalize([
			john(),
			john(),
			{ ...john(), surname: 'Doe' },
			jane(),
		], userSchemaNewStrategies)
		console.log(JSON.stringify(normalizedData))
	}


	//
	//
	//
	console.log("!!!!!!!!")
	{
		const slowConvertion = (value: string) => {
			console.log('slowConvertion')
			return value?.toUpperCase()
		}
			
		const addressProcessStrategy = (entity: any) => {
			console.log('address processed', entity)
			return {
				county: slowConvertion(entity.county), 
				town: slowConvertion(entity.town),
				street: slowConvertion(entity.street),
			}
		}
		const addressSchema = new schema.Entity('address', {}, {
			processStrategy: addressProcessStrategy
		})
		const userSchema: [Schema] = [ new schema.Entity('user', { address: addressSchema }) ]

		const addr_part_1 = () => ({ id: 1, county: 'usa', street: "Elm" })
		const addr_part_2 = () => ({ id: 1, county: 'usa', town: "Silent hill" })

		const john = () => ({ id: 1, name: 'John', address: addr_part_1() })
		const jane = () => ({ id: 2, name: 'Jane', address: addr_part_2() })

		{
			const normalizedData = normalize([
				john(),
				john(),
				{ ...john(), address: addr_part_2() },
				jane(),
			], userSchema)
			console.log(JSON.stringify(normalizedData))
		}

		{
			const userSchemaNewStrategies = overrideDefaultsDuringMigration(userSchema)
			const normalizedData = normalize([
				john(),
				john(),
				{ ...john(), address: addr_part_2() },
				jane(),
			], userSchemaNewStrategies)
			console.log(JSON.stringify(normalizedData))
		}
		{
			const addressSchema = new schema.Entity('address', {}, {
				processStrategy: addressProcessStrategy,
				mergeStrategy: (entityA, entityB) => Object.assign(entityA, entityB),
			})
			const userSchema: [Schema] = [ new schema.Entity('user', { address: addressSchema }) ]

			const userSchemaNewStrategies = overrideDefaultsDuringMigration(userSchema)
			const normalizedData = normalize([
				john(),
				john(),
				{ ...john(), address: addr_part_2() },
				{ ...jane(), address: addr_part_1() },
			], userSchemaNewStrategies)
			console.log(JSON.stringify(normalizedData))
		}
		{
			const addressSchema = new schema.Entity('address', {}, {
				processStrategy: addressProcessStrategy,
				mergeStrategy: (entityA, entityB) => Object.assign(entityA, entityB),
			})
			const userSchema: [Schema] = [ new schema.Entity('user', { address: addressSchema }, {
				mergeStrategy: x => x,
			}) ]

			const userSchemaNewStrategies = overrideDefaultsDuringMigration(userSchema)
			const normalizedData = normalize([
				john(),
				john(),
				{ ...john(), address: addr_part_2() },
				{ ...jane(), address: addr_part_1() },
			], userSchemaNewStrategies)
			console.log(JSON.stringify(normalizedData))
		}
		{
			const addressSchema = new schema.Entity('address', {}, {
				processStrategy: (entity, _parent, _keyInParent, existingEntity, id) => {
					console.log('lightweigth processing', entity)
					const address = existingEntity || { ...entity }
					if( entity.country !== undefined ) address.country = slowConvertion(entity.country)
					if( entity.town !== undefined ) address.town = slowConvertion(entity.town)
					if( entity.street !== undefined ) address.street = slowConvertion(entity.street)
					return address
				},
				mergeStrategy: x => x,
			})
			const userSchema: [Schema] = [ new schema.Entity('user', { address: addressSchema }, {
				mergeStrategy: x => x,
			}) ]

			const userSchemaNewStrategies = overrideDefaultsDuringMigration(userSchema)
			const normalizedData = normalize([
				john(),
				john(),
				{ ...john(), address: addr_part_2() },
				{ ...jane(), address: addr_part_1() },
			], userSchemaNewStrategies)
			console.log(JSON.stringify(normalizedData))
		}
	}
//*/
	//
	//
	//
	console.log("???")
	const john = () => ({ id: 1, name: 'John', address: { id: 2, county: 'england', city: 'london' } });
	const jane = () => ({ id: 3, name: 'Jane', address: { id: 4, county: 'spain', city: 'madrid' } });
	const data = [
		john(),
		john(),
		{ ...john(), surname: 'Doe' },
		jane(),
	]
	{
		const slowIdAttribute = (entity: any) => {
			console.log('slowIdAttribute', entity.id)
			return String(Math.pow(entity.id, 3))
		}
		const slowConvertion = (value: string) => {
			console.log('slowConvertion', value)
			return value?.toUpperCase()
		}
		const slowAddressProcessStrategy = (entity: any) => {
			console.log('address processed', entity.id)
			return {
				id: slowIdAttribute(entity),
				county: slowConvertion(entity.county), 
				city: slowConvertion(entity.city),
			}
		}
		const slowAddressMergeStrategy = (entityA: any, entityB: any) => {
			console.log('address merged', entityA.id)
			return Object.assign(entityA, entityB)
		}
		const slowUserProcessStrategy = (entity: any) => {
			console.log('address processed', entity.id)
			return {
				id: slowIdAttribute(entity),
				name: slowConvertion(entity.name), 
				surname: slowConvertion(entity.surname),
				address: entity.address,
			}
		}
		const slowUserMergeStrategy = (entityA: any, entityB: any) => {
			console.log('user merged', entityA.id)
			return Object.assign(entityA, entityB)
		}
		const addressSchema = new schema.Entity('address', {}, {
			idAttribute: slowIdAttribute,
			processStrategy: slowAddressProcessStrategy,
			mergeStrategy: slowAddressMergeStrategy,
		})
		const userSchema: [Schema] = [
			new schema.Entity('user', { address: addressSchema }, {
				idAttribute: slowIdAttribute,
				processStrategy: slowUserProcessStrategy,
				mergeStrategy: slowUserMergeStrategy,
			})
		]

		{
			const normalizedData = normalize(data, userSchema)
			console.log(JSON.stringify(normalizedData))
		}
	}
	{
		const slowIdAttribute = (entity: any) => {
			console.log('slowIdAttribute', entity.id)
			return String(Math.pow(entity.id, 3))
		}
		const slowConvertion = (value: string) => {
			console.log('slowConvertion', value)
			return value?.toUpperCase()
		}
		const fastAddressProcessStrategy = (entity: any, _parent: any, _keyInParent: any, _existingEntity: any, id: any) => {
			console.log('lightweigth address processing', entity.id)
			return {
				id,
				county: slowConvertion(entity.county), 
				city: slowConvertion(entity.city),
			}
		}
		const fastUserProcessStrategy = (entity: any, _parent: any, _keyInParent: any, existingEntity: any, id: any) => {
			console.log('lightweigth user processing', entity.id)
			const user = existingEntity || { id, address: entity.address }
			if( entity.name !== undefined ) user.name = slowConvertion(entity.name)
			if( entity.surname !== undefined ) user.surname = slowConvertion(entity.surname)
			return user
		}
		const noopUserMergeStrategy = (entityA: any) => {
			return entityA
		}
		const addressSchema = new schema.Entity('address', {}, {
			idAttribute: slowIdAttribute,
			processStrategy: fastAddressProcessStrategy,
			mergeStrategy: strategy.noMerge,
		})
		const userSchema: [Schema] = [
			new schema.Entity('user', { address: addressSchema }, {
				idAttribute: slowIdAttribute,
				processStrategy: fastUserProcessStrategy,
				mergeStrategy: noopUserMergeStrategy,
			})
		]

		const john = () => ({ id: 1, name: 'John', address: { id: 2, county: 'england', city: 'london' } });
		const jane = () => ({ id: 3, name: 'Jane', address: { id: 4, county: 'spain', city: 'madrid' } });

		{
			const normalizedData = normalize([
				john(),
				john(),
				{ ...john(), surname: 'Doe' },
				jane(),
			], userSchema)
			console.log(JSON.stringify(normalizedData))
		}
	}
}
// test()
//*/
