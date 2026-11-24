import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { setLang } from '../i18n';

// jsdom reports an English browser; the suite is written against the Spanish
// copy, so every test starts in Spanish unless it switches on purpose.
beforeEach(() => setLang('es'));
afterEach(() => cleanup());
