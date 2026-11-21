// @ts-check
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      '.claude/**',
      'test-results/**',
      'playwright-report/**',
      'perf-results/**',
      // Wegwerf-Probe für die Apple TV (CHAOS-135): Einstieg nur für den esbuild-Bündel.
      'spikes/apple-host-probe/**',
      // Nativer Apple-Host (CHAOS-139): Xcode-Build und kopierte Bündel.
      'apps/apple-host/build/**',
      'apps/apple-host/payload/**',
      // Renderer-Spike (CHAOS-75): Rust-Build, wasm-bindgen-Ausgabe und exportierte Szene.
      'spikes/renderer-bevy/target/**',
      'spikes/renderer-bevy/web/pkg-*/**',
      'spikes/renderer-bevy/web/assets/**',
      'spikes/renderer-bevy/assets/**',
      // Blender als Python-Modul (ADR-013), lokal und nicht im Repository.
      '.venv-blender/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    files: ['apps/host/src/**/*.{ts,tsx}', 'apps/controller/src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat['recommended-latest'], reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
  },
  {
    // Host im Browser: Minispiel-Module nur je Spiel bei Bedarf laden (CHAOS-86), sonst wächst
    // die Minispiel-Bühne mit dem Katalog. `pnpm check:bundle` prüft das zusätzlich am Build.
    files: ['apps/host/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@chaos-party/minigames',
              message:
                'Steckbriefe aus `@chaos-party/minigames/catalog`, Module über `@chaos-party/minigames/lazy` (CHAOS-86).',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'apps/server/**/*.{ts,mjs}',
      'apps/apple-host/*.mjs',
      'apps/apple-host/scripts/**/*.mjs',
      'scripts/**/*.mjs',
      '*.{js,ts,mjs}',
    ],
    languageOptions: { globals: globals.node },
  },
  prettier,
);
