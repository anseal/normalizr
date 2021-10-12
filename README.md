# Reason - **performance**.

In real cases in a big highload project, I've seen performance boost from **x1.5** to **x10**.
In your cases you can see any boost from +0% to... Infinity. Because, as it is always the case with optimizations, they heavily depend on your data.
<sup>And because _normalizr_ from version 3.4.0 up to at least version 3.6.0 has `O(N^2)` complexity, due to added support for circular graphs.</sup>

# Compatibility

Branched from ???
Original docs can be found [here](???). API is mostly compatible with two exeptions:

1.  No support for _Immutable.js_.

	Sorry about that.

	Most of the time you whould, and I think that you should, normalize data from the Net, which is `POJO`s from `JSON` and not `Immutable`s. I don't think that for the needs of the few the majority should suffer. So I ditched it. Maybe, I was wrong. Because in the majority of real life cases the performance boost from this decision is negligible. But this is the way it is at the moment.

1.  The support for circular graphs normalization is **_off_** by default.

	This is for the same reasons as in the previous case.

	But actually, I've fixed the `O(N^2)` complexity issue of the original. Nevertheless, I see no reason why this feature shouldn't be _off_ by default. And see at least one why it should - circular dependency can be a sign of an error in the data.

	To turn it on, you need to call `normilize()` with the third argument set to `true`:
	```js
	... = normilize(data, schema, true)
	```

# Optimization opportunities

Consider this example
```js
???
```

What can we do to speed it up?

1.  Optimize _normalizr_ itself.

	Ok, I've done it already. Not finished yet, but on some **synthetic** tests I've doubled the speed.

	In real life, just by replacing _normalizr_ with _normalizr-ex_ I've achived a boost sligtly above... zero. Because 99.(9)% of the time CPU spent inside of `processStrategy()`, `mergeStrategy()` or `idAttribute()` functions. And let's be frank, in most cases, if you get your data from some source in a format that is not quite suitable for your needs, that probably means that you're interested not only in pure normalization of data, but in some sort of **transformations**. And probably you'd have a lot of them.

	But if your data contains a lot of duplicates of small objects and you don't do a lot of heavy transformations during "normalization", then you can save some CPU just by switching from _normalizr_ to _normalizr-ex_ in your `package.json`.

1.  Use `strategy.noMerge`.

	As we can see, `user`s with the same `id` are identical, there is no need for `mergeStrategy`. By default _normalizr_ uses `(entityA, entityB) => ({ ...entityA, ...entityB })`. We can use `(entityA) => entityA` instead. That saves you some copies.

	But `strategy.noMerge` is more than that! If you know that entities of some key with the same `id` are identical, you can skip not only the merge part, but the `mergeStrategy()` **and** the `processStrategy()` all together! `processStrategy()` will be called only once!

1.	Ditch `mergeStrategy()` in favour of `existingEntity` argument in the `processStrategy()`.

	Even if you need to merge entities there is a possibility for optimization. There can be several slow transformations inside of a `processStrategy()`, but most of the time you don't need to repeat them.

	Also, if you unite proccess and merge steps in one, there's a chance that you'll find more posibilities for optimization.

1.  `idAttribute()`.

	I've seen this pattern a lot:
	```js
	new schema.Entity('user', { address: addressSchema }, {
		idAttribute: slowIdAttribute,
		processStrategy: (entity) => {
			return {
				id: slowIdAttribute(entity), // second call of `slowIdAttribute()`
				...
			}
		},
	})
	```
	Sometimes, `idAttribute()` can be surprisingly heavy - like `hash(JSON.stringify(entity))`. Obviously, that's not a great idea, but if you can't fix this right away, at least you shouldn't call such a function twice. Which can be achieved with the help of the new argument `id`, that is now passed in `processStrategy()`
	```js
	new schema.Entity('user', { address: addressSchema }, {
		idAttribute: slowIdAttribute,
		processStrategy: (entity, _parent, _keyInParent, _existingEntity, id) => {
			return {
				id,
				...
			}
		},
	})
	```

1.	Copy less.

	If you merge with `mergeStrategy`, don't do things like 
	```js
	mergeStrategy(entityA, entityB) => {
		return {
			...entityA,
			...entityB,
			someIds: uniqueValues(entityA.someIds, entityB.someIds),
		}
	}
	```
	Do
	```js
	mergeStrategy(entityA, entityB) => {
		entityA.someIds = uniqueValues(entityA.someIds, entityB.someIds)
		return entityA
	}
	```
	instead.
	If you merge with `existingEntity`, don't create new object in every `processStrategy` - reuse `existingEntity` by mutating it.

	And if you can, consider **inplace** normalization.

	I was unable to try it yet, because denormalized data in the project I'm working on is still used after normalization in some places, so I can't mutate it. But if you can - you'll save not only some CPU on copy process, but also some memory and some CPU during GC. But you probably should remember about object shapes to be sure that mutations are truly faster.

1.  `overrideDefaultsDuringMigration()`.

	The default strategies used in the original were probably choosen to be "safe", and to work in any circumstances. But this is a recipe for performance disaster.
	Defaults are:
	```js
	processStrategy = (entity) => ({ ...entity })
	mergeStrategy = (entityA, entityB) => ({ ...entityA, ...entityB })
	```
	that means that entities are always copied thrice, even if there is no need for that, even, if there are hundrends of them. And of course there is no consept of `noMerge`.
	With
	```js
	const schemaWithNewStratagies = overrideDefaultsDuringMigration(oldSchema)
	```
	you can create a new deep copy of the `oldSchema` where for `oldSchema` and it's children all `mergeStrategy`s are set to `noMerge` and all `processStrategy`s are set to `x => x`, if they were not set explicitly.

	If you are not ready to try the "inplace" normalization you can call it like this
	```js
	const schemaWithNewStratagies = overrideDefaultsDuringMigration(oldSchema, {
		processStrategy = (entity) => ({ ...entity })
	})
	```
	this way you effectively do not switch the original's default `processStrategy`.

# Dangers of `overrideDefaultsDuringMigration()`.

1.	You can forget that some type of entity needs a merge. Or you can be mistaken about the fact that it doesn't.

1.	You can write `processStrategy` with the use of `existingEntity`, but without `mergeStrategy: x => x`, and the `processStrategy` will be called only once, rendering `existingEntity` usage useless and erroneous.

	I'll try to aleviate this common source of errors. But this is how it is at the moment.

1.	Children of an entity that is not merged will not be merged either, even if they have some non-default `mergeStrategy`.
	So you'll need explicitly set `mergeStrategy` to `x => x` in each of it's parents, and use `if( existingEntity ) return existingEntity` in them too, if you want them to be called only once.

	I'll try to aleviate this, much less common, source of errors too. But again - this is how it works now.






	-   
	-   TODO: контекст. допустим вы внутри idAttribute вызываете какую-то тяжелую функцийю, и ее же вам надо вызвать внутри processStrategy, сам id вы можете получить в параметрах, но результат вызова тежулой функции вам придется либо кешироваться, либо страдать. После добавления контекстов результат можно будет сохранить в него. Есть и другие потенциальные применения для контекстов не связанные со скоростью.
	   


Давайте будем честны... маловероятно что вы испольузете normalizr именно и только для нормалиации. Если источник данных возвращает вам что-то не в том виде к котором вы хотите это видеть, но скорее всего вы захотите не только дубли убрать, но и поля переименовть, агрегаты посчитать и т.д. Все вместе это выливется в то что
	а)  основная работа выполняется не в нормалайзере, а в функициях написанных вами - в processStrategy, mergeStrategy и даже в idAttribute нередко встречаются тяжелые вычисления.
	а)  надо понимать что рпри использовании нормалайза речь идет скорее не о нормаиации, а о трансформации данных и понимание этого уже позволяет осознанней относиться к написанию кода и писать более оптимальную "нормализацию" (извините... **трансформацию**)
	в)  без дополнительных вложений вы заметите разницу в производительности с оригинальным нормалайзом только в 2х случаях
		-   ваши трансформации просты, а дублирующихся данных много
		-   ваши дубли - полные дубли (вам почти никогда не требуется mergeStrategy) и вы можете можете себе позволить воспользоваться overrideDefaultsDuringMigration

я не просто так делал clone - если его не делать данные нормализуются inplace,