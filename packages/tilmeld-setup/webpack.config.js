const path = require('path');
const sveltePreprocess = require('svelte-preprocess');

module.exports = {
  mode: 'production',
  devtool: 'source-map',
  entry: {
    TilmeldSetupApp: './app/index.mjs',
  },
  output: {
    path: path.resolve(__dirname, 'dist', 'app'),
    filename: 'index.js',
  },
  resolve: {
    alias: {
      svelte: path.dirname(require.resolve('svelte/package.json')),
    },
    extensions: ['.mjs', '.js', '.ts', '.svelte'],
    mainFields: ['svelte', 'browser', 'module', 'main'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: 'ts-loader',
      },
      {
        test: /\.svelte$/,
        use: {
          loader: 'svelte-loader',
          options: {
            preprocess: sveltePreprocess(),
          },
        },
      },
    ],
  },
};
