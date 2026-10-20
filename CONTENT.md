## What this is

The plugin model: `plugin.schema.json`, the one schema every `plugin.json` is written against and
every implementation validates against, whichever application the plugin targets, and
`INVARIANTS.md`, the eleven properties every implementation holds whatever its language.

**It lives outside every implementation on purpose.** An implementation that holds the vocabulary
defines it, and every other language then reads that implementation's output rather than a neutral
artefact. Nothing generates this file: it is edited by hand, and each implementation is held to it by
its own tests.

## Layout

- `plugin.schema.json`: the schema, as draft-07, published at
  `https://weivel.github.io/model/plugin.schema.json`, which is also its `$id`.
- `INVARIANTS.md`: what an implementation does with a manifest, each with the reason it exists.
  Binding specifications render them per language and the conformance suite tests them.
- `VALIDATION.md`: the two rules a validator applies after the schema, because draft-07 cannot
  express them: one service listed in two forms, and a bare service id the host does not list.
- `test/`: compiles the schema strictly, so a misspelt keyword fails here rather than being ignored
  downstream. `fix` is the one keyword of its own: the hint an implementation prints beside a
  violation.

## Changing the vocabulary

Edit `plugin.schema.json`, then make each implementation match it. `weivel/java` checks out this
repository beside itself and fails its build while its validator disagrees with the file.

The schema is open: a field it does not name validates and is ignored, which is what lets a manifest
written for a newer host load on an older one.
