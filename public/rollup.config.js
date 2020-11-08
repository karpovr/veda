import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import {terser} from 'rollup-plugin-terser';

export default {
  input: 'main.js',
  output: [
    {
      file: 'main.bundle.js',
      format: 'system'
    },
    {
      file: 'main.bundle.min.js',
      format: 'iife',
      name: 'version',
      plugins: [terser()]
    }
  ],
  plugins: [
    nodeResolve({
      //module: true,
      browser: true
    }),
    commonjs({
      include: ['node_modules/**']
    }),
    json()
  ],
  preserveEntrySignatures: false
};