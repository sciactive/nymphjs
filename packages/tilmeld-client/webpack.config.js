const path = require('path');

module.exports = {
  mode: 'production',
  devtool: 'source-map',
  entry: {
    TilmeldClient: './lib/index.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'index.js',
    library: ['@nymphjs/tilmeld-client'],
    libraryTarget: 'umd',
    globalObject: 'this',
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  externals: {
    '@nymphjs/client': '@nymphjs/client',
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
};
