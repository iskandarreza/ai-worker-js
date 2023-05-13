const CopyWebpackPlugin = require('copy-webpack-plugin')

module.exports = {
  webpack: (config) => {
    config.module.rules.push({
      test: /\.worker\.js$/,
      use: {
        loader: 'worker-loader',
        options: {
          filename: '[name].worker.js',
          publicPath: '/public/',
          worker: {
            type: 'module',
          },
        },
      },
    })

    config.plugins.push(
      new CopyWebpackPlugin({
        patterns: [
          { from: 'workers', to: '../public/workers/', toType: 'dir' },
        ],
      })
    )

    return config
  },
}
