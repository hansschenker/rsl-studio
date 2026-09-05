import type { NodeType } from "./types";

export type CatalogEntry = {
  id: NodeType;
  n: string;
  title: string;
  ports: string;
  rx: string;
  asl: string;
  body: string;
  sample: string;
};

export const CATALOG: CatalogEntry[] = [
  {
    id: "Source",
    n: "1",
    title: "Source",
    ports: "output only",
    rx: "of, interval, from, range, timer",
    asl: "StartAt — a state that emits without an upstream",
    body: "A source has no input function. It creates a stream and exposes only an output. Wire that output with Next.",
    sample: `{
  "Ticks": {
    "Type": "Source",
    "Operator": "interval",
    "Arguments": { "period": 1000 },
    "Next": "Double"
  }
}`,
  },
  {
    id: "Pipe",
    n: "2",
    title: "Pipe",
    ports: "input + output",
    rx: "map, filter, take, scan, tap",
    asl: "Task / Pass — unary step on the flowing value",
    body: "A pipeline node consumes the previous output and produces a new output. Project is a JSONata expression over $value.",
    sample: `{
  "Double": {
    "Type": "Pipe",
    "Operator": "map",
    "Project": "{% $value * 2 %}",
    "Next": "Even"
  }
}`,
  },
  {
    id: "Sink",
    n: "3",
    title: "Sink",
    ports: "input only",
    rx: "subscribe, forEach",
    asl: "Succeed / Fail — a terminal state",
    body: "A sink has no output function. It is the subscriber: values enter and the machine ends.",
    sample: `{
  "Log": {
    "Type": "Sink",
    "Operator": "subscribe"
  }
}`,
  },
  {
    id: "Combine",
    n: "4",
    title: "Combine",
    ports: "many sources → one source",
    rx: "merge, combineLatest, zip, concat, race, forkJoin",
    asl: "Parallel — several branches, one joined result",
    body: "Name two or more Source (or nested) states in Sources. Strategy is how their outputs become a single stream. Combine itself is a source: it has no input port.",
    sample: `{
  "Pair": {
    "Type": "Combine",
    "Strategy": "zip",
    "Sources": ["Left", "Right"],
    "Next": "Product"
  }
}`,
  },
  {
    id: "FlatMap",
    n: "5",
    title: "FlatMap",
    ports: "input → inner pipeline → output",
    rx: "mergeMap, concatMap, switchMap, exhaustMap",
    asl: "Map + ItemProcessor — a nested state machine per value",
    body: "The four special pipeline nodes. Each has an input, a Project function that returns an inner pipeline (a nested RSL machine, itself a source), and an output of flattened inner values. Flatten picks which of the four.",
    sample: `{
  "Search": {
    "Type": "FlatMap",
    "Flatten": "switch",
    "Project": {
      "StartAt": "Hit",
      "States": {
        "Hit": {
          "Type": "Source",
          "Operator": "of",
          "Arguments": { "values": ["{% $value %}"] },
          "End": true
        }
      }
    },
    "Next": "Log"
  }
}`,
  },
];

export const FLATTEN_NOTES = [
  {
    id: "merge",
    rx: "mergeMap",
    line: "Subscribe to every inner pipeline. Values interleave.",
  },
  {
    id: "concat",
    rx: "concatMap",
    line: "Run inner pipelines in order; wait for each to complete.",
  },
  {
    id: "switch",
    rx: "switchMap",
    line: "On a new outer value, unsubscribe the previous inner pipeline.",
  },
  {
    id: "exhaust",
    rx: "exhaustMap",
    line: "Ignore new outer values while an inner pipeline is still running.",
  },
] as const;
