import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Ajv } from "ajv";
import { describe, expect, it } from "vitest";

const SCHEMA_URL = "https://weivel.github.io/model/repo.schema.json";
const COMMIT = "0123456789abcdef0123456789abcdef01234567";

const schema = JSON.parse(readFileSync(fileURLToPath(new URL("../repo.schema.json", import.meta.url)), "utf8"));

/**
 * @implNote Strict, so a misspelt keyword fails here instead of being silently ignored. `fix` is the
 * vocabulary's own keyword and carries no validation meaning.
 */
function compile() {
  const ajv = new Ajv({ strict: true, allErrors: true });
  ajv.addKeyword({ keyword: "fix", schemaType: "string" });
  return ajv.compile(schema);
}

const validate = compile();

function minimal(extra: Record<string, unknown> = {}) {
  return { format: 1, importName: "x", ...extra };
}

function dependency(extra: Record<string, unknown> = {}) {
  return { id: "github:123", importName: "x", commit: COMMIT, ...extra };
}

function fieldsOf(node: any, path: string[] = []): { path: string[]; node: any }[] {
  const fields: { path: string[]; node: any }[] = [];
  for (const [name, child] of Object.entries<any>(node.properties ?? {})) {
    fields.push({ path: [...path, name], node: child }, ...fieldsOf(child, [...path, name]));
  }
  if (node.items) fields.push(...fieldsOf(node.items, [...path, "[]"]));
  if (node.additionalProperties && typeof node.additionalProperties === "object") {
    fields.push(...fieldsOf(node.additionalProperties, [...path, "{}"]));
  }
  return fields;
}

describe("repo.schema.json", () => {
  it("compiles as a strict draft-07 schema identified by its published URL", () => {
    expect(schema.$id).toBe(SCHEMA_URL);
    expect(() => compile()).not.toThrow();
  });

  it("accepts a file with only format and importName", () => {
    expect(validate(minimal())).toBe(true);
  });

  it("accepts a full docs-repo file with place, projects and claims", () => {
    const file = minimal({
      importName: "docs",
      description: "The org's docs",
      topics: ["docs", "spisor"],
      homepage: "https://example.org",
      settings: { visibility: "public", defaultBranch: "main", issues: true, wiki: false },
      place: "docs",
      hosts: ["github:spisor"],
      projects: { shared: "Shared libraries", platform: "The platform" },
      claims: ["github:forebay"],
      dependencies: [dependency(), dependency({ path: "siblings/x" })],
    });
    expect(validate(file)).toBe(true);
  });

  it("refuses a dependency without a commit or with a short one", () => {
    const { commit, ...withoutCommit } = dependency();
    expect(validate(minimal({ dependencies: [withoutCommit] }))).toBe(false);
    expect(validate(minimal({ dependencies: [dependency({ commit: "0123abc" })] }))).toBe(false);
    expect(validate(minimal({ dependencies: [dependency({ commit: COMMIT.toUpperCase() })] }))).toBe(false);
  });

  it("refuses a dependency that names itself by name instead of id", () => {
    const { id, ...withoutId } = dependency();
    expect(validate(minimal({ dependencies: [{ ...withoutId, name: "x" }] }))).toBe(false);
  });

  it("refuses a dependency path that leaves siblings or climbs out", () => {
    expect(validate(minimal({ dependencies: [dependency({ path: "siblings/../x" })] }))).toBe(false);
    expect(validate(minimal({ dependencies: [dependency({ path: "other/x" })] }))).toBe(false);
    expect(validate(minimal({ dependencies: [dependency({ path: "siblings" })] }))).toBe(false);
  });

  it("leaves the last-segment rule to the checkout, since draft-07 cannot compare two values", () => {
    expect(validate(minimal({ dependencies: [dependency({ path: "siblings/other" })] }))).toBe(true);
  });

  it("refuses 21 topics and an upper-case topic", () => {
    const twentyOne = Array.from({ length: 21 }, (_, index) => `topic-${index}`);
    expect(validate(minimal({ topics: twentyOne }))).toBe(false);
    expect(validate(minimal({ topics: twentyOne.slice(0, 20) }))).toBe(true);
    expect(validate(minimal({ topics: ["Java"] }))).toBe(false);
  });

  it("refuses a member name or id at the top", () => {
    expect(validate(minimal({ name: "x" }))).toBe(false);
    expect(validate(minimal({ id: "github:1" }))).toBe(false);
  });

  it("refuses a format other than 1", () => {
    expect(validate({ format: 2, importName: "x" })).toBe(false);
  });

  it("refuses a claim that is not an owner with a resolver", () => {
    expect(validate(minimal({ claims: ["forebay"] }))).toBe(false);
    expect(validate(minimal({ hosts: ["forebay"] }))).toBe(false);
  });

  it("refuses a missing importName and a malformed one", () => {
    expect(validate({ format: 1 })).toBe(false);
    expect(validate(minimal({ importName: "Bad_Name" }))).toBe(false);
  });

  it("refuses an unknown member inside settings", () => {
    expect(validate(minimal({ settings: { archived: true } }))).toBe(false);
  });

  it("carries a description and a fix on every field", () => {
    const missing = fieldsOf(schema)
      .filter(({ path }) => path[0] !== "$schema")
      .filter(({ node }) => typeof node.description !== "string" || typeof node.fix !== "string")
      .map(({ path }) => path.join("."));
    expect(missing).toEqual([]);
  });
});
