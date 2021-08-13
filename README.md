# Reason - **performance**.

In real cases in a big higload project. I've seen performance boost from **x1.5** to **x10**.
In your cases you can see any boost from +0% to... Infinity. Because, as it always the case with optimizations, they are heavily depend on your data.
<sup>And because normalizr from version 3.0.1 up to at least version 3.6.0 has `O(N^2)` complexity, due to newly added support for circular graphs.</sup>
Read along.

# Compatibility

Branched from
Original docs can be found here. API is mostly compatibale with two exeptions:

1.  No support for _Immutable.js_.

	Sorry about that.

	Most of the time you whould and I think that you should normalize data from the Net, which is `POJO`s from `JSON` and not `Immutable`. I don't think that for the needs of a handfull few the majority should suffer. So I ditched it. Maybe, I was wrong. Because in the majority of real life cases the performance boost from this decision is negligable. But this is how it is at the moment.

1.  The support for circular graphs normalization if **_off_** by default.

	This is for the same reasons as in the previouse case.

	But accually, I've fixed the `O(N^2)` complexity issue of the original. Never the less, I see no reason why this feature shouldn't be _off_ by default.

	To turn it on you need to call `normilize()` with the third argument set to `true`:
	```js
	... = normilize(data, schema, true)
	```

# Optimization opportunities

Consider this example
```js
```

What can we do to speed it up?

1.  Optimize _normalizr_ itself.

	Ok, I've done it already. Not finished yet, but on some **synthetic** tests I've doubled the speed.

	In real life, just by replacing _normalizr_ with _normalizr-ex_ I've achived a boost sligtly above... zero. Because 99.(9)% of the time CPU was spent inside of `processStrategy()`, `mergeStrategy()` or `idAttribute()` functions. And let's be frank, in most cases, if it's so happened that you get your data from some source in a format that is not quite suitable for your needs, that probably means that you're interested not only in pure normalization of data, but in some sort of **transformations**. And probably you'd have a lot of whose.

	But if your data contains a lot of dublicates of small object and you don't do a lot of transformations during "normalization", then you can save some CPU just by switching from _normalizr_ to _normalizr-ex_ in your `package.json`.

1.  Use `strategy.noMerge`.

	As we can see, `user`s with the same `id` are identical, there is no need for `mergeStrategy`. By default _normalizr_ uses `(entityA, entityB) => ({ ...entityA, ...entityB })`. We can use `(entityA) => entityA` instead. That'd save as some copies.

	But `strategy.noMerge` is more than that! If you know that entities of some key with the same `id` are identical, you can skip not only the merge part, but the `mergeStrategy()` **and** the `processStrategy()` all together! You can call `processStrategy()` only once!

1.	Ditch `mergeStrategy()` in favour of `existingEntity` argument in the `processStrategy()`.

	Even if you need to merge entities there is one more possibility for optimization. There can be several slow transformation inside of a `processStrategy()`, but most of the time you don't need to repeat them.

	Also if you unite proccess and merge steps in one, there're usually more posibilities for optimization.

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
	Sometimes, `idAttribute()` can be surprisingly heavy - like `hash(JSON.stringify(entity))`. Obviously, that's not a great idea, but if you can't fix this right away, at least you shouldn't call such a function twice. Which can be achived with the help of new argument `id`, that is now passed in `processStrategy()`
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
	If you merge with `existingEntity`, don't create new object in every `processStrategy` - reuse `existingEntity` by mutating it

	And if you can, consider **inplace** normalization.

	I was unable to try it yet, because denormalized data in the project I'm working on still used after normalization in some places, so I can't mutate it. But if you can - you'll save not only some CPU due to less coping, but also some memory and some CPU for GC. But you probably should remember about 

1.  `overrideDefaultsDuringMigration()`.




The main point of difference from the original - performance. And the main turning point - default strategies. People in large teams tend not to think about redundant copies. But the difference in performance is huge. There's also some other minute differenes (to be described), but they should not be a problem.


There's one extra function: `newSchema = overrideDefaultsDuringMigration(schema)`. It's very important. It create a deep copy of `schema` and changed `mergeStrategy` to `(entityA, _entityB) => entityA` and `processStrategy` to `input => input` in all elements where these options haven't been set explicitly.


оригинальная документация может быть найдена здесь
я ветвился от 3.6.0
Основной фокус на оптимизации.
API имеет некоторые отличия, но по большей части совместимо.
Changes:
	-   нормализация циклических графов по умолчанию выключена. По тем же причинам что и в случае с Immutable.js - это недавнее дополнение к normalize 3.6.0, т.е много лет больнству людей эта фича не требовалась, а теперь она есть, но приводит к сложности нормализации O(N^2). I'd argue that this is a breaking change and that at least the normilizer should've been bumped to version 4.
		На самом деле я избавился от O(N^2) за счет изменения кеша (Set вместо массивов), но все равно не вижу причин почему эта фича не должны быть по умолчанию отключена.
	-   оптимизированный код. на некоторых из моих синтерических примерах ускорение x2. Я мог бы придумать и более впечатляющие синтетические примере, но дело в том что в реальном проекте ускорение от простой замены normalizr на normalirz-ex было близко к нулю.
		тем не менее вы сможете его заметить если вам требуется нормализовать данные с большим количеством мелких дублирующихся объектов, без особо сложной их обработки в processStrategy и mergeStrategy и idAttribute
	-   noMerge
		```
		new Entity('user', {}, {
			mergeStrategy: noMerge
		})
		```
		is not the same as
		```
		new Entity('user', {}, {
			mergeStrategy: x => x
		})
		```
		Использование этой фичи приводило к ускорению реального кода на 20% а иногда и 40%. Но это не было бесплатно. Это довольно опасная фича которую надо аккуратно тестировать.
	-   existingEntity
		```
		processStrategy: (entity, _parent, _keyInParent, existingEntity)
		```
		возволяет отказаться от mergeStrategy в 99% случаев
		я могу пока придумать только один реально необходимый случай - когда вам надо выполнить мерж _после нормализации_ и единственный вариант который приходит в голову (и то только потому что я его видел в реальном коде): мерж массивов id
	-   id
		idAttribute может быть на удивление тяжелой функцией. В старом нормалайзе, если вы вычисляете id и хотите его сохранить в entity вам пришлось бы делать подобное
		idAttribute,
		processStrategy: (entity) {
			return {
				id: idAttribute(entity)
				...
			}
		}
		но idAttribute уже вычислен однажды внутри нормалайзера и чтобы не считать его повторно вы теперь можете написатт
		```
		idAttribute,
		processStrategy: (entity, _parent, _keyInParent, _existingEntity, id) {
			return {
				id,
				...
			}
		}
		```
	-   
	-   TODO: контекст. допустим вы внутри idAttribute вызываете какую-то тяжелую функцийю, и ее же вам надо вызвать внутри processStrategy, сам id вы можете получить в параметрах, но результат вызова тежулой функции вам придется либо кешироваться, либо страдать. После добавления контекстов результат можно будет сохранить в него. Есть и другие потенциальные применения для контекстов не связанные со скоростью.
	   


Давайте будем честны... маловероятно что вы испольузете normalizr именно и только для нормалиации. Если источник данных возвращает вам что-то не в том виде к котором вы хотите это видеть, но скорее всего вы захотите не только дубли убрать, но и поля переименовть, агрегаты посчитать и т.д. Все вместе это выливется в то что
	а)  основная работа выполняется не в нормалайзере, а в функициях написанных вами - в processStrategy, mergeStrategy и даже в idAttribute нередко встречаются тяжелые вычисления.
	а)  надо понимать что рпри использовании нормалайза речь идет скорее не о нормаиации, а о трансформации данных и понимание этого уже позволяет осознанней относиться к написанию кода и писать более оптимальную "нормализацию" (извините... **трансформацию**)
	в)  без дополнительных вложений вы заметите разницу в производительности с оригинальным нормалайзом только в 2х случаях
		-   ваши трансформации просты, а дублирующихся данных много
		-   ваши дубли - полные дубли (вам почти никогда не требуется mergeStrategy) и вы можете можете себе позволить воспользоваться overrideDefaultsDuringMigration

я не просто так делал clone - если его не делать данные нормализуются inplace,