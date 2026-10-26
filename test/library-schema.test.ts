import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Ajv } from "ajv";
import { describe, expect, it } from "vitest";

const SCHEMA_URL = "https://weivel.github.io/model/library.schema.json";

function readJson(relativePath: string) {
  return JSON.parse(readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8"));
}

const schema = readJson("../library.schema.json");
const echoDeclaration = readJson("./fixtures/echo.library.json");

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

function echoWith(change: (declaration: any) => void) {
  const declaration = structuredClone(echoDeclaration);
  change(declaration);
  return declaration;
}

describe("library.schema.json", () => {
  it("compiles as a strict draft-07 schema", () => {
    expect(() => compile()).not.toThrow();
  });

  it("is identified by the URL it is published at", () => {
    expect(schema.$id).toBe(SCHEMA_URL);
  });

  it("accepts the echo fixture's declaration", () => {
    expect(compile()(echoDeclaration)).toBe(true);
  });

  it("refuses an unknown kind", () => {
    const declaration = echoWith((value) => (value.services[0].functions[0].kind = "bytes"));
    expect(compile()(declaration)).toBe(false);
  });

  it("refuses a symbol that is not a C identifier", () => {
    const declaration = echoWith((value) => (value.services[0].functions[0].symbol = "echo-echo"));
    expect(compile()(declaration)).toBe(false);
  });

  it("refuses a service with no functions", () => {
    const declaration = echoWith((value) => (value.services[0].functions = []));
    expect(compile()(declaration)).toBe(false);
  });

  it("refuses a declaration with no services, a missing field or an unknown one", () => {
    const validate = compile();
    expect(validate(echoWith((value) => (value.services = [])))).toBe(false);
    expect(validate(echoWith((value) => delete value.release))).toBe(false);
    expect(validate(echoWith((value) => (value.extra = 1)))).toBe(false);
    expect(validate(echoWith((value) => (value.services[0].functions[0].extra = 1)))).toBe(false);
  });

  it("refuses an id that is not kebab case", () => {
    expect(compile()(echoWith((value) => (value.id = "Echo_Lib")))).toBe(false);
  });
});
