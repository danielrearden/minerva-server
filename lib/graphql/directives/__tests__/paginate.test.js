const { makeExecutableSchema } = require('graphql-tools')

const Sequelize = require('../../../sequelize')
const paginate = require('../paginate')
const { BaseSchemaBuilder } = require('../../base-schema-builder')

describe('@paginate', () => {
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

      directive @paginate(
        type: String
        filter: Boolean = true
        sort: Boolean = true
      ) on FIELD_DEFINITION

      type Query {
        test: TestModelPage @paginate
        test2: TestModelPage @paginate(type: "TestModel")
        test3: TestModelPage @paginate(type: "TeztModel")
        test4: TestModelPage @paginate(sort: false)
        test5: TestModelPage @paginate(filter: false)
        test6: TestModel @paginate
      }
    `
    const resolvers = {}
    schema = makeExecutableSchema({ typeDefs, resolvers, schemaDirectives: { paginate } })
  })

  afterAll(async () => {
    await sequelize.close()
  })

  it('should decorate the field with pagination arguments using default type name', async () => {
    const args = schema.getQueryType().getFields().test.args
    expect(args).toMatchObject([
      { name: 'after' },
      { name: 'before' },
      { name: 'first' },
      { name: 'last' },
      { name: 'sort' },
      { name: 'filter' },
    ])
    expect(args.length).toBe(6)
  })

  it('should decorate the field with pagination arguments using specified type name', async () => {
    const args = schema.getQueryType().getFields().test2.args
    expect(args).toMatchObject([
      { name: 'after' },
      { name: 'before' },
      { name: 'first' },
      { name: 'last' },
      { name: 'sort' },
      { name: 'filter' },
    ])
    expect(args.length).toBe(6)
  })

  it('should not decorate the field with a filter or sort arguments if a filter type is not found', async () => {
    const args = schema.getQueryType().getFields().test3.args
    expect(args).toMatchObject([
      { name: 'after' },
      { name: 'before' },
      { name: 'first' },
      { name: 'last' },
    ])
    expect(args.length).toBe(4)
  })

  it('should not decorate the field with a sort argument if sort = false', async () => {
    const args = schema.getQueryType().getFields().test4.args
    expect(args).toMatchObject([
      { name: 'after' },
      { name: 'before' },
      { name: 'first' },
      { name: 'last' },
      { name: 'filter' },
    ])
    expect(args.length).toBe(5)
  })

  it('should not decorate the field with a filter argument if filter = false', async () => {
    const args = schema.getQueryType().getFields().test5.args
    expect(args).toMatchObject([
      { name: 'after' },
      { name: 'before' },
      { name: 'first' },
      { name: 'last' },
      { name: 'sort' },
    ])
    expect(args.length).toBe(5)
  })

  it('should still decorate the field even if return type is not a Page', async () => {
    const args = schema.getQueryType().getFields().test6.args
    expect(args).toMatchObject([
      { name: 'after' },
      { name: 'before' },
      { name: 'first' },
      { name: 'last' },
    ])
    expect(args.length).toBe(4)
  })
})
