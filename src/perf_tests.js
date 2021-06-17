import { normalize, overrideDefaultsDuringMigration, schema } from './index.js'

const randomInRange = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const repeat = (cnt, fn) => {
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

const test = () => {
	console.log('!!!!!!!!!!!!!!')
	// const article_ = article
	const article_ = overrideDefaultsDuringMigration(article)
	const start = performance.now()
	const normalizedData = normalize(originalData, article_)
	const duration = performance.now() - start
	console.log(
		duration
		// JSON.stringify(normalizedData,undefined,'\t')
	)
}
document.getElementById('run').addEventListener('click', test)
//*/
