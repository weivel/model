import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Ajv } from "ajv";
import { describe, expect, it } from "vitest";

const SCHEMA_URL = "https://weivel.github.io/model/plugin.schema.json";

const schema = JSON.parse(readFileSync(fileURLToPath(new URL("../plugin.schema.json", import.meta.url)), "utf8"));

/**
 * @implNote Strict, so a misspelt keyword fails here instead of being silently ignored by every
 * validator downstream. `fix` is the one keyword of this vocabulary's own: the hint an implementation
 * prints beside a violation, which carries no validation meaning.
 */
function compile() {
  return strictAjv().compile(schema);
}

function strictAjv() {
  const ajv = new Ajv({ strict: true, allErrors: true });
  ajv.addKeyword({ keyword: "fix", schemaType: "string" });
  return ajv.addSchema(schema);
}

function definition(name: string) {
  return strictAjv().getSchema(`${SCHEMA_URL}#/definitions/${name}`)!;
}

const RESOLVED_ALPHA = {
  id: "alpha",
  label: "Alpha CLI",
  home: { envOverride: "HUB_ALPHA_DIR", nativeEnv: "ALPHA_CONFIG_DIR", candidates: ["~/.alpha", "~/.config/alpha"] },
  detect: { binary: "alpha", pkg: "alpha-cli" },
  loader: { id: "alpha-loader", url: "acme-org/alpha-loader" },
  commandsSubdir: "commands",
  paths: { repos: "repos", plugin: "plugin", cache: "cache", config: "config" },
  proxyPort: 40001,
  integration: "env-baseurl",
  wireFormat: "anthropic",
  usage: { formats: ["alpha-jsonl"] },
};

describe("plugin.schema.json", () => {
  it("compiles as a strict draft-07 schema", () => {
    expect(() => compile()).not.toThrow();
  });

  it("is identified by the URL it is published at", () => {
    expect(schema.$id).toBe(SCHEMA_URL);
  });

  it("refuses capabilities without an entry", () => {
    const validate = compile();
    expect(validate({ importName: "a", api: 1, capabilities: ["provider"] })).toBe(false);
    expect(validate({ importName: "a", api: 1, capabilities: ["provider"], entry: "dist/index.js" })).toBe(true);
    expect(validate({ importName: "a", api: 1, capabilities: [] })).toBe(true);
  });

  it("refuses an entry outside the repo", () => {
    const validate = compile();
    for (const entry of ["/abs/x.js", "\\abs\\x.js", "C:/x.js", "../x.js", "dist/../../x.js", "dist\\..\\x.js"]) {
      expect(validate({ importName: "a", api: 1, entry }), entry).toBe(false);
    }
    for (const entry of ["dist/index.js", "dist/..x/index.js"]) {
      expect(validate({ importName: "a", api: 1, entry }), entry).toBe(true);
    }
  });

  it("refuses an entry that hides an escape behind a line break or a control character", () => {
    const validate = compile();
    for (const entry of ["a\n/../../x.js", "a/..\n", "a\u0085/../x.js", "a\u2028/../x.js", "dist/index\u0000.js"]) {
      expect(validate({ importName: "a", api: 1, entry }), JSON.stringify(entry)).toBe(false);
    }
  });

  it("refuses a duplicate capability or permission", () => {
    const validate = compile();
    expect(validate({ importName: "a", api: 1, entry: "dist/index.js", capabilities: ["a", "a"] })).toBe(false);
    expect(validate({ importName: "a", api: 1, permissions: ["net", "net"] })).toBe(false);
  });

  it("accepts a minimal manifest and refuses an id that is not kebab case", () => {
    const validate = compile();
    expect(validate({ importName: "config-ledger", api: 1 })).toBe(true);
    expect(validate({ importName: "Config_Ledger", api: 1 })).toBe(false);
  });

  it("requires an importName", () => {
    const validate = compile();
    expect(validate({ api: 1 })).toBe(false);
    expect(validate.errors).toContainEqual(expect.objectContaining({ keyword: "required", params: { missingProperty: "importName" } }));
  });

  it("accepts a dotted importName", () => {
    expect(compile()({ importName: "api.http", api: 1 })).toBe(true);
  });

  it("refuses an uppercase importName", () => {
    expect(compile()({ importName: "Api", api: 1 })).toBe(false);
  });

  it("ignores a stated id", () => {
    expect(compile()({ importName: "a", api: 2, id: "b" })).toBe(true);
  });

  const consumingProvider = (provider: string) => ({ importName: "a", api: 1, services: { consumes: [{ id: "x:y", provider }] } });

  it("accepts a provider in the object form", () => {
    expect(compile()(consumingProvider("github:123"))).toBe(true);
  });

  it("accepts a self-hosted provider", () => {
    expect(compile()(consumingProvider("gitea@git.example.com:12/runtime"))).toBe(true);
  });

  it("refuses a provider that is not an id", () => {
    expect(compile()(consumingProvider("calendar"))).toBe(false);
  });

  it("refuses a provider with a trailing newline", () => {
    expect(compile()(consumingProvider("github:1\n"))).toBe(false);
  });

  it("refuses a provider with a dot segment", () => {
    expect(compile()(consumingProvider("github:1/.."))).toBe(false);
    expect(compile()(consumingProvider("github:1/a/../b"))).toBe(false);
    expect(compile()(consumingProvider("github:1/.hidden"))).toBe(true);
  });

  const withDependency = (dependency: object) => ({ importName: "a", api: 1, dependencies: [dependency] });

  it("accepts a dependency named by an id", () => {
    expect(compile()(withDependency({ importName: "runtime", id: "github:12/runtime" }))).toBe(true);
  });

  it("accepts a dependency named by a name, with a commit and a digest", () => {
    const dependency = { importName: "runtime", name: "spisor/runtime", commit: "abc", sha256: "def" };
    expect(compile()(withDependency(dependency))).toBe(true);
  });

  it("refuses a dependency that carries an id and a name", () => {
    const dependency = { importName: "runtime", id: "github:12/runtime", name: "spisor/runtime" };
    expect(compile()(withDependency(dependency))).toBe(false);
  });

  it("refuses a dependency that carries neither an id nor a name", () => {
    expect(compile()(withDependency({ importName: "runtime" }))).toBe(false);
  });

  it("refuses a dependency with no import name", () => {
    expect(compile()(withDependency({ id: "github:12/runtime" }))).toBe(false);
  });

  it("validates a manifest's app against appDeclaration", () => {
    expect(schema.properties.app).toEqual({ $ref: "#/definitions/appDeclaration" });
    const validate = compile();
    const declared = { id: "alpha", label: "Alpha CLI", home: { candidates: ["~/.alpha"] }, detect: { pkg: "alpha-cli" } };
    expect(validate({ importName: "a", api: 1, app: declared })).toBe(true);
    expect(definition("appDeclaration")(declared)).toBe(true);
    expect(validate({ importName: "a", api: 1, app: { id: "alpha", label: "Alpha CLI" } })).toBe(false);
  });

  it("publishes the resolved app descriptor", () => {
    const validate = definition("appDescriptor");
    expect(validate(RESOLVED_ALPHA)).toBe(true);
    const { commandsSubdir: _commandsSubdir, ...withoutCommandsSubdir } = RESOLVED_ALPHA;
    expect(validate(withoutCommandsSubdir)).toBe(false);
    expect(validate.errors?.map((error) => error.params)).toContainEqual({ missingProperty: "commandsSubdir" });
  });
});

describe("settings, actions and views", () => {
  const binding = { service: "demo:screens", method: "read" };
  const settings = {
    name: { type: "text", label: "Name" },
    token: { type: "secret", label: "Token" },
    retries: { type: "number", label: "Retries", minimum: 0, maximum: 9 },
    enabled: { type: "toggle", label: "Enabled", default: true },
    mode: { type: "choice", label: "Mode", choices: ["a", "b"] },
    modes: { type: "multi-choice", label: "Modes", choices: ["a", "b"], layer: "application" },
    folder: { type: "path", label: "Folder", layer: "portable" },
    names: { type: "list", label: "Names" },
    labels: { type: "key-value", label: "Labels", help: "Pairs.", pattern: "^x" },
  };
  const view = {
    title: "Screens",
    nodes: [
      { id: "main", component: "section", label: "Main", size: "large", emphasis: "high", tone: "accent" },
      { id: "rows", parent: "main", component: "table", bind: binding, span: 12 },
      { id: "go", parent: "main", component: "button", action: "refresh", icon: "arrow-right" },
    ],
  };
  const manifest = (extra: object) => ({ importName: "demo", api: 2, ...extra });
  const refusals = (body: object) => {
    const validate = compile();
    validate(body);
    return validate.errors ?? [];
  };
  const withNode = (node: object) => manifest({ views: { v: { title: "V", nodes: [node] } } });

  it("accepts settings, actions and a view", () => {
    const body = manifest({
      settings,
      actions: { refresh: { label: "Refresh", call: binding, confirm: "Sure?", tone: "danger", input: { why: settings.name } } },
      views: { screens: view },
    });
    expect(compile()(body)).toBe(true);
  });

  it("refuses a raw colour in tone", () => {
    expect(refusals(withNode({ id: "a", component: "text", tone: "#ff0000" }))).toContainEqual(
      expect.objectContaining({ keyword: "enum", instancePath: "/views/v/nodes/0/tone" }),
    );
  });

  it("refuses a pixel size", () => {
    expect(refusals(withNode({ id: "a", component: "text", size: "13px" }))).toContainEqual(
      expect.objectContaining({ keyword: "enum", instancePath: "/views/v/nodes/0/size" }),
    );
  });

  it("ignores an unknown node property", () => {
    expect(compile()(withNode({ id: "a", component: "text", color: "#f00" }))).toBe(true);
  });

  it("requires choices for a choice setting", () => {
    for (const type of ["choice", "multi-choice"]) {
      expect(refusals(manifest({ settings: { m: { type, label: "M" } } })), type).toContainEqual(
        expect.objectContaining({ keyword: "required", instancePath: "/settings/m", params: { missingProperty: "choices" } }),
      );
      expect(refusals(manifest({ settings: { m: { type, label: "M", choices: ["a"] } } })), type).toEqual([]);
    }
  });

  it("refuses a view with no nodes", () => {
    expect(refusals(manifest({ views: { v: { title: "V", nodes: [] } } }))).toContainEqual(
      expect.objectContaining({ keyword: "minItems", instancePath: "/views/v/nodes" }),
    );
  });

  it("refuses each Windows reserved import name", () => {
    for (const importName of ["con", "prn", "aux", "nul", "com1", "com9", "lpt1", "lpt9", "nul.x", "con.foo", "com1.a"]) {
      expect(refusals({ importName, api: 1 }), importName).toContainEqual(expect.objectContaining({ keyword: "pattern", instancePath: "/importName" }));
    }
    for (const importName of ["con-tools", "console", "com10", "console.foo", "x.nul"]) {
      expect(refusals({ importName, api: 1 }), importName).toEqual([]);
    }
  });

  it("refuses a trailing newline in a setting key, view id and node id", () => {
    const keyPattern = (instancePath: string) => expect.objectContaining({ keyword: "pattern", instancePath });
    expect(refusals(manifest({ settings: { "name\n": settings.name } }))).toContainEqual(keyPattern("/settings"));
    expect(refusals(manifest({ views: { "v\n": view } }))).toContainEqual(keyPattern("/views"));
    expect(refusals(withNode({ id: "a\n", component: "text" }))).toContainEqual(keyPattern("/views/v/nodes/0/id"));
  });

  it("refuses an unknown setting type", () => {
    expect(refusals(manifest({ settings: { m: { type: "slider", label: "M" } } }))).toContainEqual(
      expect.objectContaining({ keyword: "enum", instancePath: "/settings/m/type" }),
    );
  });

  it("refuses a binding with no method", () => {
    expect(refusals(withNode({ id: "a", component: "table", bind: { service: "demo:screens" } }))).toContainEqual(
      expect.objectContaining({ keyword: "required", instancePath: "/views/v/nodes/0/bind", params: { missingProperty: "method" } }),
    );
  });

  it("enforces the key pattern on an action's input keys", () => {
    const action = { label: "Go", call: binding, input: { "Bad-Key": settings.name } };
    expect(refusals(manifest({ actions: { go: action } }))).toContainEqual(
      expect.objectContaining({ keyword: "pattern", instancePath: "/actions/go/input" }),
    );
  });
});

describe("a host's declarations", () => {
  const host = {
    importName: "claude-code",
    api: 1,
    kind: "host",
    installMethod: "npm",
    packages: { npm: "@anthropic-ai/claude-code", homebrew: { name: "claude-code", options: { tap: "acme/tools" } } },
    pathCommands: { requested: ["cc", "claude"], minimum: 1 },
    methods: ["npm", "homebrew"],
  };

  it("accepts a host with packages, path commands and methods", () => {
    expect(compile()(host)).toBe(true);
  });

  it("accepts a plugin that names no kind, and the two kinds", () => {
    const validate = compile();
    expect(validate({ importName: "a", api: 1 })).toBe(true);
    expect(validate({ importName: "a", api: 1, kind: "plugin" })).toBe(true);
    expect(validate({ importName: "a", api: 1, kind: "loader" })).toBe(false);
  });

  it("refuses a package entry of an unknown shape, with a fix", () => {
    const validate = compile();
    for (const entry of [42, ["npm-name"], { options: {} }, { name: 7 }, { name: "x", options: "y" }]) {
      expect(validate({ importName: "a", api: 1, packages: { npm: entry } }), JSON.stringify(entry)).toBe(false);
    }
    expect(JSON.stringify(schema.properties.packages.fix)).toContain("name");
  });

  it("refuses path commands that are malformed", () => {
    const validate = compile();
    expect(validate({ importName: "a", api: 1, pathCommands: { requested: ["cc"], minimum: 2 } })).toBe(false);
    expect(validate({ importName: "a", api: 1, pathCommands: { requested: ["cc"], minimum: -1 } })).toBe(false);
    expect(validate({ importName: "a", api: 1, pathCommands: { requested: "cc", minimum: 0 } })).toBe(false);
    expect(validate({ importName: "a", api: 1, pathCommands: { minimum: 0 } })).toBe(false);
    expect(validate({ importName: "a", api: 1, pathCommands: { requested: ["cc"] } })).toBe(true);
  });

  it("takes a path command name only when it is one portable file name", () => {
    const validate = compile();
    const longest = "a".repeat(64);
    for (const name of ["cc", "C9", "open-code", "my_tool.v2", longest]) {
      expect(validate({ importName: "a", api: 1, pathCommands: { requested: [name] } }), name).toBe(true);
    }
    for (const name of ["", "-cc", ".cc", "_cc", "../escape", "a/b", "a b", "naïve", `${longest}a`]) {
      expect(validate({ importName: "a", api: 1, pathCommands: { requested: [name] } }), name).toBe(false);
    }
  });

  it("refuses methods that are not unique strings", () => {
    const validate = compile();
    expect(validate({ importName: "a", api: 1, methods: ["npm", "npm"] })).toBe(false);
    expect(validate({ importName: "a", api: 1, methods: [1] })).toBe(false);
  });

  it("keeps the in-application slash commands as they were", () => {
    const validate = compile();
    expect(validate({ importName: "a", api: 1, commands: [{ name: "x", description: "y" }] })).toBe(true);
    expect(validate({ importName: "a", api: 1, commands: { requested: ["cc"], minimum: 1 } })).toBe(false);
  });

  it("ignores a field it does not name", () => {
    expect(compile()({ ...host, somethingNewer: { any: "thing" } })).toBe(true);
  });
});
