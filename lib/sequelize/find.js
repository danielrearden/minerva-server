const _ = require('lodash')
const { parseResolveInfo } = require('../graphql/parse-resolve-info')
const { Op, Model } = require('sequelize')

/**
 * Creates a FindOptions object that can be used in find methods of a Sequelize model
 * @param  {Model} model - Sequelize model class to generate find options for
 * @param  {GraphQLResolveInfo} info - info parameter passed to resolver
 * @param  {FindOptions} additionalOptions={} - additional FindOptions to include
 * @param  {boolean} paginate=false - whether the generated options will be used for a Model.paginate() call
 * @param  {string} path - optional path to identify the node that should be used to generate options
 * @returns {FindOptions} generated FindOptions
 */
function findOptionsFromInfo (model, info, additionalOptions = {}, paginate = false, path) {
  if (!(model.prototype instanceof Model)) {
    throw new Error('Model should be a class that extends Sequelize Model')
  }

  const { where = {}, include = [], order = [], ...otherOptions } = additionalOptions

  const parsedInfo = parseResolveInfo(info)
  const nodePath = path ? `fields.${path}` : undefined
  const fieldInfo = _.get(parsedInfo, nodePath, parsedInfo)

  const options = paginate
    ? generatePaginateOptions(model, fieldInfo)
    : generateFindOptions(model, fieldInfo, false)

  options.include = _.uniqBy(include.concat(options.include), i => i.model.name + i.as)
  options.where[Op.and] = options.where[Op.and].concat(where)
  options.order = order.concat(options.order)

  return _.merge(options, otherOptions)
}

function generateFindOptions (model, fieldInfo, isInclude = true) {
  const nodeFieldInfo = getNodeFieldInfo(fieldInfo)
  const options = {
    where: generateWhereOptions(model, fieldInfo.args.filter),
    include: generateIncludeOptions(model, nodeFieldInfo),
    order: generateOrderOptions(model, fieldInfo.args.sort, nodeFieldInfo, false),
  }

  if (!isInclude) {
    // Order options cannot be passed as part of include options
    options.order = generateOrderOptions(model, fieldInfo.args.sort, nodeFieldInfo)
  } else {
    // Always use a left join
    options.required = false
  }

  return options
}

function generatePaginateOptions (model, fieldInfo) {
  const nodeFieldInfo = getNodeFieldInfo(fieldInfo)
  const options = {
    where: generateWhereOptions(model, fieldInfo.args.filter),
    include: generateIncludeOptions(model, nodeFieldInfo),
    order: generateOrderOptions(model, fieldInfo.args.sort, nodeFieldInfo, true),
    after: fieldInfo.args.after,
    before: fieldInfo.args.before,
    first: fieldInfo.args.first,
    last: fieldInfo.args.last,
    includeTotal: !!_.get(fieldInfo, 'fields.pageInfo.fields.totalCount') || !!_.get(fieldInfo, 'fields.pageInfo.fields.pageCount'),
  }

  if (fieldInfo.args.sort) {
    options.desc = fieldInfo.args.sort.dir === 'DESC'
    options.paginateBy = fieldInfo.args.sort.field
  }

  return options
}

function generateIncludeOptions (model, nodeFieldInfo) {
  const include = []
  const associations = model.associations
  const fields = _.values(nodeFieldInfo.fields)
  for (const field of fields) {
    // If a field includes args that would place a limit on the query, we won't include it and let the field resolver generate a
    // a separate query instead. Sequelize would generate a separate query in this case anyway.
    const fieldArgs = field.args || {}
    if (fieldArgs.first || fieldArgs.last) {
      continue
    }

    // If the relationship field is aliased, we won't include it and let its resolver generate a separate query.
    // This gets around Sequelize's limitation of not being able to include the same model multiple times.
    if (field.alias && field.alias !== field.name) {
      continue
    }

    // Assumes the field for an associated model will be the same as the association name or "as" property
    const association = _.values(associations).find(association => {
      return association.as === field.name
    })
    if (association) {
      const model = association.target
      include.push({
        model,
        as: association.as,
        through: association.through,
        ...generateFindOptions(model, field),
      })
    }
  }

  return _.uniqBy(include, i => i.model.name + i.as)
}

function generateWhereOptions (model, args) {
  if (!args) {
    return { [Op.and]: [] }
  }

  const where = Object.keys(args).map((argName) => generateWhereOption(model, argName, args[argName]))

  return {
    [Op.and]: where,
  }
}

function generateWhereOption (model, argName, argValue) {
  if (argName === 'and') {
    return {
      [Op.and]: argValue.map((args) => generateWhereOptions(model, args)),
    }
  } else if (argName === 'or') {
    return {
      [Op.or]: argValue.map((args) => generateWhereOptions(model, args)),
    }
  }

  // Assumes that the argument name follows the convention of fieldName[_not]_operator
  const parts = argName.split('_')
  const fieldName = parts[0]
  if (parts.length < 2 || !model.rawAttributes[fieldName] || model.rawAttributes[fieldName].type.constructor.name === 'VIRTUAL') {
    return
  }

  const negate = parts.length === 3
  const operator = negate ? parts[2] : parts[1]
  if (!Op[operator]) {
    return
  }

  const where = {
    [fieldName]: {
      [Op[operator]]: argValue,
    },
  }
  return negate
    ? { [Op.not]: where }
    : where
}

function generateOrderOptions (model, sort, fieldInfo, paginate = false) {
  const order = []

  // Root level order options for the paginate function are passed in as separate options
  if (sort && !paginate) {
    order.push([sort.field, sort.dir])
  }

  concatOrderOptionsArray([], order, model, fieldInfo)

  return order
}

function concatOrderOptionsArray (modelsPath, order, model, fieldInfo) {
  const associations = model.associations
  const fields = _.values(fieldInfo.fields)
  for (const field of fields) {
    // Skip adding order for any associations that will be ran as separate queries anyway
    const fieldArgs = field.args || {}
    if (fieldArgs.first || fieldArgs.last) {
      continue
    }

    // Assumes the field for an associated model will be the same as the association name or "as" property
    const association = _.values(associations).find(association => {
      return association.as === field.name
    })
    if (association) {
      const target = association.target
      const newModelsPath = modelsPath.concat({ model: target, as: association.as, through: association.through })
      const nodeFieldInfo = getNodeFieldInfo(field)
      if (fieldArgs.sort) {
        order.push(newModelsPath.concat([fieldArgs.sort.field, fieldArgs.sort.dir]))
      }

      concatOrderOptionsArray(newModelsPath, order, target, nodeFieldInfo)
    }
  }

  return order
}

function getNodeFieldInfo (fieldInfo) {
  return isPage(fieldInfo) ? _.get(fieldInfo, 'fields.results', {}) : fieldInfo
}

function isPage (fieldInfo) {
  return !!fieldInfo.fields.pageInfo || !!fieldInfo.fields.results || !!fieldInfo.fields.aggregate
}

module.exports = {
  findOptionsFromInfo,
}
