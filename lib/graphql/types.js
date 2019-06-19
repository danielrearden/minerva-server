const {
  GraphQLObjectType,
  GraphQLEnumType,
  GraphQLBoolean,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLString,
} = require('graphql')

const PageInfoType = new GraphQLObjectType({
  name: 'PageInfo',
  description: 'Information about pagination in a page.',
  fields: () => ({
    hasNextPage: {
      type: new GraphQLNonNull(GraphQLBoolean),
      description: 'When paginating forwards, are there more items?',
    },
    hasPreviousPage: {
      type: new GraphQLNonNull(GraphQLBoolean),
      description: 'When paginating backwards, are there more items?',
    },
    pageCount: {
      type: new GraphQLNonNull(GraphQLInt),
      description: 'Number of pages.',
    },
    totalCount: {
      type: new GraphQLNonNull(GraphQLInt),
      description: 'Total number of results across all pages.',
    },
  }),
})

const SortDirectionEnum = new GraphQLEnumType({
  name: 'SortDirection',
  values: {
    ASC: {
      value: 'ASC',
    },
    DESC: {
      value: 'DESC',
    },
  },
})

const ClientErrorType = new GraphQLObjectType({
  name: 'ClientError',
  fields: () => ({
    field: {
      type: GraphQLString,
    },
    message: {
      type: new GraphQLNonNull(GraphQLString),
    },
    code: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: (error) => error.code || 'INTERNAL_SERVER',
    },
  }),
})

module.exports = {
  PageInfoType,
  SortDirectionEnum,
  ClientErrorType,
}
