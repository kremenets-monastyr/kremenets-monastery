import { defineConfig } from 'astro/config';
import cloudflare from "@astrojs/cloudflare";
export default defineConfig({
  site: 'https://example.org',
  output: 'static',
  adapter: cloudflare()
});