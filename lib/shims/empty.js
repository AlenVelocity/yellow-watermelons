// Stub for Node-only built-ins referenced by wasm-webp's Emscripten glue code.
// That code path is guarded by `if (ENVIRONMENT_IS_NODE)` and never runs in the
// browser, but bundlers still try to statically resolve the import — this stub
// just needs to exist, not actually work.
const emptyModule = {};
export default emptyModule;
export const createRequire = () => () => {
  throw new Error("Node built-ins are not available in the browser.");
};
