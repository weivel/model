import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Ajv } from "ajv";
import { describe, expect, it } from "vitest";

const SCHEMA_URL = "https://weivel.github.io/model/install-method.schema.json";

const schema = JSON.parse(readFileSync(fileURLToPath(new URL("../install-method.schema.json", import.meta.url)), "utf8"));

function validatorFor(definition: string) {
  const ajv = new Ajv({ strict: true, allErrors: true });
  ajv.addSchema(schema);
  return ajv.compile({ $ref: `${SCHEMA_URL}#/definitions/${definition}` });
}

describe("install-method.schema.json", () => {
  it("is identified by the URL it is published at", () => {
    expect(schema.$id).toBe(SCHEMA_URL);
  });

  it("accepts a detect answer with and without a version", () => {
    const validate = validatorFor("detectAnswer");
    expect(validate({ installed: true, version: "1.2.3" })).toBe(true);
    expect(validate({ installed: false })).toBe(true);
  });

  it("refuses a detect answer without installed or with a non-string version", () => {
    const validate = validatorFor("detectAnswer");
    expect(validate({ version: "1.2.3" })).toBe(false);
    expect(validate({ installed: true, version: 3 })).toBe(false);
  });

  it("accepts success and a refusal carrying a detail and a fix", () => {
    const validate = validatorFor("operationAnswer");
    expect(validate({ ok: true })).toBe(true);
    expect(validate({ ok: false, detail: "x", fix: "y" })).toBe(true);
  });

  it("leaves the answers open to unknown keys", () => {
    expect(validatorFor("operationAnswer")({ ok: true, detail: "x" })).toBe(true);
    expect(validatorFor("detectAnswer")({ installed: true, extra: 1 })).toBe(true);
  });

  it("refuses answers of the wrong type", () => {
    expect(validatorFor("detectAnswer")({ installed: "yes" })).toBe(false);
    expect(validatorFor("operationAnswer")({ ok: "true" })).toBe(false);
  });

  it("refuses a refusal without its detail or fix", () => {
    const validate = validatorFor("operationAnswer");
    expect(validate({ ok: false })).toBe(false);
    expect(validate({ ok: false, detail: "x" })).toBe(false);
    expect(validate({ ok: false, fix: "y" })).toBe(false);
  });
});
