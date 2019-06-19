const { makeExecutableSchema } = require('graphql-tools')
const { graphql, printType } = require('graphql')

const withErrors = require('../with-errors')
const { ClientErrorType } = require('../../types')

describe('@withErrors', () => {
  it('should modify the type of the field', async () => {
    const typeDefs = `
      directive @withErrors(
        field: String
      ) on FIELD_DEFINITION

      ${printType(ClientErrorType)}

      type Payload {
        test: String
      }

      type PayloadWithErrors {
        test: String
        errors: [ClientError!]!
      }

      type Mutation {
        test: String @withErrors(field: "test")
        test2: Payload! @withErrors
        test3: PayloadWithErrors! @withErrors
      }
    `
    const resolvers = {}
    const schema = makeExecutableSchema({ typeDefs, resolvers, schemaDirectives: { withErrors } })
    const fields = schema.getMutationType().getFields()
    expect(fields.test.type.ofType.getFields().errors).toBeDefined()
    expect(fields.test2.type.ofType.getFields().errors).toBeDefined()
  })

  it('should resolve decorated field', async () => {
    const typeDefs = `
      directive @withErrors(
        field: String
      ) on FIELD_DEFINITION

      ${printType(ClientErrorType)}

      type Payload {
        test: String
      }

      type Query {
        test: String
      }

      type Mutation {
        test: String @withErrors(field: "test")
        test2: Payload! @withErrors
      }
    `
    const resolvers = {
      Mutation: {
        test: () => 'TEST!',
        test2: () => ({ test: 'TEST!' }),
      },
    }
    const schema = makeExecutableSchema({ typeDefs, resolvers, schemaDirectives: { withErrors } })
    const { data } = await graphql(schema, `mutation {
      test {
        test
        errors {
          message
        }
      }
      test2 {
        test
        errors {
          message
        }
      }
    }`, {}, {})
    expect(data.test.test).toBe('TEST!')
    expect(data.test2.test).toBe('TEST!')
  })

  it('should throw if field argument is not provided', async () => {
    const typeDefs = `
      directive @withErrors(
        field: String
      ) on FIELD_DEFINITION

      ${printType(ClientErrorType)}

      type Mutation {
        test: String @withErrors
      }
    `
    const resolvers = {}
    expect(() => makeExecutableSchema({ typeDefs, resolvers, schemaDirectives: { withErrors } })).toThrow()
  })
})
