import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { terser } from 'rollup-plugin-terser';

export default {
  input: 'js/server/main.js',
  output: [
    {
      file: '../public/js/server/server.js',
      format: 'iife',
      name: 'veda',
      plugins: [
        terser(),
      ],
    },
  ],
  plugins: [
    nodeResolve({
      //module: true,
      browser: true,
    }),
    commonjs({
      include: ['node_modules/**'],
    }),
    json(),
  ],
  onwarn(warning, warn) {
    if (warning.code === 'EVAL') return;
    if (warning.code === 'CIRCULAR_DEPENDENCY') return;
    warn(warning);
  },
};