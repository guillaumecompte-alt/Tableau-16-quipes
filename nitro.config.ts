import { defineConfig } from "nitro";

export default defineConfig({
  cloudflare: {
    wrangler: {
      // Preserve variables configured in the Cloudflare dashboard during deploys.
      keep_vars: true,
    },
  },
});
