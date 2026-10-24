/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import { fileURLToPath } from "node:url";
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  output: process.env.DOCKER_OUTPUT ? "standalone" : undefined,
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
  outputFileTracingIncludes: {
    "/docs/[[...slug]]": ["../docs/**/*"],
    "/docs/assets/[...path]": ["../docs/images/**/*", "../docs/logo/**/*"],
  },
  serverExternalPackages: ["pg-boss"],
  transpilePackages: ["@usesend/ui"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.gravatar.com",
      },
    ],
  },
};

export default config;
