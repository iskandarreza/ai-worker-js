import commonjs from '@rollup/plugin-commonjs'
import wasm from '@rollup/plugin-wasm'
import nodePolyfills from 'rollup-plugin-polyfill-node'

export default {
  input: './src/openai.model.js',
  output: {
    file: 'workers/bundles/openai-bundle.js',
    format: 'iife',
    sourcemap: true,
  },
  plugins: [commonjs(), wasm(), nodePolyfills({ include: ['path'] })],
}
