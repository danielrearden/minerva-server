const { SchemaDirectiveVisitor } = require('graphql-tools')
const { GraphQLInt, GraphQLID, isWrappingType } = require('graphql')
const {
  getFilterInputName,
  getSortInputName,
} = require('../names')

/**
 * Adds the pagination args (start, end, before and after) to a field, as well as optionally
 * a sort and a filter argument.
 */
module.exports = class PaginateDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition (field) {
    let paginatedType = field.type
    while (isWrappingType(paginatedType)) {
      paginatedType = paginatedType.ofType
    }

    const myRegexp = /(.+)Page/
    const matches = myRegexp.exec(paginatedType.name)
    const defaultTypeName = matches && matches[1]
    const { type: typeName = defaultTypeName, sort = true, filter = true } = this.args

    const args = [
      ...field.args,
      { name: 'after', type: GraphQLID },
      { name: 'before', type: GraphQLID },
      { name: 'first', type: GraphQLInt },
      { name: 'last', type: GraphQLInt },
    ]

    const sortArgType = this.schema.getType(getSortInputName(typeName))
    if (sort && sortArgType) {
      const arg = {
        name: 'sort',
        type: sortArgType,
      }
      args.push(arg)
    }

    const filterArgType = this.schema.getType(getFilterInputName(typeName))
    if (filter && filterArgType) {
      const arg = {
        name: 'filter',
        type: filterArgType,
      }
      args.push(arg)
    }

    field.args = args
  }
}
