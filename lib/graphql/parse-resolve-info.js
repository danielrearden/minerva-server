const _ = require('lodash')
const { parseResolveInfo: parse } = require('graphql-parse-resolve-info')

function parseResolveInfo (info) {
  return transformParsedInfo(parse(info))
}

/**
 * The parse function splits up fields by typename to account for interfaces and unions. We don't care about
 * type so we transform the object into a simpler structure.
 */
function transformParsedInfo (info) {
  if (!info || !_.isObject(info)) {
    return info
  }
  if (info.fieldsByTypeName) {
    info.fields = flattenFields(info.fieldsByTypeName)
    delete info.fieldsByTypeName
    Object.keys(info.fields).forEach(key => {
      info.fields[key] = transformParsedInfo(info.fields[key])
    })
  }
  return info
}

/**
 * Flattens the fieldsByTypeName returned by parseResolveInfo into a simple field map
 */
function flattenFields (fieldsByTypeName) {
  if (!fieldsByTypeName) {
    return
  }
  return Object.keys(fieldsByTypeName).reduce((fields, typeName) => {
    return { ...fields, ...fieldsByTypeName[typeName] }
  }, {})
}

module.exports = {
  parseResolveInfo,
}
