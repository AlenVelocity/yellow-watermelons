import type { NextConfig } from "next";

// wasm-webp's Emscripten glue code has a Node-only branch (dead code in the
// browser, guarded by `if (ENVIRONMENT_IS_NODE)`) that dynamically imports
// Node built-ins. Bundlers still try to statically resolve those specifiers
// for the browser bundle, so alias them there to a no-op shim. This must be
// scoped to the "browser" condition only — aliasing it unconditionally also
// hijacks Next's own legitimate server-side use of these same built-ins.
const nodeBuiltinShim = "./lib/shims/empty.js";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      module: { browser: nodeBuiltinShim },
      fs: { browser: nodeBuiltinShim },
      path: { browser: nodeBuiltinShim },
      url: { browser: nodeBuiltinShim },
    },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        module: false,
        fs: false,
        path: false,
        url: false,
      };
    }
    return config;
  },
};

export default nextConfig;
