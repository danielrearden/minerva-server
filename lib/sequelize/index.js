const _ = require('lodash')
const Sequelize = require('sequelize')
const Utils = require('sequelize/lib/utils')

const { findOptionsFromInfo } = require('./find')
const { paginate: paginateFn } = require('./pagination')

Sequelize.Model.paginate = function paginate (options) {
  const method = this.findAll.bind(this)
  return paginateFn(this, method, options)
}

const methods = [
  'findAll',
  'findAndCountAll',
  'findByPk',
  'findCreateFind',
  'findOne',
  'findOrBuild',
  'findOrCreate',
  'paginate',
]

methods.forEach((method) => {
  const oldMethod = Sequelize.Model[method]

  Sequelize.Model[method] = function (...params) {
    const isFindByPk = method === 'findByPk'
    const { info, path, ...otherOptions } = (isFindByPk ? params[1] : params[0]) || {}

    if (!info) {
      return oldMethod.bind(this)(...params)
    }

    const options = findOptionsFromInfo(this, info, otherOptions, method === 'paginate', path)
    const newParams = isFindByPk ? [params[0], options] : [options]
    return oldMethod.bind(this)(...newParams)
  }
})

const oldInit = Sequelize.Model.init
Sequelize.Model.init = function init (attributes, options) {
  beforeDefine(this.name, attributes, options)
  return oldInit.bind(this)(attributes, options)
}

function beforeDefine (name, attributes = {}, options = {}) {
  const modelName = options.modelName || name
  const nameSingular = _.lowerFirst(Utils.singularize(modelName))
  const namePlural = _.lowerFirst(Utils.pluralize(modelName))

  options.name = {
    singular: _.get(options, 'name.singular', nameSingular),
    plural: _.get(options, 'name.plural', namePlural),
  }
  options.tableName = options.tableName || _.snakeCase(namePlural)

  if (options.timestamps === false) {
    options.createdAt = false
    options.updatedAt = false
  } else {
    if (options.createdAt === undefined) {
      options.createdAt = 'createdAt'
    }
    if (options.updatedAt === undefined) {
      options.updatedAt = 'updatedAt'
    }
  }

  if (options.createdAt) {
    attributes.createdAt = {
      ...attributes.createdAt,
      type: Sequelize.DATE,
      field: _.snakeCase(options.createdAt),
      allowNull: false,
    }
  }

  if (options.updatedAt) {
    attributes.updatedAt = {
      ...attributes.updatedAt,
      type: Sequelize.DATE,
      field: _.snakeCase(options.updatedAt),
      allowNull: false,
    }
  }

  if (options.paranoid) {
    options.deletedAt = options.deletedAt || 'deletedAt'
    attributes.deletedAt = {
      type: Sequelize.DATE,
      field: _.snakeCase(options.deletedAt),
      allowNull: true,
    }
  }

  options.isAbstract = false
  options.isInterface = false
  options.isUnion = false

  if (options.possibleTypes) {
    options.isAbstract = true
    options.isInterface = Object.keys(attributes).filter(attributeName => !attributes[attributeName].actualTypes).length > 1
    options.isUnion = !options.isInterface

    options.typenameField = options.typenameField || 'type'
    attributes.__typename = {
      type: Sequelize.VIRTUAL(Sequelize.TEXT, [options.typenameField]),
      allowNull: true,
      set (val) {
        this.setDataValue(options.typenameField, val)
      },
      get () {
        return this.getDataValue(options.typenameField)
      },
    }
  }

  Object.keys(attributes).forEach((key) => {
    const attribute = attributes[key]
    if (typeof attribute !== 'function') {
      attribute.allowNull = attribute.allowNull === undefined ? true : attribute.allowNull
      attribute.field = attribute.field || _.snakeCase(key)
    }
  })
}

module.exports = Sequelize
module.exports.Sequelize = Sequelize
module.exports.default = Sequelize
