import tseslint from 'typescript-eslint';
import baseConfig from '../eslint.config.base.mjs';

export default [
  ...tseslint.configs.recommended,
  {
    ignores: ["dist/**/*"],
  },
  baseConfig
];
