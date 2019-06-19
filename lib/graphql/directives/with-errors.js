const _ = require('lodash')
const { SchemaDirectiveVisitor } = require('graphql-tools')
const {
  GraphQLList,
  GraphQLObjectType,
  GraphQLNonNull,
  defaultFieldResolver,
  isNonNullType,
  isObjectType,
} = require('graphql')
const { handleClientError } = require('../../errors/handle-client-error')

module.exports = class withErrorsDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition (field) {
    const { args: { field: fieldName }, schema } = this
    const { type: originalType, resolve: originalResolve = defaultFieldResolver } = field

    if (!fieldName) {
      let unwrappedType = originalType
      if (isNonNullType(unwrappedType)) {
        unwrappedType = unwrappedType.ofType
      }

      if (!isObjectType(unwrappedType)) {
        throw new Error(
          `Invalid @withErrors directive for field "${field.name}". Field argument must be provided unless the field type is an Object type.`
        )
      }

      if (!unwrappedType.getFields().errors) {
        unwrappedType.getFields().errors = {
          name: 'errors',
          type: GraphQLList(GraphQLNonNull(schema.getType('ClientError'))),
          args: [],
          isDeprecated: false,
        }
      }

      field.type = GraphQLNonNull(unwrappedType)
      field.resolve = async function (source, args, context, info) {
        const [result, errors] = await handleClientError(() => {
          return originalResolve.apply(this, [source, args, context, info])
        }, context)
        return { ...result, errors }
      }
    } else {
      const payloadType = new GraphQLObjectType({
        name: `${_.upperFirst(field.name)}Payload`,
        fields: () => ({
          [fieldName]: {
            type: originalType,
          },
          errors: {
            type: GraphQLList(GraphQLNonNull(schema.getType('ClientError'))),
          },
        }),
      })
      field.type = GraphQLNonNull(payloadType)
      field.resolve = async function (source, args, context, info) {
        const [result, errors] = await handleClientError(() => {
          return originalResolve.apply(this, [source, args, context, info])
        }, context)
        return { [fieldName]: result, errors }
      }
      schema.getTypeMap()[payloadType.name] = payloadType
    }
  }
}
