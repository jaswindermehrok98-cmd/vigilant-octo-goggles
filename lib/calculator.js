export function evaluateArithmetic(expression) {
  const input = String(expression ?? "").trim();
  if (!input || input.length > 500) throw new Error("Expression must contain 1-500 characters.");
  if (!/^[0-9+\-*/().%\s]+$/.test(input)) throw new Error("Only numeric arithmetic operators are allowed.");
  let i = 0;
  const skip = () => { while (/\s/.test(input[i] || "")) i++; };
  const number = () => {
    skip(); const start = i; let digits = 0;
    while (/\d/.test(input[i] || "")) { i++; digits++; }
    if (input[i] === ".") { i++; while (/\\d/.test(input[i] || "")) { i++; digits++; } }
    if (!digits) throw new Error("Expected a number.");
    return Number(input.slice(start, i));
  };
  const primary = () => {
    skip();
    if (input[i] === "(") { i++; const value = additive(); skip(); if (input[i] !== ")") throw new Error("Missing closing parenthesis."); i++; return value; }
    return number();
  };
  const unary = () => {
    skip();
    if (input[i] === "+") { i++; return unary(); }
    if (input[i] === "-") { i++; return -unary(); }
    return primary();
  };
  const multiplicative = () => {
    let value = unary();
    while (true) {
      skip(); const op = input[i];
      if (!["*","/","%"].includes(op)) break;
      i++; const right = unary();
      if ((op === "/" || op === "%") && right === 0) throw new Error("Division by zero.");
      value = op === "*" ? value * right : op === "/" ? value / right : value % right;
    }
    return value;
  };
  const additive = () => {
    let value = multiplicative();
    while (true) {
      skip(); const op = input[i];
      if (!["+","-"].includes(op)) break;
      i++; const right = multiplicative();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  };
  const value = additive();
  skip();
  if (i !== input.length) throw new Error("Unexpected characters in expression.");
  if (!Number.isFinite(value)) throw new Error("The result is not finite.");
  return value;
}
