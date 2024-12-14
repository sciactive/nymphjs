import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import { sveltePreprocess } from 'svelte-preprocess';
import postcss from 'rollup-plugin-postcss';

export default {
  input: 'app/index.ts',
  output: {
    file: 'dist/app/index.js',
    format: 'iife',
  },
  plugins: [
    resolve({
      browser: true,
      exportConditions: ['svelte'],
      extensions: ['.svelte', '.mjs', '.js', '.json', '.node'],
      dedupe: ['svelte'],
    }),
    commonjs(),
    typescript(),
    svelte({
      emitCss: true,
      preprocess: sveltePreprocess({
        typescript: {
          verbatimModuleSyntax: true,
          tsconfigFile: 'tsconfig.json',
        },
      }),
    }),
    postcss({
      extract: true,
    }),
  ],
};
