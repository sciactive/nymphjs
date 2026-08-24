import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';
// This doesn't work with TS7
// import typescript from '@rollup/plugin-typescript';
import sucrase from '@rollup/plugin-sucrase';
import commonjs from '@rollup/plugin-commonjs';
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
    // typescript(),
    sucrase({
      exclude: ['node_modules/**'],
      include: ['**/*.ts', '**/*.tsx', '**/*.mts'],
      transforms: ['typescript'],
    }),
    svelte({
      emitCss: true,
    }),
    postcss({
      extract: true,
    }),
  ],
};
