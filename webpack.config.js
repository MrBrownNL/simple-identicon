const path = require("path")

module.exports = {
  entry: path.resolve(__dirname, "src/index.ts"),
  devtool: 'inline-source-map',
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "bundle.js",
    library: {
      name: "identicon",
      type: "umd",
    },
  },
  module: {
    rules: [
      {
        test: /\.(js)$/,
        exclude: /node_modules/,
        use: "babel-loader",
      },
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: "ts-loader",
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', 'js']
  },
  mode: "development",
}
