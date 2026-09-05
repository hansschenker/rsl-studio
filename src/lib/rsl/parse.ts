import {
  COMBINE_STRATEGIES,
  FLATTEN_STRATEGIES,
  NODE_TYPES,
  PIPE_OPERATORS,
  SOURCE_OPERATORS,
  type CombineState,
  type FlatMapState,
  type Issue,
  type RslMachine,
  type RslState,
} from "./types";

const NODE_SET = new Set<string>(NODE_TYPES);
const SOURCE_SET = new Set<string>(SOURCE_OPERATORS);
const PIPE_SET = new Set<string>(PIPE_OPERATORS);
const COMBINE_SET = new Set<string>(COMBINE_STRATEGIES);
const FLATTEN_SET = new Set<string>(FLATTEN_STRATEGIES);

export type ParseResult = {
  ok: boolean;
  machine: RslMachine | null;
  issues: Issue[];
};

export function parseRsl(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch (err) {
    return {
      ok: false,
      machine: null,
      issues: [{ path: "$", message: err instanceof Error ? err.message : "Invalid JSON" }],
    };
  }
  const issues: Issue[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, machine: null, issues: [{ path: "$", message: "Document must be an object" }] };
  }
  const doc = raw as Record<string, unknown>;
  if (typeof doc.StartAt !== "string" || !doc.StartAt) {
    issues.push({ path: "StartAt", message: "StartAt is required" });
  }
  if (!doc.States || typeof doc.States !== "object" || Array.isArray(doc.States)) {
    issues.push({ path: "States", message: "States must be an object of named nodes" });
    return { ok: false, machine: null, issues };
  }
  const states = doc.States as Record<string, unknown>;
  const names = Object.keys(states);
  if (typeof doc.StartAt === "string" && !states[doc.StartAt]) {
    issues.push({ path: "StartAt", message: `StartAt "${doc.StartAt}" is not in States` });
  }
  for (const [name, value] of Object.entries(states)) {
    validateState(name, value, names, issues);
  }
  if (issues.some((i) => i.message.includes("required") || i.path === "StartAt")) {
    /* keep collecting */
  }
  const machine: RslMachine = {
    Comment: typeof doc.Comment === "string" ? doc.Comment : undefined,
    QueryLanguage: "JSONata",
    Version: typeof doc.Version === "string" ? doc.Version : "1.0",
    StartAt: String(doc.StartAt ?? ""),
    States: states as Record<string, RslState>,
  };
  if (issues.length) return { ok: false, machine, issues };
  return { ok: true, machine, issues };
}

function validateState(name: string, value: unknown, names: string[], issues: Issue[]) {
  const p = `States.${name}`;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    issues.push({ path: p, message: "State must be an object" });
    return;
  }
  const s = value as Record<string, unknown>;
  if (typeof s.Type !== "string" || !NODE_SET.has(s.Type)) {
    issues.push({ path: `${p}.Type`, message: `Type must be one of ${NODE_TYPES.join(", ")}` });
    return;
  }
  if (s.Next != null && typeof s.Next !== "string") {
    issues.push({ path: `${p}.Next`, message: "Next must be a state name" });
  }
  if (typeof s.Next === "string" && !names.includes(s.Next) && s.Type !== "Sink") {
    issues.push({ path: `${p}.Next`, message: `Unknown next state "${s.Next}"` });
  }
  if (s.Type === "Sink" && s.Next) {
    issues.push({ path: `${p}.Next`, message: "Sink has only an input — no Next" });
  }
  switch (s.Type) {
    case "Source":
      if (!SOURCE_SET.has(String(s.Operator))) {
        issues.push({
          path: `${p}.Operator`,
          message: `Source Operator must be ${SOURCE_OPERATORS.join(", ")}`,
        });
      }
      break;
    case "Pipe":
      if (!PIPE_SET.has(String(s.Operator))) {
        issues.push({
          path: `${p}.Operator`,
          message: `Pipe Operator must be ${PIPE_OPERATORS.join(", ")}`,
        });
      }
      break;
    case "Combine": {
      const c = s as unknown as CombineState;
      if (!COMBINE_SET.has(String(c.Strategy))) {
        issues.push({ path: `${p}.Strategy`, message: `Unknown combine strategy` });
      }
      if (!Array.isArray(c.Sources) || c.Sources.length < 2) {
        issues.push({ path: `${p}.Sources`, message: "Combine needs at least two Sources" });
      } else {
        for (const src of c.Sources) {
          if (!names.includes(src)) issues.push({ path: `${p}.Sources`, message: `Unknown source "${src}"` });
        }
      }
      break;
    }
    case "FlatMap": {
      const f = s as unknown as FlatMapState;
      if (!FLATTEN_SET.has(String(f.Flatten))) {
        issues.push({
          path: `${p}.Flatten`,
          message: "Flatten must be merge, concat, switch, or exhaust",
        });
      }
      if (f.Project == null) {
        issues.push({ path: `${p}.Project`, message: "FlatMap needs a Project (inner pipeline or expression)" });
      } else if (typeof f.Project === "object") {
        const inner = parseRsl(JSON.stringify(f.Project));
        for (const issue of inner.issues) {
          issues.push({ path: `${p}.Project.${issue.path}`, message: issue.message });
        }
      }
      break;
    }
    case "Sink":
      break;
    default:
      break;
  }
}
