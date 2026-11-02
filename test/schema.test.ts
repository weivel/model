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
    expect(validate({ id: "a", api: 1, capabilities: ["provider"] })).toBe(false);
    expect(validate({ id: "a", api: 1, capabilities: ["provider"], entry: "dist/index.js" })).toBe(true);
    expect(validate({ id: "a", api: 1, capabilities: [] })).toBe(true);
  });

  it("refuses an entry outside the repo", () => {
    const validate = compile();
    for (const entry of ["/abs/x.js", "\\abs\\x.js", "C:/x.js", "../x.js", "dist/../../x.js", "dist\\..\\x.js"]) {
      expect(validate({ id: "a", api: 1, entry }), entry).toBe(false);
    }
    for (const entry of ["dist/index.js", "dist/..x/index.js"]) {
      expect(validate({ id: "a", api: 1, entry }), entry).toBe(true);
    }
  });

  it("refuses an entry that hides an escape behind a line break or a control character", () => {
    const validate = compile();
    for (const entry of ["a\n/../../x.js", "a/..\n", "a\u0085/../x.js", "a\u2028/../x.js", "dist/index\u0000.js"]) {
      expect(validate({ id: "a", api: 1, entry }), JSON.stringify(entry)).toBe(false);
    }
  });

  it("refuses a duplicate capability or permission", () => {
    const validate = compile();
    expect(validate({ id: "a", api: 1, entry: "dist/index.js", capabilities: ["a", "a"] })).toBe(false);
    expect(validate({ id: "a", api: 1, permissions: ["net", "net"] })).toBe(false);
  });

  it("accepts a minimal manifest and refuses an id that is not kebab case", () => {
    const validate = compile();
    expect(validate({ id: "config-ledger", api: 1 })).toBe(true);
    expect(validate({ id: "Config_Ledger", api: 1 })).toBe(false);
  });

  it("validates a manifest's app against appDeclaration", () => {
    expect(schema.properties.app).toEqual({ $ref: "#/definitions/appDeclaration" });
    const validate = compile();
    const declared = { id: "alpha", label: "Alpha CLI", home: { candidates: ["~/.alpha"] }, detect: { pkg: "alpha-cli" } };
    expect(validate({ id: "a", api: 1, app: declared })).toBe(true);
    expect(definition("appDeclaration")(declared)).toBe(true);
    expect(validate({ id: "a", api: 1, app: { id: "alpha", label: "Alpha CLI" } })).toBe(false);
  });

  it("publishes the resolved app descriptor", () => {
    const validate = definition("appDescriptor");
    expect(validate(RESOLVED_ALPHA)).toBe(true);
    const { commandsSubdir: _commandsSubdir, ...withoutCommandsSubdir } = RESOLVED_ALPHA;
    expect(validate(withoutCommandsSubdir)).toBe(false);
    expect(validate.errors?.map((error) => error.params)).toContainEqual({ missingProperty: "commandsSubdir" });
  });
});

describe("a host's declarations", () => {
  const host = {
    id: "claude-code",
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
    expect(validate({ id: "a", api: 1 })).toBe(true);
    expect(validate({ id: "a", api: 1, kind: "plugin" })).toBe(true);
    expect(validate({ id: "a", api: 1, kind: "loader" })).toBe(false);
  });

  it("refuses a package entry of an unknown shape, with a fix", () => {
    const validate = compile();
    for (const entry of [42, ["npm-name"], { options: {} }, { name: 7 }, { name: "x", options: "y" }]) {
      expect(validate({ id: "a", api: 1, packages: { npm: entry } }), JSON.stringify(entry)).toBe(false);
    }
    expect(JSON.stringify(schema.properties.packages.fix)).toContain("name");
  });

  it("refuses path commands that are malformed", () => {
    const validate = compile();
    expect(validate({ id: "a", api: 1, pathCommands: { requested: ["cc"], minimum: 2 } })).toBe(false);
    expect(validate({ id: "a", api: 1, pathCommands: { requested: ["cc"], minimum: -1 } })).toBe(false);
    expect(validate({ id: "a", api: 1, pathCommands: { requested: "cc", minimum: 0 } })).toBe(false);
    expect(validate({ id: "a", api: 1, pathCommands: { minimum: 0 } })).toBe(false);
    expect(validate({ id: "a", api: 1, pathCommands: { requested: ["cc"] } })).toBe(true);
  });

  it("takes a path command name only when it is one portable file name", () => {
    const validate = compile();
    const longest = "a".repeat(64);
    for (const name of ["cc", "C9", "open-code", "my_tool.v2", longest]) {
      expect(validate({ id: "a", api: 1, pathCommands: { requested: [name] } }), name).toBe(true);
    }
    for (const name of ["", "-cc", ".cc", "_cc", "../escape", "a/b", "a b", "naïve", `${longest}a`]) {
      expect(validate({ id: "a", api: 1, pathCommands: { requested: [name] } }), name).toBe(false);
    }
  });

  it("refuses methods that are not unique strings", () => {
    const validate = compile();
    expect(validate({ id: "a", api: 1, methods: ["npm", "npm"] })).toBe(false);
    expect(validate({ id: "a", api: 1, methods: [1] })).toBe(false);
  });

  it("keeps the in-application slash commands as they were", () => {
    const validate = compile();
    expect(validate({ id: "a", api: 1, commands: [{ name: "x", description: "y" }] })).toBe(true);
    expect(validate({ id: "a", api: 1, commands: { requested: ["cc"], minimum: 1 } })).toBe(false);
  });

  it("ignores a field it does not name", () => {
    expect(compile()({ ...host, somethingNewer: { any: "thing" } })).toBe(true);
  });
});
