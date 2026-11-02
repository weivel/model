import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Ajv } from "ajv";
import { describe, expect, it } from "vitest";

const SCHEMA_URL = "https://weivel.github.io/model/ui-data.schema.json";

const schema = JSON.parse(readFileSync(fileURLToPath(new URL("../ui-data.schema.json", import.meta.url)), "utf8"));

function validatorFor(definition: string) {
  const ajv = new Ajv({ strict: true, allErrors: true });
  ajv.addKeyword({ keyword: "fix", schemaType: "string" });
  ajv.addSchema(schema);
  return ajv.compile({ $ref: `${SCHEMA_URL}#/definitions/${definition}` });
}

const itemsAnswer = { items: [{ id: "a", label: "A", state: "installed", parent: "root", values: { size: 3, ok: true, note: null, name: "x" }, tone: "success" }] };
const textAnswer = { text: "hello" };
const measureAnswer = { value: 3, maximum: 10 };

const validAnswers: Record<string, unknown> = {
  list: itemsAnswer,
  table: { ...itemsAnswer, columns: [{ key: "size", label: "Size", sortable: true }, { key: "name", label: "Name" }] },
  tree: itemsAnswer,
  text: textAnswer,
  code: textAnswer,
  log: textAnswer,
  diff: textAnswer,
  detail: { entries: [{ label: "Version", value: "1.0" }, { label: "Count", value: 2 }, { label: "On", value: true }, { label: "None", value: null }] },
  chart: { series: [{ label: "cpu", points: [1, 2, 3] }] },
  progress: measureAnswer,
  badge: { text: "ok", tone: "success" }
};

describe("ui-data.schema.json", () => {
  it("is identified by the URL it is published at", () => {
    expect(schema.$id).toBe(SCHEMA_URL);
  });

  it.each(Object.keys(validAnswers))("accepts a valid %s answer", (component) => {
    expect(validatorFor(component)(validAnswers[component])).toBe(true);
  });

  it("refuses a table whose items is not a list", () => {
    expect(validatorFor("table")({ items: "x" })).toBe(false);
  });

  it("refuses an item with no id", () => {
    expect(validatorFor("table")({ items: [{ label: "A" }] })).toBe(false);
  });

  it("refuses an item state outside the three states", () => {
    expect(validatorFor("list")({ items: [{ id: "a", state: "broken" }] })).toBe(false);
  });

  it("refuses an item value that is not a scalar", () => {
    expect(validatorFor("list")({ items: [{ id: "a", values: { nested: { x: 1 } } }] })).toBe(false);
  });

  it("refuses a column with no key or label", () => {
    expect(validatorFor("table")({ items: [], columns: [{ key: "a" }] })).toBe(false);
    expect(validatorFor("table")({ items: [], columns: [{ label: "A" }] })).toBe(false);
  });

  it("accepts both chart branches and refuses an empty answer", () => {
    const validate = validatorFor("chart");
    expect(validate({ series: [{ label: "a", points: [1] }] })).toBe(true);
    expect(validate({ value: 1, maximum: 2 })).toBe(true);
    expect(validate({})).toBe(false);
  });

  it("refuses a chart series with non-numeric points", () => {
    expect(validatorFor("chart")({ series: [{ label: "a", points: ["x"] }] })).toBe(false);
  });

  it("refuses a progress answer without its maximum", () => {
    expect(validatorFor("progress")({ value: 1 })).toBe(false);
  });

  it("refuses text answers without text", () => {
    expect(validatorFor("log")({})).toBe(false);
    expect(validatorFor("text")({ text: 3 })).toBe(false);
  });

  it("refuses a detail entry without its value", () => {
    expect(validatorFor("detail")({ entries: [{ label: "a" }] })).toBe(false);
  });

  it("refuses a badge tone that is a raw colour", () => {
    expect(validatorFor("badge")({ text: "x", tone: "#f00" })).toBe(false);
  });

  it("leaves the answers open to unknown members", () => {
    expect(validatorFor("list")({ items: [{ id: "a", color: "#f00" }], extra: 1 })).toBe(true);
    expect(validatorFor("badge")({ text: "x", color: "#f00" })).toBe(true);
  });

  it("never closes an object and never recurses", () => {
    const text = JSON.stringify(schema);
    expect(text).not.toContain("\"additionalProperties\":false");
    for (const [, reference] of text.matchAll(/"\$ref":"([^"]*)"/g)) {
      expect(reference).toMatch(/^#\/definitions\/[A-Za-z]+$/);
    }
  });
});
