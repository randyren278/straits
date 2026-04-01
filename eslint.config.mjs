import nextConfig from 'eslint-config-next';

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...nextConfig,
  {
    ignores: ['src/services/ais-ingester/node_modules/**'],
  },
];
