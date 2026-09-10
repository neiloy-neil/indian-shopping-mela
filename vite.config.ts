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
    // @stripe/react-stripe-js ships both a CJS ("main") and ESM ("module") build.
    // Left externalized, Nitro's Rollup-based chunk splitter (Vercel preset) was
    // producing a shared SSR chunk whose CJS→ESM interop helper (__commonJSMin) landed
    // in a different chunk than the code that calls it, crashing every SSR request —
    // checkout.tsx's top-level import pulls this into the shared route-tree bundle even
    // for pages that never render it. Forcing it through Vite's own SSR transform avoids
    // that broken split.
    noExternal: ["@stripe/react-stripe-js", "@stripe/stripe-js"],
  },
});
