const path = require('path');
const sveltePreprocess = require('svelte-preprocess');

module.exports = {
  mode: 'production',
  devtool: 'source-map',
  entry: {
    TilmeldComponents: './src/index.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'index.cjs',
  },
  resolve: {
    extensions: ['.mjs', '.js', '.ts', '.svelte'],
    mainFields: ['svelte', 'browser', 'module', 'main'],
  },
  module: {
    rules: [
      {
        test: /\.svelte$/,
        use: {
          loader: 'svelte-loader',
          options: {
            preprocess: sveltePreprocess(),
          },
        },
      },
      {
        test: /\.ts$/,
        loader: 'ts-loader',
      },
    ],
  },
};
