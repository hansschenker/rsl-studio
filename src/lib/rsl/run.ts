import {
  EMPTY,
  Observable,
  combineLatest,
  concat,
  forkJoin,
  from,
  interval,
  merge,
  of,
  race,
  range,
  throwError,
  timer,
  zip,
} from "rxjs";
import {
  concatMap,
  debounceTime,
  exhaustMap,
  filter,
  map,
  mergeMap,
  scan,
  skip,
  switchMap,
  take,
  takeUntil,
  tap,
} from "rxjs/operators";
import { evalProject, resolveArgValue } from "./expr";
import type { CombineStrategy, RslMachine, RslState } from "./types";

export type StreamEvent = {
  t: number;
  kind: "next" | "error" | "complete" | "tap";
  value?: unknown;
};

type Env = { value?: unknown; index?: number };

export function runMachine(
  machine: RslMachine,
  onEvent: (e: StreamEvent) => void,
  opts?: { maxMs?: number },
): () => void {
  const t0 = performance.now();
  const stamp = () => Math.round(performance.now() - t0);
  let obs: Observable<unknown>;
  try {
    obs = chain(machine.StartAt, machine, {});
  } catch (err) {
    onEvent({ t: 0, kind: "error", value: err instanceof Error ? err.message : String(err) });
    return () => undefined;
  }
  const limiter = timer(opts?.maxMs ?? 4500);
  const sub = obs.pipe(takeUntil(limiter)).subscribe({
    next: (value) => onEvent({ t: stamp(), kind: "next", value }),
    error: (err) =>
      onEvent({
        t: stamp(),
        kind: "error",
        value: err instanceof Error ? err.message : String(err),
      }),
    complete: () => onEvent({ t: stamp(), kind: "complete" }),
  });
  return () => sub.unsubscribe();
}

function chain(name: string, machine: RslMachine, env: Env): Observable<unknown> {
  const s = machine.States[name];
  if (!s) return throwError(() => new Error(`Unknown state "${name}"`));
  let current = produce(name, machine, env);
  let node: RslState | undefined = s;
  while (node && node.Next && !node.End && node.Type !== "Sink") {
    const nxt: RslState | undefined = machine.States[node.Next];
    if (!nxt) break;
    if (nxt.Type === "Pipe") {
      current = applyPipe(current, nxt);
      node = nxt;
      continue;
    }
    if (nxt.Type === "FlatMap") {
      current = applyFlatMap(current, nxt);
      node = nxt;
      continue;
    }
    if (nxt.Type === "Sink") break;
    break;
  }
  return current;
}

function produce(name: string, machine: RslMachine, env: Env): Observable<unknown> {
  const s = machine.States[name];
  if (!s) return throwError(() => new Error(`Unknown state "${name}"`));
  if (s.Type === "Source") return withOutput(makeSource(s, env), s);
  if (s.Type === "Combine") {
    const parts = s.Sources.map((src) => chain(src, machine, env));
    return withOutput(combine(s.Strategy, parts), s);
  }
  return throwError(() => new Error(`"${name}" cannot start a stream (Type ${s.Type})`));
}

function makeSource(s: Extract<RslState, { Type: "Source" }>, env: Env): Observable<unknown> {
  switch (s.Operator) {
    case "of": {
      const values = Array.isArray(s.Arguments?.values) ? s.Arguments.values : [];
      const resolved = values.map((v) => resolveArgValue(v, env));
      return of(...resolved);
    }
    case "from": {
      const values = Array.isArray(s.Arguments?.values) ? s.Arguments.values : [];
      const resolved = values.map((v) => resolveArgValue(v, env));
      return from(resolved);
    }
    case "interval":
      return interval(Number(s.Arguments?.period ?? 1000));
    case "range":
      return range(Number(s.Arguments?.start ?? 0), Number(s.Arguments?.count ?? 5));
    case "timer":
      return timer(Number(s.Arguments?.due ?? 0));
    default:
      return EMPTY;
  }
}

function combine(strategy: CombineStrategy, parts: Observable<unknown>[]): Observable<unknown> {
  switch (strategy) {
    case "merge":
      return merge(...parts);
    case "concat":
      return concat(...parts);
    case "race":
      return race(parts);
    case "combineLatest":
      return combineLatest(parts);
    case "zip":
      return zip(...parts);
    case "forkJoin":
      return forkJoin(parts);
    default:
      return merge(...parts);
  }
}

function applyPipe(input: Observable<unknown>, s: Extract<RslState, { Type: "Pipe" }>): Observable<unknown> {
  let out = input;
  switch (s.Operator) {
    case "map":
      out = input.pipe(map((value, index) => evalProject(s.Project, value, { index })));
      break;
    case "filter":
      out = input.pipe(filter((value, index) => Boolean(evalProject(s.Project, value, { index }))));
      break;
    case "tap":
      out = input.pipe(tap((value) => evalProject(s.Project, value)));
      break;
    case "take":
      out = input.pipe(take(Number(s.Arguments?.count ?? 1)));
      break;
    case "skip":
      out = input.pipe(skip(Number(s.Arguments?.count ?? 1)));
      break;
    case "scan":
      out = input.pipe(
        scan(
          (acc: unknown, value: unknown, index: number) =>
            evalProject(s.Project, value, { index, acc }),
          (s.Arguments?.seed ?? 0) as unknown,
        ),
      );
      break;
    case "debounceTime":
      out = input.pipe(debounceTime(Number(s.Arguments?.due ?? 0)));
      break;
    default:
      break;
  }
  return withOutput(out, s);
}

function applyFlatMap(
  input: Observable<unknown>,
  s: Extract<RslState, { Type: "FlatMap" }>,
): Observable<unknown> {
  const project = (value: unknown, index: number): Observable<unknown> => {
    if (typeof s.Project === "string") {
      return of(evalProject(s.Project, value, { index }));
    }
    return chain(s.Project.StartAt, s.Project, { value, index });
  };
  let mapped: Observable<unknown>;
  switch (s.Flatten) {
    case "merge":
      mapped = input.pipe(mergeMap(project));
      break;
    case "concat":
      mapped = input.pipe(concatMap(project));
      break;
    case "exhaust":
      mapped = input.pipe(exhaustMap(project));
      break;
    case "switch":
    default:
      mapped = input.pipe(switchMap(project));
      break;
  }
  return withOutput(mapped, s);
}

function withOutput(obs: Observable<unknown>, s: RslState): Observable<unknown> {
  if (!s.Output) return obs;
  return obs.pipe(map((value) => evalProject(s.Output, value)));
}
