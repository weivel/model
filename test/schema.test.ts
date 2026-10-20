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
  const ajv = new Ajv({ strict: true, allErrors: true });
  ajv.addKeyword({ keyword: "fix", schemaType: "string" });
  return ajv.compile(schema);
}

describe("plugin.schema.json", () => {
  it("compiles as a strict draft-07 schema", () => {
    expect(() => compile()).not.toThrow();
  });

  it("is identified by the URL it is published at", () => {
    expect(schema.$id).toBe(SCHEMA_URL);
  });

  it("accepts a minimal manifest and refuses an id that is not kebab case", () => {
    const validate = compile();
    expect(validate({ id: "config-ledger", api: 1 })).toBe(true);
    expect(validate({ id: "Config_Ledger", api: 1 })).toBe(false);
  });
});
