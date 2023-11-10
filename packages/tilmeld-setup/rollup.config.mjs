import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import preprocess from 'svelte-preprocess';

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
      emitCss: false,
      preprocess: preprocess({
        typescript: {
          handleMixedImports: true,
          tsconfigFile: 'tsconfig.json',
        },
      }),
    }),
  ],
};
