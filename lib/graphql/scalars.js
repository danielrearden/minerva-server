const _ = require('lodash')
const GraphQLJSON = require('graphql-type-json').default
const GraphQLUUID = require('graphql-type-uuid')
const {
  GraphQLDateTime,
  GraphQLDate,
  GraphQLTime,
} = require('graphql-iso-date')
const {
  GraphQLFloat,
  GraphQLInt,
  GraphQLScalarType,
  Kind,
} = require('graphql')

const GraphQLIntRange = new GraphQLScalarType({
  name: 'IntRange',
  serialize: (result) => serializeRange('IntRange', GraphQLInt, result),
  parseValue: (value) => parseRangeValue('IntRange', GraphQLInt, value),
  parseLiteral: (ast) => parseRangeLiteral('IntRange', GraphQLInt, ast),
})

const GraphQLFloatRange = new GraphQLScalarType({
  name: 'FloatRange',
  serialize: (result) => serializeRange('FloatRange', GraphQLFloat, result),
  parseValue: (value) => parseRangeValue('FloatRange', GraphQLFloat, value),
  parseLiteral: (ast) => parseRangeLiteral('FloatRange', GraphQLFloat, ast),
})

const GraphQLDateRange = new GraphQLScalarType({
  name: 'DateRange',
  serialize: (result) => serializeRange('DateRange', GraphQLDate, result),
  parseValue: (value) => parseRangeValue('DateRange', GraphQLDate, value),
  parseLiteral: (ast) => parseRangeLiteral('DateRange', GraphQLDate, ast),
})

const GraphQLDateTimeRange = new GraphQLScalarType({
  name: 'DateTimeRange',
  serialize: (result) => serializeRange('DateTimeRange', GraphQLDateTime, result),
  parseValue: (value) => parseRangeValue('DateTimeRange', GraphQLDateTime, value),
  parseLiteral: (ast) => parseRangeLiteral('DateTimeRange', GraphQLDateTime, ast),
})

function serializeRange (scalarName, valueScalar, result) {
  if (!Array.isArray(result) || result.length !== 2) {
    throw new TypeError(`${scalarName} should be an array of length 2.`)
  }
  const value = [ ...result ]
  if (!_.isBoolean(value[0].inclusive)) {
    throw new TypeError('Lower bound inclusive field must be a boolean.')
  }
  if (value[0].value === undefined) {
    throw new TypeError(`Lower field must specify value field.`)
  } else if (value[0].value === Infinity || value[0].value === -Infinity) {
    value[0].value = null
  } else {
    value[0].value = valueScalar.serialize(value[0].value)
  }
  if (!_.isBoolean(value[1].inclusive)) {
    throw new TypeError('Upper bound inclusive field must be a boolean.')
  }
  if (value[1].value === undefined) {
    throw new TypeError(`Upper field must specify value field.`)
  } else if (value[1].value === Infinity || value[1].value === -Infinity) {
    value[1].value = null
  } else {
    value[1].value = valueScalar.serialize(value[1].value)
  }

  return value
}

function parseRangeValue (scalarName, valueScalar, bounds) {
  if (!Array.isArray(bounds) || bounds.length !== 2) {
    throw new TypeError(`${scalarName} should be an array of length 2.`)
  }
  if (!_.isPlainObject(bounds[0])) {
    throw new TypeError(`${scalarName} lower bound must be an object.`)
  }
  if (bounds[0].inclusive !== undefined && !_.isBoolean(bounds[0].inclusive)) {
    throw new TypeError('Lower bound inclusive field must be a boolean.')
  }
  if (bounds[0].value === undefined) {
    throw new TypeError('Lower bound must specify value field.')
  }
  if (!_.isPlainObject(bounds[1])) {
    throw new TypeError(`${scalarName} upper bound must be an object.`)
  }
  if (bounds[1].inclusive !== undefined && !_.isBoolean(bounds[1].inclusive)) {
    throw new TypeError('Upper bound inclusive field must be a boolean.')
  }
  if (bounds[1].value === undefined) {
    throw new TypeError('Upper bound must specify value field.')
  }

  return bounds.map((bound, index) => ({
    value: bound.value === null ? null : valueScalar.parseValue(bound.value),
    inclusive: bound.inclusive === undefined ? index === 0 : bound.inclusive,
  }))
}

function parseRangeLiteral (scalarName, valueScalar, ast) {
  if (ast.kind !== Kind.LIST || ast.values.length !== 2) {
    throw new TypeError(`${scalarName} should be an array of length 2.`)
  }

  const lowerBound = ast.values[0]
  const upperBound = ast.values[1]

  if (lowerBound.kind !== Kind.OBJECT) {
    throw new TypeError(`${scalarName} lower bound must be an object.`)
  }
  const lower = lowerBound.fields.reduce((memo, field) => {
    if (field.name.value === 'value') {
      if (field.value.kind === Kind.NULL) {
        memo.value = null
      } else {
        memo.value = valueScalar.parseLiteral(field.value)
      }
    }
    if (field.name.value === 'inclusive') {
      if (field.value.kind !== Kind.BOOLEAN) {
        throw new TypeError('Lower bound inclusive field must be a boolean.')
      }
      memo.inclusive = field.value.value
    }
    return memo
  }, {})

  if (upperBound.kind !== Kind.OBJECT) {
    throw new TypeError(`${scalarName} upper bound must be an object.`)
  }

  const upper = upperBound.fields.reduce((memo, field) => {
    if (field.name.value === 'value') {
      if (field.value.kind === Kind.NULL) {
        memo.value = null
      } else {
        memo.value = valueScalar.parseLiteral(field.value)
      }
    }
    if (field.name.value === 'inclusive') {
      if (field.value.kind !== Kind.BOOLEAN) {
        throw new TypeError('Upper bound inclusive field must be a boolean.')
      }
      memo.inclusive = field.value.value
    }
    return memo
  }, {})

  if (lower.value === undefined) {
    throw new TypeError('Lower bound must specify value field.')
  }
  if (upper.value === undefined) {
    throw new TypeError('Upper bound must specify value field.')
  }

  lower.inclusive = lower.inclusive === undefined ? true : lower.inclusive
  upper.inclusive = upper.inclusive === undefined ? false : upper.inclusive

  return [
    lower,
    upper,
  ]
}

module.exports = {
  GraphQLDate,
  GraphQLDateRange,
  GraphQLDateTime,
  GraphQLDateTimeRange,
  GraphQLFloatRange,
  GraphQLIntRange,
  GraphQLJSON,
  GraphQLTime,
  GraphQLUUID,
}
