import test from "node:test";
import assert from "node:assert/strict";
import { evaluateArithmetic } from "../lib/calculator.js";
import { isPrivateIp } from "../lib/browser-security.js";
import { PROTOCOLS, listProtocols, describeProtocol } from "../lib/protocols.js";
test("arithmetic parser",()=>{assert.equal(evaluateArithmetic("125*48+37"),6037);assert.equal(evaluateArithmetic("(2+3)*4"),20);assert.throws(()=>evaluateArithmetic("2 ** 10"));assert.throws(()=>evaluateArithmetic("1/0"),/Division by zero/);});
test("private IP guard",()=>{assert.equal(isPrivateIp("127.0.0.1"),true);assert.equal(isPrivateIp("10.0.0.2"),true);assert.equal(isPrivateIp("169.254.169.254"),true);assert.equal(isPrivateIp("::1"),true);assert.equal(isPrivateIp("8.8.8.8"),false);});
test("protocols are deterministic and gated",()=>{assert.equal(listProtocols().length,3);assert.equal(describeProtocol("prep_for_meeting").steps[0].tool,"webSearch");assert.equal(describeProtocol("prep_for_meeting").steps[2].approval,true);});
