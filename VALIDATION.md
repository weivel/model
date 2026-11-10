# The rules a validator applies beyond the schema

`plugin.schema.json` carries every rule draft-07 can express. These three cannot be expressed there, so
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
by the registering plugin's own `importName`: `<importName>:<name>`, both parts non-empty. Anything
else is refused.

**This no longer stops another plugin claiming the namespace.** An `importName` is chosen by the
plugin and nothing makes it unique, so two plugins can both be legal under `a:x`. What decides which
one a consumer reaches is `provider` on its `services.consumes` entry, which names the providing
repository's identity.

- **Why it is not in the schema:** the well-known list is the HOST's, supplied at validation time,
  so the same manifest can be legal on one host and refused on another.
- **When it is skipped:** a validator given no well-known list does not apply V2. An empty list is
  a list, and refuses every bare id.
- **Refusal:** the path of the offending entry, for example `services.provides[0]`, with a fix that
  names the namespaced form, `<importName>:<name>`, and the host's well-known ids.

## V3. Every reference in a description resolves

The schema types `parent`, `action`, `field` and a binding's `service` as plain strings, because
which strings are legal depends on the rest of the manifest. Resolving them is this rule's job. It
applies to `views` and `actions` and is checked only when the schema passed, so every path below
exists and has the shape the schema gave it. A manifest with `views` and no `settings` or `actions`
is not a crash: an absent `settings` or `actions` is an empty set, so a `field` or `action`
reference then names nothing and is refused. An absent `services` or `services.provides` is likewise
an empty set, so every binding is refused.

- **A node `id` is unique within its view.** Every node after the first that carries a given
  `id` is reported, the second, third and later occurrences, each at its own `.id` path. Fix: `give each node in a view its own id`. Path: `views.<view>.nodes[<i>].id`.
- **A `parent` names an EARLIER node of the same view.** A `parent` resolves when ANY node at a
  lower index in the same view carries that id, so a duplicated id with one earlier occurrence
  resolves. A `parent` that names the node itself, only later nodes, or no node at all is refused. This is what guarantees the flat node list is a tree with no
  cycle. Fix: `name the id of a node listed before this one`. Path: `views.<view>.nodes[<i>].parent`.
- **An `action` names a key of `actions`.** Fix: `name one of this manifest's actions`. Path:
  `views.<view>.nodes[<i>].action`.
- **A `field` names a key of `settings`.** Fix: `name one of this manifest's settings`. Path:
  `views.<view>.nodes[<i>].field`.
- **A binding's `service` is one this plugin provides.** This covers `actions.<a>.call` and a node's
  `bind`. A service is in `services.provides` in either form (the string or the object carrying
  `id`); a service the plugin only consumes does not count, because a host calls only into the
  plugin's own services. Fix: `bind to a service this plugin provides`. Path:
  `actions.<a>.call.service` or `views.<view>.nodes[<i>].bind.service`.

- **Why it is not in the schema:** each check compares one part of the manifest with another (a
  node with its siblings, a node with the keys of `settings`, a binding with `services.provides`),
  and draft-07 cannot refer from one value to the keys or entries of another.
- **Order:** actions in key order first, then views in key order, nodes by index. Key order is the
  order the keys appear in the manifest document. Within one node the order is `id`, `parent`,
  `action`, `field`, `bind`. Within one action only `call.service` can be reported.
- **Refusal:** the path named beside each check, with the fix beside it.
