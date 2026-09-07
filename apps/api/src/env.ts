import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Local development only: load the repo-root .env regardless of cwd, because
// the API runs both from the repo root and from apps/api, and dotenv resolves
// against process.cwd(). Real environment variables always win — dotenv does
// not override them.
//
// This must NEVER throw. On a serverless platform there is no .env file and
// `import.meta.url` may not survive bundling; `fileURLToPath(undefined)` throws
// a TypeError at module load, which kills the function before it can run and
// surfaces only as an opaque FUNCTION_INVOCATION_FAILED.
try {
  const here = dirname(fileURLToPath(import.meta.url));
  config({ path: resolve(here, '../../../.env') });
} catch {
  // No module URL, or no .env to find. The platform's environment stands.
}
