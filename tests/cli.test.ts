import { expect, it } from "vitest";
import { parseCommand } from "../src/cli.js";

it("accepts only supported commands", () => {
  expect(parseCommand(["build"])).toBe("build");
  expect(parseCommand(["validate"])).toBe("validate");
  expect(parseCommand(["install"])).toBe("install");
  expect(parseCommand(["contact-sheet"])).toBe("contact-sheet");
  expect(() => parseCommand(["delete"])).toThrow("unknown command: delete");
});
