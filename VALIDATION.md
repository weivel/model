# The rules a validator applies beyond the schema

`plugin.schema.json` carries every rule draft-07 can express. These two cannot be expressed there, so
every implementation applies them after the schema passes, and the conformance kit's `validate`
vectors hold each implementation to them. Like the schema, they are this repository's and no
implementation's: an implementation that disagrees with them is the defect.

Each rule names the path a refusal reports and the `fix` it carries, because a refusal is data
(invariant 1) and an author reads the fix.

## V1. A service is listed at most once on each side

A service id appears at most once in `services.provides` and at most once in `services.consumes`.
An entry is either the id as a string or an object carrying `id`, and **the two forms name the same
service**, so `["a:x", { "id": "a:x" }]` lists `a:x` twice.

- **Why it is not in the schema:** the arrays mix strings and objects, and `uniqueItems` compares
  whole items, so it cannot see that a string and an object carry the same id.
- **Refusal:** the path of the second occurrence, for example `services.provides[1]`, with the fix
  `remove the duplicate entry`.

## V2. A bare service id is one the host lists as well-known

An id in `services.provides` is legal when the host lists it as well-known, or when it is namespaced
by the registering plugin's own id: `<plugin id>:<name>`, both parts non-empty. Anything else is
refused. This is what makes squatting on another plugin's namespace structurally impossible rather
than socially discouraged.

- **Why it is not in the schema:** the well-known list is the HOST's, supplied at validation time,
  so the same manifest can be legal on one host and refused on another.
- **When it is skipped:** a validator given no well-known list does not apply V2. An empty list is
  a list, and refuses every bare id.
- **Refusal:** the path of the offending entry, for example `services.provides[0]`, with a fix that
  names the namespaced form, `<plugin id>:<name>`, and the host's well-known ids.
