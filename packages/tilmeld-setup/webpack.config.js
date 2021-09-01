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
    extensions: ['.mjs', '.js', '.svelte'],
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
    ],
  },
};
