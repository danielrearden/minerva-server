const { SchemaDirectiveVisitor } = require('graphql-tools')
const { isWrappingType } = require('graphql')
const { getFilterInputName } = require('../names')

/**
 * Adds the filter arg to a field
 */
module.exports = class FilterDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition (field) {
    let connectedType = field.type
    while (isWrappingType(connectedType)) {
      connectedType = connectedType.ofType
    }

    const defaultTypeName = `${connectedType.name}`
    const { type: typeName = defaultTypeName } = this.args
    const argType = this.schema.getType(getFilterInputName(typeName))
    if (argType) {
      const arg = {
        name: 'filter',
        type: argType,
      }
      const args = (field.args || []).concat(arg)
      field.args = args
    }
  }
}
