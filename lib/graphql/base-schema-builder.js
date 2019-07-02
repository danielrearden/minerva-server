const _ = require('lodash')
const Sequelize = require('sequelize')
const { pluralize } = require('inflection')
const {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLEnumType,
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLInt,
  GraphQLInterfaceType,
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
  GraphQLString,
  GraphQLUnionType,
  printSchema,
} = require('graphql')
const {
  GraphQLJSON,
  GraphQLUUID,
  GraphQLDateTime,
  GraphQLDate,
  GraphQLTime,
} = require('./scalars')
const {
  ClientErrorType,
  PageInfoType,
  SortDirectionEnum,
} = require('./types')
const {
  getPageTypeName,
  getAggregateTypeName,
  getAggregateFieldTypeName,
  getFilterInputName,
  getSortInputName,
  getSortFieldEnumName,
  getEnumFieldName,
} = require('./names')
const { handleClientError } = require('../errors/handle-client-error')
const { findOptionsFromInfo } = require('../sequelize/find')
const { pageObjectFromResults, paginate } = require('../sequelize/pagination')

class BaseSchemaBuilder {
  constructor () {
    this.typeMap = {
      ClientError: ClientErrorType,
    }
    this.resolvers = {}
  }

  build ({ models }, options = {}) {
    for (const modelName in models) {
      const model = models[modelName]
      if (model.rawAttributes && model.options && model.options.public !== false) {
        const typenameField = model.options.typenameField || 'type'
        if (model.options.possibleTypes && !model.rawAttributes[typenameField]) {
          throw new Error(`The typenameField for ${modelName} is ${typenameField} but that field is not defined in the model.`)
        }

        let type
        if (!model.options.isAbstract) {
          type = new GraphQLObjectType({
            name: model.name,
            description: model.options.comment,
            fields: () => this.generateTypeFields(model),
          })
        } else if (model.options.isInterface) {
          type = new GraphQLInterfaceType({
            name: model.name,
            description: model.options.comment,
            fields: () => this.generateTypeFields(model),
          })
        } else if (model.options.isUnion) {
          const types = []

          for (const possibleTypeName of model.options.possibleTypes) {
            const possibleType = new GraphQLObjectType({
              name: possibleTypeName,
              fields: () => this.generateTypeFields(model, possibleTypeName),
            })
            this.typeMap[possibleType.name] = possibleType
            this.generatePage(model, possibleType, possibleTypeName)
            this.generateSortInput(model, possibleTypeName)
            this.generateFilterInput(model, possibleTypeName)
            types.push(possibleType)
          }

          type = new GraphQLUnionType({
            name: model.name,
            description: model.options.comment,
            types,
          })
        }

        this.typeMap[type.name] = type
        this.generatePage(model, type)
        this.generateSortInput(model)
        this.generateFilterInput(model)

        if (model.options.isInterface) {
          for (const possibleTypeName of model.options.possibleTypes) {
            const possibleType = new GraphQLObjectType({
              name: possibleTypeName,
              fields: () => this.generateTypeFields(model, possibleTypeName),
              interfaces: [type],
            })
            this.typeMap[possibleType.name] = possibleType
            this.generatePage(model, possibleType, possibleTypeName)
            this.generateSortInput(model, possibleTypeName)
            this.generateFilterInput(model, possibleTypeName)
          }
        }
      }
    }

    const query = this.generateQueryType(models, options)
    const mutation = this.generateMutationType(models, options)

    const schema = new GraphQLSchema({
      query,
      mutation,
      types: _.values(this.typeMap),
    })
    const typeDefs = printSchema(schema)

    return { schema, typeDefs, resolvers: this.resolvers }
  }

  generateTypeFields (model, possibleTypeName) {
    const fields = {}

    for (const attributeName of Object.keys(model.rawAttributes)) {
      const attribute = model.rawAttributes[attributeName]
      if (attribute.public === false || attributeName === '__typename') {
        continue
      }

      if (possibleTypeName && attribute.actualTypes && !attribute.actualTypes.includes(possibleTypeName)) {
        continue
      }

      if (!possibleTypeName && attribute.actualTypes) {
        continue
      }

      const type = this.getGraphQLOutputType(model, attributeName, attribute.type.constructor.name, attribute.type)
      if (!type) {
        continue
      }

      const nonNull = !attribute.allowNull || attribute.primaryKey || attribute.defaultValue !== undefined
      fields[attributeName] = {
        type: nonNull ? new GraphQLNonNull(type) : type,
        description: attribute.comment,
        deprecationReason: attribute.deprecationReason,
      }
    }

    const associationFields = this.generateAssociationFields(model, possibleTypeName)

    return {
      ...fields,
      ...associationFields,
    }
  }

  generateAssociationFields (model, possibleTypeName) {
    const fields = {}

    for (const associationName of Object.keys(model.associations)) {
      const association = model.associations[associationName]
      const targetModelName = association.options.fieldType || association.target.name
      const targetModelPageName = getPageTypeName(targetModelName)

      const foreignKey = association.foreignKey
      const foreignKeyField = association.target.rawAttributes[foreignKey]
      const foreignKeyFieldNonNull = foreignKeyField && (foreignKeyField.allowNull === false)
      const belongsTo = association.associationType === 'BelongsTo'
      const nonNull = association.isMultiAssociation || (belongsTo && foreignKeyFieldNonNull)

      const targetModelType = this.typeMap[association.isMultiAssociation ? targetModelPageName : targetModelName]

      if (association.options.public === false || association.target.options.public === false) {
        continue
      }

      if (possibleTypeName && association.options.actualTypes && !association.options.actualTypes.includes(possibleTypeName)) {
        continue
      }

      if (!possibleTypeName && association.options.actualTypes) {
        continue
      }

      const fieldName = association.as
      const type = nonNull ? new GraphQLNonNull(targetModelType) : targetModelType
      const args = association.isMultiAssociation
        ? this.generatePageArgs(association.target, association.options.fieldType)
        : {}
      const resolve = resolveAssociationField(model, association)
      fields[fieldName] = { type, args, resolve }
      _.set(this.resolvers, `${possibleTypeName || model.name}.${fieldName}`, resolve)
    }

    return fields
  }

  generatePageArgs (model, possibleTypeName) {
    const args = {
      after: { type: GraphQLID },
      before: { type: GraphQLID },
      first: { type: GraphQLInt },
      last: { type: GraphQLInt },
    }

    const sortInput = this.generateSortInput(model, possibleTypeName)
    if (sortInput) {
      args.sort = {
        type: sortInput,
      }
    }
    const filterInput = this.generateFilterInput(model, possibleTypeName)
    if (filterInput) {
      args.filter = {
        type: filterInput,
      }
    }

    return args
  }

  generateSortInput (model, possibleTypeName) {
    const name = getSortInputName(possibleTypeName || model.name)
    if (this.typeMap[name]) {
      return this.typeMap[name]
    }

    const sortableFieldValues = Object.keys(model.rawAttributes).reduce((values, attributeName) => {
      const attribute = model.rawAttributes[attributeName]
      const isSortable = this.isSortable(attribute.type)

      if (possibleTypeName && attribute.actualTypes && !attribute.actualTypes.includes(possibleTypeName)) {
        return values
      }

      if (!possibleTypeName && attribute.actualTypes) {
        return values
      }

      if (isSortable && attribute.public !== false && attribute.sort !== false) {
        values[attributeName] = {
          value: attributeName,
          description: attribute.comment,
          deprecationReason: attribute.deprecationReason,
        }
      }

      return values
    }, {})

    if (!Object.keys(sortableFieldValues).length) {
      return undefined
    }

    const sortFieldEnum = new GraphQLEnumType({
      name: getSortFieldEnumName(possibleTypeName || model.name),
      values: sortableFieldValues,
    })
    const sortInput = new GraphQLInputObjectType({
      name,
      fields: {
        dir: {
          type: SortDirectionEnum,
          defaultValue: 'ASC',
        },
        field: {
          type: new GraphQLNonNull(sortFieldEnum),
        },
      },
    })

    this.typeMap[sortInput.name] = sortInput

    return sortInput
  }

  generateFilterInput (model, possibleTypeName) {
    const name = getFilterInputName(possibleTypeName || model.name)
    if (this.typeMap[name]) {
      return this.typeMap[name]
    }

    const commonOperators = [
      'eq',
      'not_eq',
    ]
    const numberOperators = [
      'gt',
      'gte',
      'lt',
      'lte',
    ]
    const stringOperators = [
      'like',
      'iLike',
      'not_like',
      'not_iLike',
    ]
    const containOperators = [
      'contains',
      'contained',
    ]
    const filterableFields = Object.keys(model.rawAttributes).reduce((fields, attributeName) => {
      const attribute = model.rawAttributes[attributeName]

      if (possibleTypeName && attribute.actualTypes && !attribute.actualTypes.includes(possibleTypeName)) {
        return fields
      }

      if (!possibleTypeName && attribute.actualTypes) {
        return fields
      }

      const isFilterable = this.isFilterable(attribute.type)
      const type = this.getGraphQLInputType(model, attributeName, attribute.type.constructor.name, attribute.type)
      if (isFilterable && type && attribute.public !== false && attribute.filter !== false) {
        let operators = commonOperators
        if (type === GraphQLString) {
          operators = operators.concat(stringOperators)
        } else if ([GraphQLInt, GraphQLFloat, GraphQLDateTime, GraphQLDate, GraphQLTime].includes(type)) {
          operators = operators.concat(numberOperators)
        }

        if (attribute.type.constructor.name === 'JSONB' || attribute.type.constructor.name === 'ARRAY') {
          operators = operators.concat(containOperators)
        }

        for (const operator of operators) {
          fields[`${attributeName}_${operator}`] = { type }
        }

        fields[`${attributeName}_in`] = { type: new GraphQLList(type) }
        fields[`${attributeName}_not_in`] = { type: new GraphQLList(type) }
      }

      return fields
    }, {})

    if (!Object.keys(filterableFields).length) {
      return undefined
    }
    const filterInput = new GraphQLInputObjectType({
      name,
      fields: () => ({
        ...filterableFields,
        and: {
          type: new GraphQLList(new GraphQLNonNull(filterInput)),
        },
        or: {
          type: new GraphQLList(new GraphQLNonNull(filterInput)),
        },
      }),
    })

    this.typeMap[filterInput.name] = filterInput

    return filterInput
  }

  isSortable (type) {
    return this.isSortableAndFilterable(type)
  }

  isFilterable (type) {
    switch (type.constructor.name) {
      case Sequelize.JSONB.name:
      case Sequelize.ARRAY.name: return true
      default: return this.isSortableAndFilterable(type)
    }
  }

  isSortableAndFilterable (type) {
    switch (type.constructor.name) {
      case Sequelize.UUID.name:
      case Sequelize.STRING.name:
      case Sequelize.TEXT.name:
      case Sequelize.TINYINT.name:
      case Sequelize.SMALLINT.name:
      case Sequelize.MEDIUMINT.name:
      case Sequelize.BIGINT.name:
      case Sequelize.INTEGER.name:
      case Sequelize.REAL.name:
      case Sequelize.DOUBLE.name:
      case Sequelize.DECIMAL.name:
      case Sequelize.FLOAT.name:
      case Sequelize.BOOLEAN.name:
      case Sequelize.DATE.name:
      case Sequelize.DATEONLY.name:
      case Sequelize.TIME.name:
      case Sequelize.ENUM.name: return true
      default: return false
    }
  }

  getGraphQLOutputType (model, attributeName, typeString, type) {
    switch (typeString) {
      case Sequelize.UUID.name: return GraphQLUUID
      case Sequelize.STRING.name:
      case Sequelize.TEXT.name: return GraphQLString
      case Sequelize.SMALLINT.name:
      case Sequelize.MEDIUMINT.name:
      case Sequelize.BIGINT.name:
      case Sequelize.INTEGER.name: return GraphQLInt
      case Sequelize.REAL.name:
      case Sequelize.DOUBLE.name:
      case Sequelize.DECIMAL.name:
      case Sequelize.FLOAT.name: return GraphQLFloat
      case Sequelize.BOOLEAN.name: return GraphQLBoolean
      case Sequelize.DATE.name: return GraphQLDateTime
      case Sequelize.DATEONLY.name: return GraphQLDate
      case Sequelize.TIME.name: return GraphQLTime
      case Sequelize.JSONB.name:
      case Sequelize.JSON.name: return GraphQLJSON
      case Sequelize.ENUM.name: {
        return this.getEnumForModelField(model, attributeName, type.values)
      }
      case Sequelize.ARRAY.name: {
        const listType = this.getGraphQLOutputType(model, attributeName, type.type.constructor.name, type.type)
        return listType ? new GraphQLList(new GraphQLNonNull(listType)) : null
      }
      case Sequelize.RANGE.name: {
        const listType = this.getGraphQLOutputType(model, attributeName, type._subtype)
        return listType ? new GraphQLList(new GraphQLNonNull(listType)) : null
      }
      case Sequelize.VIRTUAL.name: {
        if (!type.returnType || !type.fields || !type.fields.length) {
          return null
        }

        return this.getGraphQLOutputType(model, attributeName, type.returnType.constructor.name, type.returnType)
      }
      default: return null
    }
  }

  getGraphQLInputType (model, attributeName, typeString, type) {
    switch (typeString) {
      case Sequelize.UUID.name: return GraphQLUUID
      case Sequelize.STRING.name:
      case Sequelize.TEXT.name: return GraphQLString
      case Sequelize.SMALLINT.name:
      case Sequelize.MEDIUMINT.name:
      case Sequelize.BIGINT.name:
      case Sequelize.INTEGER.name: return GraphQLInt
      case Sequelize.REAL.name:
      case Sequelize.DOUBLE.name:
      case Sequelize.DECIMAL.name:
      case Sequelize.FLOAT.name: return GraphQLFloat
      case Sequelize.BOOLEAN.name: return GraphQLBoolean
      case Sequelize.DATE.name: return GraphQLDateTime
      case Sequelize.DATEONLY.name: return GraphQLDate
      case Sequelize.TIME.name: return GraphQLTime
      case Sequelize.JSONB.name:
      case Sequelize.JSON.name: return GraphQLJSON
      case Sequelize.ENUM.name: {
        return this.getEnumForModelField(model, attributeName, type.values)
      }
      case Sequelize.ARRAY.name: {
        const listType = this.getGraphQLInputType(model, attributeName, type.type.constructor.name, type.type)
        return listType ? new GraphQLList(new GraphQLNonNull(listType)) : null
      }
      default: return null
    }
  }

  getEnumForModelField (model, fieldName, valuesArray) {
    const name = getEnumFieldName(model.name, fieldName)
    if (this.typeMap[name]) {
      return this.typeMap[name]
    }

    const values = _.mapValues(_.keyBy(valuesArray), value => ({ value }))
    const enumType = new GraphQLEnumType({ name, values })

    this.typeMap[name] = enumType

    return enumType
  }

  generatePage (model, type, possibleTypeName) {
    const name = getPageTypeName(type.name)
    const aggregateType = this.generateAggregateType(model, possibleTypeName)
    const resolve = ({ results }) => ({ results })
    const pageType = new GraphQLObjectType({
      name,
      description: 'A paginated list of items.',
      fields: () => {
        const fields = {
          pageInfo: {
            type: new GraphQLNonNull(PageInfoType),
            description: 'Information to aid in pagination.',
          },
          results: {
            type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(type))),
            description: 'A list of items for the returned page.',
          },
        }
        if (aggregateType) {
          fields.aggregate = {
            type: new GraphQLNonNull(aggregateType),
            resolve,
          }
        }
        return fields
      },
    })

    this.typeMap[name] = pageType

    if (aggregateType) {
      _.set(this.resolvers, `${name}.aggregate`, resolve)
    }

    return pageType
  }

  generateAggregateType (model, possibleTypeName) {
    const name = getAggregateTypeName(possibleTypeName || model.name)
    const aggregateFunctions = ['avg', 'max', 'min', 'median', 'sum']
    const fields = aggregateFunctions.reduce((memo, aggregateFn) => {
      const field = this.generateAggregateField(model, aggregateFn, possibleTypeName)
      if (field) {
        memo[aggregateFn] = field
      }
      return memo
    }, {})
    if (!Object.keys(fields).length) {
      return
    }

    const aggregateType = new GraphQLObjectType({
      name,
      fields,
      description: 'Aggregate functions that can be ran on the current page',
    })

    this.typeMap[name] = aggregateType

    return aggregateType
  }

  generateAggregateField (model, aggregateFn, possibleTypeName) {
    const fields = {}
    for (const attributeName of Object.keys(model.rawAttributes)) {
      const attribute = model.rawAttributes[attributeName]
      if (attribute.public === false) {
        continue
      }

      if (possibleTypeName && attribute.actualTypes && !attribute.actualTypes.includes(possibleTypeName)) {
        continue
      }

      if (!possibleTypeName && attribute.actualTypes) {
        continue
      }

      let type = this.getGraphQLOutputType(model, attributeName, attribute.type.constructor.name, attribute.type)
      if (!type) {
        continue
      }

      const validTypes = (aggregateFn === 'min' || aggregateFn === 'max')
        ? [GraphQLInt, GraphQLFloat, GraphQLDate, GraphQLDateTime, GraphQLTime]
        : [GraphQLInt, GraphQLFloat]
      if (!validTypes.includes(type)) {
        continue
      }

      if (aggregateFn === 'avg' || aggregateFn === 'median') {
        type = GraphQLFloat
      }

      const resolve = ({ results }) => {
        const values = results.map(result => result[attributeName])
        switch (aggregateFn) {
          case 'avg': return _.mean(values)
          case 'max': return _.max(values)
          case 'min': return _.min(values)
          case 'sum': return _.sum(values)
          case 'median': {
            values.sort()
            if (values.length % 2 === 0) {
              return (values[values.length / 2] + values[(values.length / 2) - 1]) / 2
            } else {
              return values[(values.length - 1) / 2] // array with odd number elements
            }
          }
          default: return 0
        }
      }

      fields[attributeName] = {
        type,
        resolve,
      }
    }

    if (!Object.keys(fields).length) {
      return
    }

    const name = getAggregateFieldTypeName(possibleTypeName || model.name, aggregateFn)

    for (const attributeName of Object.keys(fields)) {
      _.set(this.resolvers, `${name}.${attributeName}`, fields[attributeName].resolve)
    }

    const resolve = ({ results }) => ({ results })
    const aggregateFieldType = new GraphQLObjectType({
      name,
      fields,
    })

    this.typeMap[name] = aggregateFieldType
    _.set(this.resolvers, `${getAggregateTypeName(possibleTypeName || model.name)}.${aggregateFn}`, resolve)

    return {
      type: GraphQLNonNull(aggregateFieldType),
      resolve,
    }
  }

  generateQueryType (models, options) {
    const queryType = new GraphQLObjectType({
      name: 'Query',
      fields: () => {
        return Object.keys(models).reduce((fields, modelName) => {
          const model = models[modelName]
          const crud = model.options.crud || options.crud || []
          if (crud.includes('read')) {
            this.addFindAllField(model, fields)
            this.addFindOneField(model, fields)

            if (model.options.possibleTypes) {
              for (const possibleTypeName of model.options.possibleTypes) {
                this.addFindAllField(model, fields, possibleTypeName)
                this.addFindOneField(model, fields, possibleTypeName)
              }
            }
          }
          return fields
        }, {})
      },
    })

    if (Object.keys(queryType.getFields()).length) {
      this.typeMap.Query = queryType
      return queryType
    }
  }

  addFindAllField (model, fields, possibleTypeName) {
    const fieldName = possibleTypeName
      ? _.lowerFirst(pluralize(possibleTypeName))
      : _.lowerFirst(model.options.name.plural)
    const pageType = this.typeMap[getPageTypeName(possibleTypeName || model.name)]
    if (!pageType) {
      return
    }

    const args = this.generatePageArgs(model, possibleTypeName)

    const where = {}
    if (possibleTypeName) {
      where[model.options.typenameField] = possibleTypeName
    }
    const resolve = (parent, args, context, info) => {
      return model.paginate({ info, where })
    }

    fields[fieldName] = {
      type: GraphQLNonNull(pageType),
      args,
      resolve,
    }

    _.set(this.resolvers, `Query.${fieldName}`, resolve)
  }

  addFindOneField (model, fields, possibleTypeName) {
    const fieldName = possibleTypeName
      ? _.lowerFirst(possibleTypeName)
      : _.lowerFirst(model.options.name.singular)
    const fieldType = this.typeMap[possibleTypeName || model.name]
    const { primaryKeyAttribute } = model

    if (!fieldType || !primaryKeyAttribute) {
      return
    }

    const attribute = model.rawAttributes[primaryKeyAttribute]
    const argType = this.getGraphQLInputType(model, primaryKeyAttribute, attribute.type.constructor.name, attribute.type)
    const where = {}
    if (possibleTypeName) {
      where[model.options.typenameField] = possibleTypeName
    }

    const resolve = (parent, args, context, info) => {
      return model.findOne({ where: { ...where, ...args } })
    }

    fields[fieldName] = {
      type: fieldType,
      args: {
        [primaryKeyAttribute]: { type: GraphQLNonNull(argType) },
      },
      resolve,
    }

    _.set(this.resolvers, `Query.${fieldName}`, resolve)
  }

  generateMutationType (models, options) {
    const mutationType = new GraphQLObjectType({
      name: 'Mutation',
      fields: () => {
        return Object.keys(models).reduce((fields, modelName) => {
          const model = models[modelName]
          const crud = model.options.crud || options.crud || []
          if (crud.includes('create')) {
            this.addCreateField(model, options, fields)

            if (model.options.possibleTypes) {
              for (const possibleTypeName of model.options.possibleTypes) {
                this.addCreateField(model, options, fields, possibleTypeName)
              }
            }
          }
          if (crud.includes('update')) {
            this.addUpdateField(model, options, fields)

            if (model.options.possibleTypes) {
              for (const possibleTypeName of model.options.possibleTypes) {
                this.addUpdateField(model, options, fields, possibleTypeName)
              }
            }
          }
          if (crud.includes('delete')) {
            this.addDeleteField(model, options, fields)

            if (model.options.possibleTypes) {
              for (const possibleTypeName of model.options.possibleTypes) {
                this.addDeleteField(model, options, fields, possibleTypeName)
              }
            }
          }

          return fields
        }, {})
      },
    })

    if (Object.keys(mutationType.getFields()).length) {
      this.typeMap.Mutation = mutationType
      return mutationType
    }
  }

  addCreateField (model, options, fields, possibleTypeName) {
    const fieldName = 'create' + _.upperFirst(possibleTypeName || model.options.name.singular)
    const modelType = this.typeMap[possibleTypeName || model.name]
    const { primaryKeyAttribute } = model

    if (!modelType || !primaryKeyAttribute || (model.options.possibleTypes && !possibleTypeName)) {
      return
    }

    const payloadField = _.lowerFirst(modelType.name)
    const payloadType = this.generateCreatePayloadType(modelType, payloadField, possibleTypeName)
    const inputType = this.generateCreateInput(model, possibleTypeName)
    const resolve = async (parent, args, context, info) => {
      const [result, error] = await handleClientError(async () => {
        const usingPostgres = model.sequelize.options.dialect === 'postgres'
        const createOptions = { returning: usingPostgres ? true : undefined }

        if (possibleTypeName) {
          args.input.__typename = possibleTypeName
        }

        const instance = await model.create(args.input, { createOptions })
        if (!usingPostgres) {
          await instance.reload()
        }
        return model.findByPk(instance[primaryKeyAttribute], { info, path: payloadField })
      }, context)
      return { [payloadField]: result, error }
    }

    fields[fieldName] = {
      type: payloadType,
      args: {
        input: { type: GraphQLNonNull(inputType) },
      },
      resolve,
    }

    _.set(this.resolvers, `Mutation.${fieldName}`, resolve)
  }

  generateCreatePayloadType (modelType, payloadField, possibleTypeName) {
    return new GraphQLObjectType({
      name: `Create${possibleTypeName || modelType.name}Payload`,
      fields: {
        errors: { type: GraphQLList(GraphQLNonNull(ClientErrorType)) },
        [payloadField]: { type: modelType },
      },
    })
  }

  generateCreateInput (model, possibleTypeName) {
    const fields = {}

    for (const attributeName of Object.keys(model.rawAttributes)) {
      const attribute = model.rawAttributes[attributeName]
      if (attribute.public === false || attribute.create === false) {
        continue
      }

      if (possibleTypeName && attribute.actualTypes && !attribute.actualTypes.includes(possibleTypeName)) {
        continue
      }

      const inputType = this.getGraphQLInputType(model, attributeName, attribute.type.constructor.name, attribute.type)
      if (!inputType) {
        continue
      }

      const isNullable = attribute.allowNull || attribute.autoIncrement || attribute.defaultValue !== undefined
      const type = isNullable ? inputType : new GraphQLNonNull(inputType)
      fields[attributeName] = {
        type,
        description: attribute.comment,
        deprecationReason: attribute.deprecationReason,
      }
    }

    return new GraphQLInputObjectType({
      name: `Create${_.upperFirst(possibleTypeName || model.name)}Input`,
      fields,
    })
  }

  addUpdateField (model, options, fields, possibleTypeName) {
    const fieldName = 'update' + _.upperFirst(possibleTypeName || model.options.name.singular)
    const modelType = this.typeMap[possibleTypeName || model.name]
    const { primaryKeyAttribute } = model
    const attribute = model.rawAttributes[primaryKeyAttribute]
    const pkType = this.getGraphQLInputType(model, primaryKeyAttribute, attribute.type.constructor.name, attribute.type)

    if (!modelType || !primaryKeyAttribute || !pkType) {
      return
    }

    const payloadField = _.lowerFirst(modelType.name)
    const payloadType = this.generateUpdatePayloadType(modelType, payloadField, possibleTypeName)
    const inputType = this.generateUpdateInput(model, possibleTypeName)
    const resolve = async (parent, args, context, info) => {
      const [result, error] = await handleClientError(async () => {
        const where = { [primaryKeyAttribute]: args[primaryKeyAttribute] }
        if (possibleTypeName) {
          where[model.options.typenameField] = possibleTypeName
        }
        await model.update(args.input, { where })
        return model.findByPk(args[primaryKeyAttribute], { info, path: payloadField })
      }, context)
      return { [payloadField]: result, error }
    }

    fields[fieldName] = {
      type: payloadType,
      args: {
        [primaryKeyAttribute]: { type: GraphQLNonNull(pkType) },
        input: { type: GraphQLNonNull(inputType) },
      },
      resolve,
    }

    _.set(this.resolvers, `Mutation.${fieldName}`, resolve)
  }

  generateUpdatePayloadType (modelType, payloadField) {
    return new GraphQLObjectType({
      name: `Update${modelType.name}Payload`,
      fields: {
        errors: { type: GraphQLList(GraphQLNonNull(ClientErrorType)) },
        [payloadField]: { type: modelType },
      },
    })
  }

  generateUpdateInput (model, possibleTypeName) {
    const fields = {}

    for (const attributeName of Object.keys(model.rawAttributes)) {
      const attribute = model.rawAttributes[attributeName]
      if (attributeName === model.primaryKeyAttribute || attribute.public === false || attribute.update === false) {
        continue
      }

      if (possibleTypeName && attribute.actualTypes && !attribute.actualTypes.includes(possibleTypeName)) {
        continue
      }

      if (!possibleTypeName && attribute.actualTypes) {
        continue
      }

      const type = this.getGraphQLInputType(model, attributeName, attribute.type.constructor.name, attribute.type)
      if (!type) {
        continue
      }

      fields[attributeName] = {
        type,
        description: attribute.comment,
        deprecationReason: attribute.deprecationReason,
      }
    }

    return new GraphQLInputObjectType({
      name: `Update${_.upperFirst(possibleTypeName || model.name)}Input`,
      fields,
    })
  }

  addDeleteField (model, options, fields, possibleTypeName) {
    const fieldName = 'delete' + _.upperFirst(possibleTypeName || model.options.name.singular)
    const modelType = this.typeMap[possibleTypeName || model.name]
    const { primaryKeyAttribute } = model
    const attribute = model.rawAttributes[primaryKeyAttribute]
    const pkType = this.getGraphQLInputType(model, primaryKeyAttribute, attribute.type.constructor.name, attribute.type)

    if (!modelType || !primaryKeyAttribute || !pkType) {
      return
    }

    const payloadField = `deleted${_.upperFirst(primaryKeyAttribute)}`
    const payloadType = this.generateDeletePayloadType(modelType, payloadField, pkType, possibleTypeName)
    const resolve = async (parent, args, context, info) => {
      const [result, error] = await handleClientError(async () => {
        const where = { [primaryKeyAttribute]: args[primaryKeyAttribute] }
        if (possibleTypeName) {
          where[model.options.typenameField] = possibleTypeName
        }

        const count = await model.destroy({ where })
        return count > 0 ? args[primaryKeyAttribute] : null
      }, context)
      return { [payloadField]: result, error }
    }

    fields[fieldName] = {
      type: payloadType,
      args: {
        [primaryKeyAttribute]: { type: GraphQLNonNull(pkType) },
      },
      resolve,
    }

    _.set(this.resolvers, `Mutation.${fieldName}`, resolve)
  }

  generateDeletePayloadType (modelType, payloadField, pkType, possibleTypeName) {
    return new GraphQLObjectType({
      name: `Delete${possibleTypeName || modelType.name}Payload`,
      fields: {
        errors: { type: GraphQLList(GraphQLNonNull(ClientErrorType)) },
        [payloadField]: { type: pkType },
      },
    })
  }
}

function resolveAssociationField (model, association) {
  return async function (instance, args, context, info) {
    const resolvedValue = instance[info.fieldName]
    const isPageType = association.isMultiAssociation

    if (resolvedValue !== undefined) {
      if (!isPageType) {
        return resolvedValue
      }

      return pageObjectFromResults(resolvedValue, false, resolvedValue.length)
    }

    const method = instance[association.accessors.get].bind(instance)
    const options = findOptionsFromInfo(model, info, {}, isPageType)
    return isPageType
      ? paginate(association.target, method, options)
      : method(options)
  }
}

module.exports = {
  BaseSchemaBuilder,
  resolveAssociationField,
}
