module.exports = {
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
    extends: [
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended',
      'prettier'
    ],
    rules: {
      // Add custom rules here
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ['error', { 
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_',
        'caughtErrorsIgnorePattern': '^_'
      }],
      "@typescript-eslint/ban-ts-comment": "off"
    },
  };