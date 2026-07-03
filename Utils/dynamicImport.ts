// tsc's CommonJS output rewrites a literal `import()` expression into
// `Promise.resolve().then(() => require(...))`, which throws ERR_REQUIRE_ESM
// against a pure-ESM package (verified empirically: @xenova/transformers and
// pgvector are both `"type": "module"` with no CommonJS export condition).
// Hiding the `import()` inside a `new Function(...)` body makes it invisible
// to tsc's static rewrite, so this is a genuine, unmodified dynamic import at
// runtime -- the only way to load an ESM-only dependency from CommonJS
// output without switching the whole project to ESM/NodeNext.
const dynamicImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string
) => Promise<any>;

export default dynamicImport;
