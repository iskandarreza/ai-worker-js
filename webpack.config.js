const Dotenv = require('dotenv-webpack')
const path = require('path')
const fs = require('fs')

module.exports = {
  mode: 'production',
  entry: getEntryPoints('./workers'),
  output: {
    path: path.resolve('./public/workers'),
    filename: '[name].js',
    libraryTarget: 'global',
  },
  module: {
    rules: [
      {
        test: /\.worker\.js?$/,
        exclude: /(node_modules)/,
        use: 'babel-loader',
      },
    ],
  },
  resolve: {
    extensions: ['.worker.js', '.js', '.d.ts'],
    fallback: {
      path: require.resolve('path-browserify'),
    },
  },
  plugins: [
    new Dotenv({
      path: './.env.local',
    }),
  ],
}

function getEntryPoints(directory) {
  const entryPoints = {}
  const files = fs.readdirSync(directory)

  files.forEach((file) => {
    const name = path.parse(file).name
    const entryName = name.replace(/\.worker$/, '') // Remove the '.worker' extension
    const libraryOptions = generateLibraryOptions(entryName)
    entryPoints[entryName] = {
      import: path.resolve(directory, file),
      library: libraryOptions,
    }
  })

  return entryPoints
}

function generateLibraryOptions(entryName) {
  const sanitized = entryName.replace(/[^a-zA-Z0-9_]/g, '_')
  const libraryName = `lib_${sanitized}`
  return {
    type: 'var',
    name: libraryName,
  }
}
