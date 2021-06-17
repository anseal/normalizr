The main point of difference from the original - performance. And the main turning point - default strategies. People in large teams tend not to think about redundant copies. But the difference in performance is huge. There's also some other minute differenes (to be described), but they should not be a problem.

API is the same as in the original, but at the moment there's no guaranty that it wouldn't change.

There's one extra function: `newSchema = overrideDefaultsDuringMigration(schema)`. It's very important. It create a deep copy of `schema` and changed `mergeStrategy` to `(entityA, _entityB) => entityA` and `processStrategy` to `input => input` in all elements where these options haven't been set explicitly.
