const path = require('path');

module.exports = {
  mode: 'production',
  devtool: 'source-map',
  entry: {
    NymphClient: './lib/index.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'index.js',
    library: ['nymph-client'],
    libraryTarget: 'umd',
    globalObject: 'this',
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
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
