const { SchemaDirectiveVisitor } = require('graphql-tools')
const { isWrappingType } = require('graphql')
const { getSortInputName } = require('../names')

/**
 * Adds the sort arg to a field
 */
module.exports = class SortDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition (field) {
    let connectedType = field.type
    while (isWrappingType(connectedType)) {
      connectedType = connectedType.ofType
    }

    const defaultTypeName = `${connectedType.name}`
    const { type: typeName = defaultTypeName } = this.args
    const argType = this.schema.getType(getSortInputName(typeName))
    if (argType) {
      const arg = {
        name: 'sort',
        type: argType,
      }
      const args = (field.args || []).concat(arg)
      field.args = args
    }
  }
}
