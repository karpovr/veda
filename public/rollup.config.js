import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
//import {terser} from 'rollup-plugin-terser';

export default {
  input: 'src/js/server/main.js',
  output: [
    {
      file: 'dist/js/server/server.bundle.js',
      format: 'iife',
      name: 'veda'
    },
    /*{
      file: 'dist/js/server.bundle.min.js',
      format: 'iife',
      name: 'veda',
      plugins: [terser()]
    }*/
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
};