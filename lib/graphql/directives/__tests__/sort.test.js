const { makeExecutableSchema } = require('graphql-tools')

const Sequelize = require('../../../sequelize')
const sort = require('../sort')
const { BaseSchemaBuilder } = require('../../base-schema-builder')

describe('@sort', () => {
  let schema, sequelize

  beforeAll(async () => {
    sequelize = new Sequelize(process.env.DATABASE_URL || 'postgres://postgres@localhost:5432/postgres')
    sequelize.define('TestModel', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        sort: true,
        filter: true,
      },
      counter: Sequelize.INTEGER,
      flag: Sequelize.BOOLEAN,
    }, { timestamps: false })
    const baseSchemaBuilder = new BaseSchemaBuilder()
    const { typeDefs: baseTypeDefs } = baseSchemaBuilder.build(sequelize)
    const typeDefs = `
      ${baseTypeDefs}

      directive @sort(
        type: String
      ) on FIELD_DEFINITION

      type Query {
        test: TestModel @sort
        test2: TestModel @sort(type: "TestModel")
        test3: TestModel @sort(type: "TeztModel")
      }
    `
    const resolvers = {}
    schema = makeExecutableSchema({ typeDefs, resolvers, schemaDirectives: { sort } })
  })

  afterAll(async () => {
    await sequelize.close()
  })

  it('should decorate the field with a sort argument using default type name', async () => {
    const args = schema.getQueryType().getFields().test.args
    expect(args).toMatchObject([{ name: 'sort' }])
  })

  it('should decorate the field with a sort argument using specified type name', async () => {
    const args = schema.getQueryType().getFields().test2.args
    expect(args).toMatchObject([{ name: 'sort' }])
  })

  it('should not decorate the field with a sort argument if a sort type is not found', async () => {
    const args = schema.getQueryType().getFields().test3.args
    expect(args.length).toBe(0)
  })
})
