const { GraphQLUpload, makeExecutableSchema } = require('apollo-server-express')
const { applyMiddleware } = require('graphql-middleware')

const directives = require('./directives')
const scalars = require('./scalars')
const { mergeTypeDefs } = require('./merge-type-defs')
const { BaseSchemaBuilder } = require('./base-schema-builder')

function generateSchema (sequelize, options) {
  const { resolvers = {}, schemaDirectives = {}, uploads = true, middleware = [], crud } = options
  const baseSchemaBuilder = new BaseSchemaBuilder()
  const { schema, typeDefs: baseTypeDefs, resolvers: baseResolvers } = baseSchemaBuilder.build(sequelize, { crud })
  const typeDefs = Array.isArray(options.typeDefs) ? options.typeDefs : (options.typeDefs ? [options.typeDefs] : [])

  const scalarDefinitions = Object.keys(scalars).reduce((memo, s) => {
    const scalar = scalars[s]
    if (!schema.getType(scalar.name)) {
      memo += `scalar ${scalar.name}\n`
    }
    return memo
  }, '')
  const scalarMap = Object.keys(scalars).reduce((memo, s) => {
    const scalar = scalars[s]
    if (!schema.getType(scalar.name)) {
      memo[scalar.name] = scalars[s]
    }
    return memo
  }, {})

  typeDefs.push(`
    ${uploads ? 'scalar Upload' : ''}
    ${scalarDefinitions}

    directive @paginate(
      type: String
      filter: Boolean = true
      sort: Boolean = true
    ) on FIELD_DEFINITION
    directive @sort(
      type: String
    ) on FIELD_DEFINITION
    directive @filter(
      type: String
    ) on FIELD_DEFINITION
    directive @withErrors(
      field: String
    ) on FIELD_DEFINITION

    ${baseTypeDefs}
  `)

  if (uploads) {
    resolvers.Upload = GraphQLUpload
  }

  const executableSchema = makeExecutableSchema({
    resolverValidationOptions: {
      requireResolversForResolveType: false,
    },
    typeDefs: mergeTypeDefs(typeDefs),
    resolvers: {
      ...baseResolvers,
      ...scalarMap,
      ...resolvers,
    },
    schemaDirectives: {
      ...directives,
      ...schemaDirectives,
    },
  })

  applyMiddleware(executableSchema, ...middleware)

  return executableSchema
}

module.exports = {
  generateSchema,
}
