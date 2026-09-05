import type { RslMachine } from "./types";

export interface Example {
  id: string;
  title: string;
  blurb: string;
  kinds: string;
  machine: RslMachine;
}

export const EXAMPLES: Example[] = [
  {
    id: "from-map-filter",
    title: "from → map → filter",
    blurb: "from([1,2,3,4,5]), double, keep values greater than 4, subscribe.",
    kinds: "1 · 2 · 3",
    machine: {
      Comment: "from([1,2,3,4,5]).pipe(map(n => n * 2), filter(n => n > 4)).subscribe(n => console.log(n))",
      QueryLanguage: "JSONata",
      Version: "1.0",
      StartAt: "xs",
      States: {
        xs: {
          Type: "Source",
          Operator: "from",
          Arguments: { values: [1, 2, 3, 4, 5] },
          Comment: "output only",
          Next: "Double",
        },
        Double: {
          Type: "Pipe",
          Operator: "map",
          Project: "{% $value * 2 %}",
          Comment: "input + output",
          Next: "GreaterThanFour",
        },
        GreaterThanFour: {
          Type: "Pipe",
          Operator: "filter",
          Project: "{% $value > 4 %}",
          Comment: "input + output",
          Next: "Log",
        },
        Log: {
          Type: "Sink",
          Operator: "subscribe",
          NextHandler: "log",
          Comment: "input only",
        },
      },
    },
  },
  {
    id: "pulse",
    title: "Pulse",
    blurb: "Source → Pipe → Sink. A clock, doubled, even values only.",
    kinds: "1 · 2 · 3",
    machine: {
      Comment: "Types 1–3: a source, unary pipes, a sink",
      QueryLanguage: "JSONata",
      Version: "1.0",
      StartAt: "Ticks",
      States: {
        Ticks: {
          Type: "Source",
          Operator: "interval",
          Arguments: { period: 350 },
          Comment: "Output only — no input port",
          Next: "Double",
        },
        Double: {
          Type: "Pipe",
          Operator: "map",
          Project: "{% $value * 2 %}",
          Comment: "Input and output",
          Next: "Even",
        },
        Even: {
          Type: "Pipe",
          Operator: "filter",
          Project: "{% $value % 2 = 0 %}",
          Next: "Limit",
        },
        Limit: {
          Type: "Pipe",
          Operator: "take",
          Arguments: { count: 6 },
          Next: "Log",
        },
        Log: {
          Type: "Sink",
          Operator: "subscribe",
          Comment: "Input only — terminal",
        },
      },
    },
  },
  {
    id: "fanin",
    title: "Fan-in",
    blurb: "Two sources zip into one source, then a sink.",
    kinds: "4",
    machine: {
      Comment: "Type 4: many sources combined to a single source",
      QueryLanguage: "JSONata",
      Version: "1.0",
      StartAt: "Pair",
      States: {
        Left: {
          Type: "Source",
          Operator: "of",
          Arguments: { values: [1, 2, 3, 4] },
          End: true,
        },
        Right: {
          Type: "Source",
          Operator: "of",
          Arguments: { values: [10, 20, 30, 40] },
          End: true,
        },
        Pair: {
          Type: "Combine",
          Strategy: "zip",
          Sources: ["Left", "Right"],
          Next: "Product",
        },
        Product: {
          Type: "Pipe",
          Operator: "map",
          Project: "{% $value[0] * $value[1] %}",
          Next: "Log",
        },
        Log: { Type: "Sink", Operator: "subscribe" },
      },
    },
  },
  {
    id: "switch",
    title: "Switch",
    blurb: "Each outer value cancels the previous inner pipeline.",
    kinds: "5a switch",
    machine: {
      Comment: "Type 5 / switch — the inner Project is itself a source",
      QueryLanguage: "JSONata",
      Version: "1.0",
      StartAt: "Queries",
      States: {
        Queries: {
          Type: "Source",
          Operator: "of",
          Arguments: { values: ["rx", "rxjs", "rsl"] },
          Next: "Search",
        },
        Search: {
          Type: "FlatMap",
          Flatten: "switch",
          Comment: "Input → Project(inner pipeline) → output",
          Project: {
            StartAt: "Hit",
            States: {
              Hit: {
                Type: "Source",
                Operator: "of",
                Arguments: { values: ["{% 'hit:' & $string($value) %}"] },
                End: true,
              },
            },
          },
          Next: "Log",
        },
        Log: { Type: "Sink", Operator: "subscribe" },
      },
    },
  },
  {
    id: "concat",
    title: "Concat",
    blurb: "Inner pipelines run one after another, in order.",
    kinds: "5b concat",
    machine: {
      Comment: "Type 5 / concat — queue inner work",
      QueryLanguage: "JSONata",
      Version: "1.0",
      StartAt: "Jobs",
      States: {
        Jobs: {
          Type: "Source",
          Operator: "of",
          Arguments: { values: ["A", "B", "C"] },
          Next: "Queue",
        },
        Queue: {
          Type: "FlatMap",
          Flatten: "concat",
          Project: {
            StartAt: "Job",
            States: {
              Job: {
                Type: "Source",
                Operator: "of",
                Arguments: { values: ["{% 'job-' & $string($value) %}"] },
                End: true,
              },
            },
          },
          Next: "Log",
        },
        Log: { Type: "Sink", Operator: "subscribe" },
      },
    },
  },
  {
    id: "merge",
    title: "Merge",
    blurb: "Inner pipelines subscribe together; values interleave.",
    kinds: "5c merge",
    machine: {
      Comment: "Type 5 / merge — concurrent inners",
      QueryLanguage: "JSONata",
      Version: "1.0",
      StartAt: "Ids",
      States: {
        Ids: {
          Type: "Source",
          Operator: "of",
          Arguments: { values: [1, 2, 3] },
          Next: "All",
        },
        All: {
          Type: "FlatMap",
          Flatten: "merge",
          Project: {
            StartAt: "Item",
            States: {
              Item: {
                Type: "Source",
                Operator: "of",
                Arguments: { values: ["{% 'n=' & $string($value) %}"] },
                End: true,
              },
            },
          },
          Next: "Log",
        },
        Log: { Type: "Sink", Operator: "subscribe" },
      },
    },
  },
  {
    id: "exhaust",
    title: "Exhaust",
    blurb: "Ignore new outer values while an inner pipeline is live.",
    kinds: "5d exhaust",
    machine: {
      Comment: "Type 5 / exhaust — drop overlapping work",
      QueryLanguage: "JSONata",
      Version: "1.0",
      StartAt: "Clicks",
      States: {
        Clicks: {
          Type: "Source",
          Operator: "range",
          Arguments: { start: 1, count: 5 },
          Next: "Busy",
        },
        Busy: {
          Type: "FlatMap",
          Flatten: "exhaust",
          Project: {
            StartAt: "Work",
            States: {
              Work: {
                Type: "Source",
                Operator: "of",
                Arguments: { values: ["{% 'busy-' & $string($value) %}"] },
                End: true,
              },
            },
          },
          Next: "Log",
        },
        Log: { Type: "Sink", Operator: "subscribe" },
      },
    },
  },
  {
    id: "full",
    title: "All five",
    blurb: "Combine two sources, pipe, then a flattening map into a sink.",
    kinds: "1–5",
    machine: {
      Comment: "Every RSL node kind in one machine",
      QueryLanguage: "JSONata",
      Version: "1.0",
      StartAt: "Both",
      States: {
        Alpha: {
          Type: "Source",
          Operator: "of",
          Arguments: { values: ["rsl", "rxjs"] },
          End: true,
        },
        Beta: {
          Type: "Source",
          Operator: "of",
          Arguments: { values: [1, 2] },
          End: true,
        },
        Both: {
          Type: "Combine",
          Strategy: "zip",
          Sources: ["Alpha", "Beta"],
          Next: "Label",
        },
        Label: {
          Type: "Pipe",
          Operator: "map",
          Project: "{% $value[0] & '#' & $string($value[1]) %}",
          Next: "Lookup",
        },
        Lookup: {
          Type: "FlatMap",
          Flatten: "concat",
          Project: {
            StartAt: "Echo",
            States: {
              Echo: {
                Type: "Source",
                Operator: "of",
                Arguments: { values: ["{% 'out:' & $string($value) %}"] },
                End: true,
              },
            },
          },
          Next: "Log",
        },
        Log: { Type: "Sink", Operator: "subscribe" },
      },
    },
  },
];

export function pretty(machine: RslMachine): string {
  return JSON.stringify(machine, null, 2);
}
