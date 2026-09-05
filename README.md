# RSL Studio

A small language and workbench for **drawing RxJS programs as JSON**.

You do not need to know Amazon States Language (ASL) to use this. RSL stands for **Reactive States Language**. RSL Studio is the editor around it: write a document, see the pipeline as a graph, compile it to RxJS, and run the stream.

<!-- co-author: SuperGrok (x.com) -->

## What problem this solves

RxJS is a library for **values over time** — clicks, ticks, HTTP responses, arrays played as a sequence. A typical program looks like this:

```js
from([1, 2, 3, 4, 5]).pipe(
  map((n) => n * 2),
  filter((n) => n > 4),
).subscribe((n) => console.log(n));
```

That is easy when it is three lines. Real pipelines grow: several inputs join, inner requests nest, values get filtered and mapped. The *shape* of the program is a graph, but the code is a chain of function calls. RSL makes that graph explicit.

## The idea in one sentence

**Name each step. Say how it connects to the next. Save that as JSON. Run it as RxJS.**

Each step is a *state*. The document says where to start (`StartAt`) and, for every state, which state comes `Next`. That is the same *shape* AWS uses for Step Functions (ASL) — a flowchart in JSON — but here the flowchart is an RxJS pipeline, not a cloud workflow. You never have to learn ASL; RSL only borrowed the “named boxes + Next arrows” style.

## Five kinds of box

Every RxJS program is built from a handful of shapes. RSL names those five:

| Kind | Everyday meaning | RxJS examples |
| --- | --- | --- |
| **Source** | A tap that produces values. No input, only output. | `from`, `of`, `interval` |
| **Pipe** | A transformer. Values go in, different values come out. | `map`, `filter`, `take` |
| **Sink** | The end. Values go in; nothing comes out. Usually `subscribe`. | `subscribe` |
| **Combine** | Several taps joined into one tap. | `zip`, `merge`, `combineLatest` |
| **FlatMap** | For each value, start a *new inner pipeline*, then flatten the results. Four flavours: merge, concat, switch, exhaust. | `mergeMap`, `concatMap`, `switchMap`, `exhaustMap` |

Wire them with `Next`. Expressions use `{% $value * 2 %}` (JSONata-style) over the current value.

## A first document

The JavaScript above is this RSL machine. It emits **6, 8, 10**.

```json
{
  "QueryLanguage": "JSONata",
  "Version": "1.0",
  "StartAt": "xs",
  "States": {
    "xs": {
      "Type": "Source",
      "Operator": "from",
      "Arguments": { "values": [1, 2, 3, 4, 5] },
      "Next": "Double"
    },
    "Double": {
      "Type": "Pipe",
      "Operator": "map",
      "Project": "{% $value * 2 %}",
      "Next": "GreaterThanFour"
    },
    "GreaterThanFour": {
      "Type": "Pipe",
      "Operator": "filter",
      "Project": "{% $value > 4 %}",
      "Next": "Log"
    },
    "Log": {
      "Type": "Sink",
      "Operator": "subscribe",
      "NextHandler": "log"
    }
  }
}
```

Read it top to bottom: start at `xs`, double each number, keep those greater than 4, log the rest.

## What RSL Studio does

RSL is the JSON language. **RSL Studio** is the app that lets you:

1. **Write** an RSL document
2. **See** it as a graph (boxes and arrows)
3. **Compile** it to RxJS
4. **Run** the stream and watch emissions

Pick an example, press **Run stream**, and watch values appear.

## Why “states language”?

A *state machine* is just a list of named places and the rule for moving from one place to the next. AWS Step Functions describe cloud jobs that way (Amazon States Language). RSL uses the same idea for reactive streams: each RxJS operator is a state, `Next` is the subscription to the next operator. If you have never used AWS, ignore that history — the five boxes above are the whole model.

## Run

```bash
npm install
npm run dev
```

Then open the URL Vite prints (port `8080` by default).

## Layout

- `src/lib/rsl/` — language types, parse, compile to RxJS, runtime
- `src/components/rsl/` — studio UI and pipeline graph
- Examples live in `src/lib/rsl/examples.ts`

## Authors

- Hans Schenker
- Co-author: SuperGrok Build — [x.com](https://x.com) (`supergrok@x.com`)
