const SriPlugin = require('webpack-subresource-integrity');

module.exports = {
  transpileDependencies: [
    'vuetify'
  ],
  configureWebpack: {
    output: {
      crossOriginLoading: 'anonymous',
    },
    plugins: [
      new SriPlugin({
        hashFuncNames: ['sha384'],
        enabled: process.env.NODE_ENV === 'production',
      })
    ]
  }
}