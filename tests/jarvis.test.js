import test from "node:test";
import assert from "node:assert/strict";
import { evaluateArithmetic } from "../lib/calculator.js";
import { isPrivateIp } from "../lib/browser-security.js";
import { PROTOCOLS, listProtocols, describeProtocol } from "../lib/protocols.js";
import {
  extractArithmeticExpression,
  firstStepToolChoice,
} from "../lib/jarvis-router.js";

test("arithmetic parser", () => {
  assert.equal(evaluateArithmetic("125*48+37"), 6037);
  assert.equal(evaluateArithmetic("(2+3)*4"), 20);
  assert.throws(() => evaluateArithmetic("2 ** 10"));
  assert.throws(() => evaluateArithmetic("1/0"), /Division by zero/);
});

test("natural language arithmetic is routable", () => {
  assert.equal(extractArithmeticExpression("What is 27 × 19?"), "27 * 19");
  assert.deepEqual(firstStepToolChoice("What is 27 × 19?"), {
    type: "tool",
    toolName: "calculator",
  });
  assert.deepEqual(firstStepToolChoice("Open my Vercel dashboard"), {
    type: "tool",
    toolName: "realBrowserAgent",
  });
  assert.deepEqual(firstStepToolChoice("Search the web for the latest Browserbase news"), {
    type: "tool",
    toolName: "webSearch",
  });
  assert.deepEqual(firstStepToolChoice("What is the current time?"), {
    type: "tool",
    toolName: "currentTime",
  });
});

test("private IP guard", () => {
  assert.equal(isPrivateIp("127.0.0.1"), true);
  assert.equal(isPrivateIp("10.0.0.2"), true);
  assert.equal(isPrivateIp("169.254.169.254"), true);
  assert.equal(isPrivateIp("::1"), true);
  assert.equal(isPrivateIp("8.8.8.8"), false);
});

test("protocols are deterministic and gated", () => {
  assert.equal(listProtocols().length, 3);
  assert.equal(describeProtocol("prep_for_meeting").steps[0].tool, "webSearch");
  assert.equal(describeProtocol("prep_for_meeting").steps[2].approval, true);
  assert.deepEqual(Object.keys(PROTOCOLS).sort(), [
    "daily_brief",
    "prep_for_meeting",
    "research_pack",
  ]);
});
