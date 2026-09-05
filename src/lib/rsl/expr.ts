/** JSONata-inspired `{% ... %}` subset used by RSL Project / Output fields. */

export function stripExpr(expr: string): string {
  const t = expr.trim();
  const m = t.match(/^\{%\s*([\s\S]*?)\s*%\}$/);
  return (m ? m[1] : t).trim();
}

export function toJs(expr: string): string {
  let s = stripExpr(expr);
  s = s.replace(/\$string\(/g, "String(");
  s = s.replace(/\$value/g, "value");
  s = s.replace(/\$index/g, "index");
  s = s.replace(/\$acc/g, "acc");
  s = s.replace(/\band\b/g, "&&");
  s = s.replace(/\bor\b/g, "||");
  s = s.replace(/&/g, "+");
  s = s.replace(/([^!<>=])=(?!=)/g, "$1===");
  return s;
}

export function evalProject(
  expr: string | undefined,
  value: unknown,
  extra: { index?: number; acc?: unknown } = {},
): unknown {
  if (!expr) return value;
  const js = toJs(expr);
  const fn = new Function(
    "value",
    "index",
    "acc",
    `"use strict"; return (${js});`,
  ) as (value: unknown, index: number, acc: unknown) => unknown;
  return fn(value, extra.index ?? 0, extra.acc);
}

export function resolveArgValue(
  raw: unknown,
  env: { value?: unknown; index?: number },
): unknown {
  if (typeof raw === "string" && raw.includes("{%")) {
    return evalProject(raw, env.value, { index: env.index });
  }
  return raw;
}
