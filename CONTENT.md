## What this is

The plugin model: `plugin.schema.json`, the one schema every `plugin.json` is written against and
every implementation validates against, whichever application the plugin targets, and
`INVARIANTS.md`, the thirteen properties every implementation holds whatever its language.

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
- `install-method.schema.json`: the schema, as draft-07, of the answers an `install-method` provider
  returns, published at `https://weivel.github.io/model/install-method.schema.json`. Its definitions
  are `detectAnswer` and `operationAnswer`.
- Fields a host or a listing declares about how it is installed, all optional:
  - `kind`: `plugin` or `host`, absent meaning `plugin`. A loader is a host.
  - `packages`: the package under each install method, `{ "<method>": "<name>" | { "name", "options"? } }`.
  - `methods`: the install method ids the listing supports.
  - `installMethod`: the one method a listing is a provider for, when it is an `install-method`
    provider (below). A catalog and an install planner match a provider by exactly this field.
  - `pathCommands`: `{ "requested": [string], "minimum": 0 | 1 }`, the executables a host puts on the
    user's PATH, each name one portable file name (`^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`, the rule
    the runtime's `commands` service applies). Not `commands`, which stays the array of
    in-application slash commands.
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

## Settings, actions and views

A plugin describes what a user can change, do and see as data, and a host draws it. The manifest
never draws: it names roles, and each host maps a role to its own look.

- `settings`: keyed by setting key, each `{ type, label, help?, default?, layer?, choices?, minimum?,
  maximum?, pattern? }`. `choices` is required for `choice` and `multi-choice`.
- `actions`: keyed by action id, each `{ label, call, confirm?, input?, tone? }`, where `call` is
  `{ service, method, argument? }` into one of the plugin's own services.
- `views`: keyed by view id, each `{ title, nodes }`. The nodes are a flat list and each names its
  `parent`, because a flat list diffs, validates and streams without a recursive schema; a parent
  must come earlier in the list, which keeps it a tree.
- Every role property (`component`, `size`, `emphasis`, `tone`, `chart`) is an enum, so a raw colour
  or a pixel size is refused. A property the schema does not name is ignored, as everywhere else.
- Keys and ids start with a lowercase letter and continue with letters and digits. A plugin id may
  not be a Windows reserved name (`con`, `prn`, `aux`, `nul`, `com1` to `com9`, `lpt1` to `lpt9`).

## The `install-method` service

The contract every package-manager provider (npm, Homebrew, winget, apt, and any other) implements,
registered as the service id `install-method` by a listing whose manifest names the method it serves
in `installMethod`. A provider holds no list of packages: which package an item is under a method is
the item's `packages` data, so a new package never needs a new provider.

The answers are described by `install-method.schema.json`. Strings and JSON only, so a provider
written in any language, or reached over a wire protocol, can implement it. A package is the method's
own name for it (`"@scope/tool"`, `"git"`), and `options` is the optional object a `packages` entry
carried, which only that provider reads.

- `detect(package, options?)` answers `{ "installed": boolean, "version"?: string }`. A package that is
  not installed is `installed: false`, not a refusal.
- `install(package, options?)`, `update(package, options?)` and `remove(package, options?)` each answer
  success, or a refusal carrying a detail and a fix.

A refusal is data, not an exception (invariant 1): an unreachable registry, a missing privilege or an
unknown package comes back as a refusal value the caller shows, never as a thrown error. Every
operation is idempotent: installing what is installed, or removing what is absent, succeeds.
