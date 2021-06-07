module.exports = {
  'env': {
    'browser': true,
    'es2021': true,
  },
  'extends': [
    'google',
    //'airbnb-base',
  ],
  'parserOptions': {
    'ecmaVersion': 12,
    'sourceType': 'module',
  },
  'rules': {
    'space-before-function-paren': ["error", "always"],
    'max-len': ['off'],
    'camelcase': ['off'],
    'no-unused-vars': ['warn'],
    'no-restricted-globals': ['error'],
    'indent': ['error', 2],
    'no-new-wrappers': ['warn'],
  },
};
