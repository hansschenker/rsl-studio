export const RSL_VERSION = "1.0";

export const NODE_TYPES = ["Source", "Pipe", "Combine", "FlatMap", "Sink"] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export const SOURCE_OPERATORS = ["of", "from", "interval", "range", "timer"] as const;
export type SourceOperator = (typeof SOURCE_OPERATORS)[number];

export const PIPE_OPERATORS = [
  "map",
  "filter",
  "tap",
  "take",
  "skip",
  "scan",
  "debounceTime",
] as const;
export type PipeOperator = (typeof PIPE_OPERATORS)[number];

export const COMBINE_STRATEGIES = [
  "merge",
  "combineLatest",
  "zip",
  "concat",
  "race",
  "forkJoin",
] as const;
export type CombineStrategy = (typeof COMBINE_STRATEGIES)[number];

/** The four special pipeline nodes — flattening maps. */
export const FLATTEN_STRATEGIES = ["merge", "concat", "switch", "exhaust"] as const;
export type FlattenStrategy = (typeof FLATTEN_STRATEGIES)[number];

export const FLATTEN_TO_RXJS: Record<FlattenStrategy, string> = {
  merge: "mergeMap",
  concat: "concatMap",
  switch: "switchMap",
  exhaust: "exhaustMap",
};

export interface RslMachine {
  Comment?: string;
  QueryLanguage?: "JSONata";
  Version?: string;
  StartAt: string;
  States: Record<string, RslState>;
}

interface StateBase {
  Comment?: string;
  Next?: string;
  End?: boolean;
  Output?: string;
}

export interface SourceState extends StateBase {
  Type: "Source";
  Operator: SourceOperator;
  Arguments?: Record<string, unknown>;
}

export interface PipeState extends StateBase {
  Type: "Pipe";
  Operator: PipeOperator;
  Arguments?: Record<string, unknown>;
  Project?: string;
}

export interface CombineState extends StateBase {
  Type: "Combine";
  Strategy: CombineStrategy;
  Sources: string[];
}

export interface FlatMapState extends StateBase {
  Type: "FlatMap";
  Flatten: FlattenStrategy;
  Project: string | RslMachine;
}

export interface SinkState extends StateBase {
  Type: "Sink";
  Operator?: "subscribe";
  NextHandler?: string;
  ErrorHandler?: string;
  CompleteHandler?: string;
}

export type RslState =
  | SourceState
  | PipeState
  | CombineState
  | FlatMapState
  | SinkState;

export type Issue = { path: string; message: string };
