## What this is

The plugin model: `plugin.schema.json`, the one schema every `plugin.json` is written against and
every implementation validates against, whichever application the plugin targets, and
`INVARIANTS.md`, the twelve properties every implementation holds whatever its language.

**It lives outside every implementation on purpose.** An implementation that holds the vocabulary
defines it, and every other language then reads that implementation's output rather than a neutral
artefact. Nothing generates this file: it is edited by hand, and each implementation is held to it by
its own tests.

## Layout

- `plugin.schema.json`: the schema, as draft-07, published at
  `https://weivel.github.io/model/plugin.schema.json`, which is also its `$id`.
- `library.schema.json`: the schema, as draft-07, that a C library's `library.json` is written against,
  published at `https://weivel.github.io/model/library.schema.json`. It names the binary to load, the
  symbol that frees a returned buffer, and the services whose JSON functions plugins call; both
  implementations load a declaration and validate it against this file. A function may declare
  `context`, the facts of the calling process it reads (any of `environment`, `home` and
  `arguments`), which the host then sends beside the argument.
- `plugin.schema.json`'s `definitions`, each named so a library declaration's `$ref` to it maps to
  the contract type of the same name, except `appDeclaration`, which has none:
  - `appDeclaration`: an app as a manifest's `app` declares it, carrying only what the app's
    project knows.
  - `appDescriptor`: an app as a reader resolves it, the declaration with every default it omits
    filled in, which is the contract's `AppDescriptor`.
  - `appHome`: where an app keeps its home directory, one shape in a declaration and resolved.
  - `appDetect`: how to tell whether an app is installed, resolved, so both fields are present.
  - `appLoader`: the plugin an app is reached through, one shape in a declaration and resolved.
  - `appPathNames`: the names of an app home's storage subdirectories, resolved, so all four are
    present.
  - `appUsage`: the session-storage formats an app writes, one shape in a declaration and resolved.
  - `appNpmPlugins`: an app's own npm-plugin mechanism, one shape in a declaration and resolved.
  - `appStartupHook`: how an app runs a plugin at startup, resolved, so its entry template may be
    any JSON value where a declaration requires an object.
  - `appDiscovery`: where a marketplace looks for an app's community plugins, one shape in a
    declaration and resolved.
  - `appProjects`: where an app records the projects a user worked in, one shape in a declaration
    and resolved.
  - `appModelCatalog`: the app config file a model catalog is merged into, one shape in a
    declaration and resolved.
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
