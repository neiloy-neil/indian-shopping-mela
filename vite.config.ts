import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      server: { entry: "server" },
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
    }),
    nitro({
      preset: "vercel",
    }),
  ],
  ssr: {
    // This is not specific to Stripe: Nitro's Rollup-based chunk splitter (Vercel preset)
    // was found breaking multiple different externalized-dependency shared chunks in
    // production — first @stripe/react-stripe-js, then react+@tanstack/react-query —
    // each crashing every SSR request with "TypeError: __commonJSMin is not a function"
    // because the chunk split separated a package's CJS→ESM interop helper from the code
    // that calls it. Rather than allowlist packages one at a time as each one breaks,
    // bundle everything through Vite's own SSR transform instead of externalizing.
    noExternal: true,
  },
});
