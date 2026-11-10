import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Ajv } from "ajv";
import { describe, expect, it } from "vitest";

function load(file: string) {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`../${file}`, import.meta.url)), "utf8"));
}

const plugin = load("plugin.schema.json");
const list = load("marketplace.schema.json");
const copy = load("marketplace-copy.schema.json");

function compile(schema: object) {
  const ajv = new Ajv({ strict: true, allErrors: true });
  ajv.addKeyword({ keyword: "fix", schemaType: "string" });
  return ajv.compile(schema);
}

const validateList = compile(list);
const validateCopy = compile(copy);

const copyEntry = { id: "github:123", name: "runtime", fullName: "spisor/runtime", lastKnown: "spisor/runtime" };
const minimalCopy = { format: 1, built: "2026-11-10T12:00:00Z", entries: [copyEntry] };

describe("marketplace.schema.json", () => {
  it("is identified by the URL it is published at", () => {
    expect(list.$id).toBe("https://weivel.github.io/model/marketplace.schema.json");
  });

  it("accepts a minimal list", () => {
    expect(validateList({ format: 1, entries: [{ id: "github:123" }] })).toBe(true);
  });

  it("accepts an entry with an alias, a description and categories", () => {
    const entry = { id: "gitea@git.example.com:12/runtime", alias: "runtime-2", description: "x", categories: ["ai-provider"] };
    expect(validateList({ format: 1, title: "mine", entries: [entry] })).toBe(true);
  });

  it("refuses an entry without an id", () => {
    expect(validateList({ format: 1, entries: [{ alias: "runtime" }] })).toBe(false);
  });

  it("refuses an id outside the grammar", () => {
    for (const id of ["spisor/runtime", "github:abc", "GitHub:1", ""]) {
      expect(validateList({ format: 1, entries: [{ id }] }), id).toBe(false);
    }
  });

  it("refuses a name in a list entry, since only an alias may be written", () => {
    expect(validateList({ format: 1, entries: [{ id: "github:123", name: "runtime" }] })).toBe(false);
  });

  it("refuses an alias or a category outside the import name grammar", () => {
    expect(validateList({ format: 1, entries: [{ id: "github:123", alias: "Runtime" }] })).toBe(false);
    expect(validateList({ format: 1, entries: [{ id: "github:123", alias: "package" }] })).toBe(false);
    expect(validateList({ format: 1, entries: [{ id: "github:123", categories: ["Not Valid"] }] })).toBe(false);
  });

  it("refuses a list without a format or with the wrong one", () => {
    expect(validateList({ entries: [] })).toBe(false);
    expect(validateList({ format: 2, entries: [] })).toBe(false);
  });

  it("accepts a duplicate id, which the build refuses", () => {
    expect(validateList({ format: 1, entries: [{ id: "github:123" }, { id: "github:123" }] })).toBe(true);
  });

  it("bounds the entries at 10000", () => {
    const entries = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `github:${index + 1}` }));
    expect(validateList({ format: 1, entries: entries(10000) })).toBe(true);
    expect(validateList({ format: 1, entries: entries(10001) })).toBe(false);
  });
});

describe("marketplace-copy.schema.json", () => {
  it("is identified by the URL it is published at", () => {
    expect(copy.$id).toBe("https://weivel.github.io/model/marketplace-copy.schema.json");
  });

  it("accepts a minimal copy", () => {
    expect(validateCopy(minimalCopy)).toBe(true);
  });

  it("refuses a copy without built", () => {
    expect(validateCopy({ format: 1, entries: [copyEntry] })).toBe(false);
  });

  it("accepts RFC 3339 timestamps and refuses other dates", () => {
    for (const built of ["2026-11-10T12:00:00Z", "2026-11-10T12:00:00.5+01:00"]) {
      expect(validateCopy({ ...minimalCopy, built }), built).toBe(true);
    }
    for (const built of ["2026-11-10", "2026-11-10 12:00:00", "yesterday", 5]) {
      expect(validateCopy({ ...minimalCopy, built }), String(built)).toBe(false);
    }
  });

  it("refuses an entry missing a required member", () => {
    for (const member of ["id", "name", "fullName", "lastKnown"]) {
      const { [member]: _removed, ...entry } = copyEntry as Record<string, string>;
      expect(validateCopy({ ...minimalCopy, entries: [entry] }), member).toBe(false);
    }
  });

  it("refuses a name outside the import name grammar and a full name that is not owner/name", () => {
    expect(validateCopy({ ...minimalCopy, entries: [{ ...copyEntry, name: "Runtime" }] })).toBe(false);
    expect(validateCopy({ ...minimalCopy, entries: [{ ...copyEntry, fullName: "runtime" }] })).toBe(false);
  });

  it("accepts a duplicate id, which the build refuses", () => {
    expect(validateCopy({ ...minimalCopy, entries: [copyEntry, copyEntry] })).toBe(true);
  });
});

describe("the grammars the marketplace schemas share with the plugin schema", () => {
  const importNameProperty = plugin.properties.importName;
  const dependencyId = plugin.properties.dependencies.items.properties.id;

  it("uses the import name grammar for alias, name and categories", () => {
    expect(list.properties.entries.items.properties.alias.pattern).toBe(importNameProperty.pattern);
    expect(list.properties.entries.items.properties.categories.items.pattern).toBe(importNameProperty.pattern);
    expect(copy.properties.entries.items.properties.name.pattern).toBe(importNameProperty.pattern);
    expect(copy.properties.entries.items.properties.categories.items.pattern).toBe(importNameProperty.pattern);
  });

  it("uses the id grammar for every id", () => {
    expect(list.properties.entries.items.properties.id.pattern).toBe(dependencyId.pattern);
    expect(copy.properties.entries.items.properties.id.pattern).toBe(dependencyId.pattern);
  });
});
