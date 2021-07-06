import { normalize, overrideDefaultsDuringMigration, schema } from './index.js'
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
