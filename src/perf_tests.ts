import { normalize, overrideDefaultsDuringMigration, schema } from './index.js'

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

function cloneWithJSON(data: any): any {
	return JSON.parse(JSON.stringify(data))
}
function deepEqualWithJSON(data1: any, data2: any): boolean {
	return JSON.stringify(data1) === JSON.stringify(data2)
}

function clone(data: any): any {
	if( Array.isArray(data) ) {
		return data.map(clone) as any
	}
	if( typeof data === 'object' ) {
		if( data === null ) {
			return null
		}

		const copy: any = {}
		for(const key in data) {
			copy[key] = clone(data[key])
		}
		return copy as any
	}
	return data
}

function deepEqualSameShape(data1: any, data2: any): boolean {
	if( Array.isArray(data1) ) {
		if( Array.isArray(data2) === false ) {
			return false
		}
		if( data1.length !== data2.length ) {
			return false
		}
		for( let i = 0 ; i !== data1.length ; ++i ) {
			if( deepEqualSameShape(data1[i], data2[i]) === false ) {
				return false
			}
		}
		return true
	}
	if( typeof data1 === 'object' ) {
		if( typeof data2 !== 'object' ) {
			return false
		}
		if( data1 === null ) {
			if( data2 !== null ) {
				return false
			}
			return true
		}

		const keys1 = Object.keys(data1)
		const keys2 = Object.keys(data2)
		if( keys1.length !== keys2.length ) return false
		for( let i = 0 ; i !== keys1.length ; ++i ) {
			if( keys1[i] !== keys2[i] ) {
				return false
			}
		}
		for(const key of keys1) {
			if( deepEqualSameShape(data1[key], data2[key]) === false ) {
				return false
			}
		}
		return true
	}
	return data1 === data2 || Number.isNaN(data1) === Number.isNaN(data2)
}

export const test = (performance: { now: () => number }) => {
	const data = clone(originalData)
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
