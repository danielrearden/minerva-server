module.exports = {
  globals: {
    DATABASE_URL: process.env.DATABASE_URL || 'postgres://postgres@localhost:5432/postgres',
  },
  testPathIgnorePatterns: [
    '/node_modules/',
  ],
  collectCoverageFrom: [
    'lib/**/*.js',
  ],
}
