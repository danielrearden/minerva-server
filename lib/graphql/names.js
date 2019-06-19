const _ = require('lodash')

function getPageTypeName (typeName) {
  return typeName + 'Page'
}

function getAggregateTypeName (typeName) {
  return typeName + 'Aggregate'
}

function getAggregateFieldTypeName (typeName, aggregateFn) {
  return typeName + 'Aggregate' + _.upperFirst(aggregateFn)
}

function getFilterInputName (typeName) {
  return typeName + 'Filter'
}

function getSortInputName (typeName) {
  return typeName + 'Sort'
}

function getSortFieldEnumName (typeName) {
  return typeName + 'SortField'
}

function getEnumFieldName (typeName, fieldName) {
  return `${typeName}${_.upperFirst(fieldName)}`
}

module.exports = {
  getPageTypeName,
  getAggregateTypeName,
  getAggregateFieldTypeName,
  getFilterInputName,
  getSortInputName,
  getSortFieldEnumName,
  getEnumFieldName,
}
