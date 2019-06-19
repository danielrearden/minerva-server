const { generateSchema } = require('../schema')
const Sequelize = require('../../sequelize')

describe('generateSchema', () => {
  let sequelize
  beforeEach(() => {
    sequelize = new Sequelize(process.env.DATABASE_URL || 'postgres://postgres@localhost:5432/postgres')
    sequelize.define('TestModel', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
      },
      someString: {
        type: Sequelize.TEXT,
      },
    })
  })

  it('should generate a schema', () => {
    const schema = generateSchema(sequelize, {})
    expect(schema.getTypeMap().TestModel).toBeDefined()
    expect(schema.getDirectives().find(directive => directive.name === 'paginate')).toBeDefined()
  })

  it('should generate a schema with additional typeDefs', () => {
    let typeDefs = `
      type Foo {
        bar: String
      }
    `
    let schema = generateSchema(sequelize, { typeDefs })
    expect(schema.getTypeMap().Foo).toBeDefined()

    typeDefs = [`
      type Foo {
        bar: String
      }
    `]
    schema = generateSchema(sequelize, { typeDefs })
    expect(schema.getTypeMap().Foo).toBeDefined()
  })

  it('should generate a schema without GraphQLUpload scalar', () => {
    const schema = generateSchema(sequelize, { uploads: false })
    expect(schema.getTypeMap().Upload).toBeUndefined()
  })
})
