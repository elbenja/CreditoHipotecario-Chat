import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Load the repo-root .env regardless of cwd. The API runs both from the repo
// root and from apps/api (`pnpm --filter @chat/api exec`), and dotenv's default
// resolves against process.cwd(), so a root .env is invisible from apps/api.
// Real environment variables still win — dotenv does not override them.
const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, '../../../.env') });
