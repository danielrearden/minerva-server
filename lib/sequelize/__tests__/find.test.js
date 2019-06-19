const Sequelize = require('sequelize')
const { makeExecutableSchema } = require('graphql-tools')
const { execute, parse, validate } = require('graphql')

const paginate = require('../../graphql/directives/paginate')
const { findOptionsFromInfo } = require('../find')
const { BaseSchemaBuilder } = require('../../graphql/base-schema-builder')

const { Op } = Sequelize

describe('findOptionsFromInfo', () => {
  const sequelize = new Sequelize(process.env.DATABSE_URL || 'postgres://postgres@localhost:5432/postgres')
  let TestModel, TestModel2, baseTypeDefs

  beforeAll(async () => {
    TestModel = sequelize.define('TestModel', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        sort: true,
        filter: true,
      },
      counter: Sequelize.INTEGER,
      flag: Sequelize.BOOLEAN,
    }, { tableName: 'find_test_model', timestamps: false })
    TestModel2 = sequelize.define('TestModel2', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        sort: true,
        filter: true,
      },
      testModelId: {
        type: Sequelize.INTEGER,
      },
      counter: Sequelize.INTEGER,
      flag: Sequelize.BOOLEAN,
    }, { tableName: 'find_test_model2', timestamps: false })
    TestModel.hasMany(TestModel2, { as: 'testModel2s', foreignKey: 'testModelId' })
    TestModel2.belongsTo(TestModel, { as: 'testModel', foreignKey: 'testModelId' })

    const baseSchemaBuilder = new BaseSchemaBuilder()
    const models = { TestModel, TestModel2 }
    const { typeDefs } = baseSchemaBuilder.build({ models })
    baseTypeDefs = typeDefs
  })

  afterAll(async () => {
    await sequelize.close()
  })

  async function getInfo (query) {
    const typeDefs = `
      ${baseTypeDefs}

      directive @paginate(
        type: String
        filter: Boolean = true
        sort: Boolean = true
      ) on FIELD_DEFINITION

      type Query {
        test: TestModel
        testPage: TestModelPage @paginate
      }
    `
    let infoToReturn
    const resolvers = {
      Query: {
        test: (root, args, context, info) => {
          infoToReturn = info
        },
        testPage: (root, args, context, info) => {
          infoToReturn = info
        },
      },
    }
    const schema = makeExecutableSchema({ typeDefs, resolvers, schemaDirectives: { paginate } })
    const document = parse(query)
    const validationErrors = validate(schema, document)
    if (validationErrors.length) {
      throw new Error(validationErrors[0])
    }
    const { errors } = execute(schema, document)
    if (errors && errors.length) {
      throw new Error(errors[0])
    }
    return infoToReturn
  }

  it('should return an object with no options', async () => {
    const info = await getInfo(`{
      testPage {
        pageInfo {
          hasNextPage
          hasPreviousPage
        }
      }
    }`)
    const options = findOptionsFromInfo(TestModel, info)
    expect(options).toMatchObject({
      include: [],
      order: [],
      where: { [Op.and]: [{}] },
    })
  })

  it('should return an object with paginate options', async () => {
    const info = await getInfo(`{
      testPage(first: 5, last: 7, before: "ABC", after: "DEF") {
        pageInfo {
          hasNextPage
          hasPreviousPage
        }
      }
    }`)
    let options = findOptionsFromInfo(TestModel, info, {}, true)
    expect(options).toMatchObject({
      first: 5,
      last: 7,
      before: 'ABC',
      after: 'DEF',
    })
    options = findOptionsFromInfo(TestModel, info, {}, false)
    expect(options.first).toBeUndefined()
    expect(options.last).toBeUndefined()
    expect(options.before).toBeUndefined()
    expect(options.after).toBeUndefined()
  })

  it('should return an object with order options', async () => {
    let info = await getInfo(`{
      testPage(sort: { dir: DESC, field: id }) {
        pageInfo {
          hasNextPage
          hasPreviousPage
        }
      }
    }`)
    let options = findOptionsFromInfo(TestModel, info, {}, false)
    expect(options).toMatchObject({
      order: [['id', 'DESC']],
    })
    options = findOptionsFromInfo(TestModel, info, {}, true)
    expect(options).toMatchObject({
      order: [],
      paginateBy: 'id',
      desc: true,
    })
    info = await getInfo(`{
      testPage(sort: { dir: ASC, field: id }) {
        pageInfo {
          hasNextPage
          hasPreviousPage
        }
      }
    }`)
    options = findOptionsFromInfo(TestModel, info, {}, false)
    expect(options).toMatchObject({
      order: [['id', 'ASC']],
    })
    options = findOptionsFromInfo(TestModel, info, {}, true)
    expect(options).toMatchObject({
      order: [],
      paginateBy: 'id',
      desc: false,
    })
  })

  it('should return an object with where options', async () => {
    let info = await getInfo(`{
      testPage(filter: {
        id_eq: 11
      }) {
        pageInfo {
          hasNextPage
          hasPreviousPage
        }
      }
    }`)
    let options = findOptionsFromInfo(TestModel, info, {}, false)
    expect(options.where[Op.and]).toEqual([
      { id: { [Op.eq]: 11 } },
      {}, // additional where options
    ])

    options = findOptionsFromInfo(TestModel, info, {}, true)
    expect(options.where[Op.and]).toEqual([
      { id: { [Op.eq]: 11 } },
      {}, // additional where options
    ])
    info = await getInfo(`{
      testPage(filter: {
        or: [
          { id_eq: 11 },
          { id_not_eq: 13 }
        ]
      }) {
        pageInfo {
          hasNextPage
          hasPreviousPage
        }
      }
    }`)
    options = findOptionsFromInfo(TestModel, info, {}, false)
    expect(options.where[Op.and]).toEqual([
      {
        [Op.or]: [
          {
            [Op.and]: [
              {
                id: {
                  [Op.eq]: 11,
                },
              },
            ],
          },
          {
            [Op.and]: [
              {
                [Op.not]: {
                  id: {
                    [Op.eq]: 13,
                  },
                },
              },
            ],
          },
        ],
      },
      {}, // additional where options
    ])
    options = findOptionsFromInfo(TestModel, info, {}, true)
    expect(options.where[Op.and]).toEqual([
      {
        [Op.or]: [
          {
            [Op.and]: [
              {
                id: {
                  [Op.eq]: 11,
                },
              },
            ],
          },
          {
            [Op.and]: [
              {
                [Op.not]: {
                  id: {
                    [Op.eq]: 13,
                  },
                },
              },
            ],
          },
        ],
      },
      {}, // additional where options
    ])
  })

  it('should return an object with additional where options', async () => {
    let info = await getInfo(`{
      testPage(filter: {
        id_eq: 11
      }) {
        pageInfo {
          hasNextPage
          hasPreviousPage
        }
      }
    }`)
    let options = findOptionsFromInfo(TestModel, info, { where: { flag: true } }, false)
    expect(options.where[Op.and]).toEqual([
      { id: { [Op.eq]: 11 } },
      { flag: true },
    ])
    options = findOptionsFromInfo(TestModel, info, { where: { flag: true } }, true)
    expect(options.where[Op.and]).toEqual([
      { id: { [Op.eq]: 11 } },
      { flag: true },
    ])
  })

  it('should return an object with include options', async () => {
    let info = await getInfo(`{
      testPage {
        results {
            id
            testModel2s(filter: { id_gt: 3 }, sort: { dir: DESC, field: id }) {
              results {
                  id
                  testModel {
                    id
                  }
              }
            }
        }
      }
    }`)
    const options = findOptionsFromInfo(TestModel, info, {}, false)
    expect(options.include).toMatchObject([
      { model: TestModel2 },
    ])
    expect(options.include[0].where[Op.and]).toEqual([
      { id: { [Op.gt]: 3 } },
    ])
    expect(options.include[0].include).toMatchObject([
      { model: TestModel },
    ])
    expect(options.order).toMatchObject([[
      { model: TestModel2 }, 'id', 'DESC',
    ]])
  })
})
