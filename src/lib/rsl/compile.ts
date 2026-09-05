import { toJs } from "./expr";
import { FLATTEN_TO_RXJS, type CombineStrategy, type RslMachine, type RslState } from "./types";

const COMBINE_RX: Record<CombineStrategy, string> = {
  merge: "merge",
  combineLatest: "combineLatest",
  zip: "zip",
  concat: "concat",
  race: "race",
  forkJoin: "forkJoin",
};

export function compileToRxjs(machine: RslMachine): string {
  const imports = new Set<string>();
  const prelude: string[] = [];
  const used = new Set<string>();
  const head = compileHead(machine.StartAt, machine, imports, prelude, used);
  const piped = compileChain(head, nextName(machine, machine.StartAt), machine, imports, prelude, used);

  const importList = [...imports].sort().join(", ");
  const lines = [`import { ${importList} } from "rxjs";`, ""];
  if (prelude.length) lines.push(...prelude, "");
  lines.push(piped + ".subscribe({");
  lines.push("  next: value => console.log(value),");
  lines.push("  error: err => console.error(err),");
  lines.push('  complete: () => console.log("complete"),');
  lines.push("});");
  return lines.join("\n");
}

function nextName(machine: RslMachine, name: string): string | undefined {
  const s = machine.States[name];
  if (!s || s.End || s.Type === "Sink") return undefined;
  return s.Next;
}

function compileHead(
  name: string,
  machine: RslMachine,
  imports: Set<string>,
  prelude: string[],
  used: Set<string>,
): string {
  const s = machine.States[name];
  if (!s) return "EMPTY";
  if (s.Type === "Source") return compileSource(s, name, imports, "");
  if (s.Type === "Combine") {
    const args = s.Sources.map((src) => {
      const ident = identOf(src);
      if (!used.has(src)) {
        used.add(src);
        const body = compileIsolated(src, machine, imports, prelude, used);
        prelude.push(`const ${ident} = ${body};`);
      }
      return ident;
    });
    const fn = COMBINE_RX[s.Strategy];
    imports.add(fn);
    if (s.Strategy === "merge" || s.Strategy === "concat" || s.Strategy === "race") {
      return `${fn}(${args.join(", ")})`;
    }
    return `${fn}([${args.join(", ")}])`;
  }
  imports.add("EMPTY");
  return "EMPTY";
}

function compileIsolated(
  name: string,
  machine: RslMachine,
  imports: Set<string>,
  prelude: string[],
  used: Set<string>,
): string {
  const s = machine.States[name];
  if (!s) return "EMPTY";
  const head = compileHead(name, machine, imports, prelude, used);
  if (s.End || !s.Next || s.Type === "Sink") return head;
  return compileChain(head, s.Next, machine, imports, prelude, used);
}

function compileChain(
  head: string,
  start: string | undefined,
  machine: RslMachine,
  imports: Set<string>,
  prelude: string[],
  used: Set<string>,
): string {
  const ops: string[] = [];
  let name = start;
  let sinked = false;
  while (name) {
    const s = machine.States[name];
    if (!s) break;
    if (s.Type === "Pipe") {
      ops.push(...pipeOps(s, imports));
      name = s.End ? undefined : s.Next;
      continue;
    }
    if (s.Type === "FlatMap") {
      imports.add(FLATTEN_TO_RXJS[s.Flatten]);
      ops.push(`${FLATTEN_TO_RXJS[s.Flatten]}(value => ${compileProject(s.Project, imports, prelude, used)})`);
      if (s.Output) ops.push(outputOp(s.Output, imports));
      name = s.End ? undefined : s.Next;
      continue;
    }
    if (s.Type === "Sink") {
      sinked = true;
      name = undefined;
      continue;
    }
    break;
  }
  void sinked;
  if (!ops.length) return head;
  return `${head}.pipe(\n  ${ops.join(",\n  ")}\n)`;
}

function compileProject(
  project: string | RslMachine,
  imports: Set<string>,
  prelude: string[],
  used: Set<string>,
): string {
  if (typeof project === "string") {
    imports.add("of");
    return `of(${toJs(project)})`;
  }
  return compileIsolated(project.StartAt, project, imports, prelude, used);
}

function compileSource(
  s: Extract<RslState, { Type: "Source" }>,
  _name: string,
  imports: Set<string>,
  valueIdent: string,
): string {
  void valueIdent;
  switch (s.Operator) {
    case "of": {
      imports.add("of");
      const values = Array.isArray(s.Arguments?.values) ? s.Arguments.values : [];
      const args = values.map((v) => compileValue(v)).join(", ");
      return applyOutput(`of(${args})`, s, imports);
    }
    case "from": {
      imports.add("from");
      const values = Array.isArray(s.Arguments?.values) ? s.Arguments.values : [];
      const args = values.map((v) => compileValue(v)).join(", ");
      return applyOutput(`from([${args}])`, s, imports);
    }
    case "interval": {
      imports.add("interval");
      return applyOutput(`interval(${Number(s.Arguments?.period ?? 1000)})`, s, imports);
    }
    case "range": {
      imports.add("range");
      return applyOutput(
        `range(${Number(s.Arguments?.start ?? 0)}, ${Number(s.Arguments?.count ?? 5)})`,
        s,
        imports,
      );
    }
    case "timer": {
      imports.add("timer");
      return applyOutput(`timer(${Number(s.Arguments?.due ?? 0)})`, s, imports);
    }
    default:
      imports.add("EMPTY");
      return "EMPTY";
  }
}

function compileValue(v: unknown): string {
  if (typeof v === "string" && v.includes("{%")) return toJs(v);
  return JSON.stringify(v);
}

function pipeOps(s: Extract<RslState, { Type: "Pipe" }>, imports: Set<string>): string[] {
  imports.add(s.Operator);
  const extra: string[] = [];
  switch (s.Operator) {
    case "map":
      extra.push(`map((value, index) => ${s.Project ? toJs(s.Project) : "value"})`);
      break;
    case "filter":
      extra.push(`filter((value, index) => ${s.Project ? toJs(s.Project) : "true"})`);
      break;
    case "tap":
      extra.push(`tap(value => console.log(${s.Project ? toJs(s.Project) : "value"}))`);
      break;
    case "take":
      extra.push(`take(${Number(s.Arguments?.count ?? 1)})`);
      break;
    case "skip":
      extra.push(`skip(${Number(s.Arguments?.count ?? 1)})`);
      break;
    case "scan":
      extra.push(
        `scan((acc, value, index) => ${s.Project ? toJs(s.Project) : "value"}, ${JSON.stringify(s.Arguments?.seed ?? 0)})`,
      );
      break;
    case "debounceTime":
      extra.push(`debounceTime(${Number(s.Arguments?.due ?? 0)})`);
      break;
    default:
      break;
  }
  if (s.Output) extra.push(outputOp(s.Output, imports));
  return extra;
}

function outputOp(expr: string, imports: Set<string>): string {
  imports.add("map");
  return `map(value => ${toJs(expr)})`;
}

function applyOutput(head: string, s: RslState, imports?: Set<string>): string {
  if (!s.Output) return head;
  imports?.add("map");
  return `${head}.pipe(map(value => ${toJs(s.Output)}))`;
}

function identOf(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9_]/g, "_");
  return `${cleaned}$`;
}
