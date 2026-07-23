import { defineConfig } from 'astro/config';
import cloudflare from "@astrojs/cloudflare";
export default defineConfig({
  site: 'https://kremenets-monastyr.org',
  output: 'static',
  adapter: cloudflare()
});