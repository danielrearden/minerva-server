const {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLInt,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLString,
  GraphQLNonNull,
  GraphQLUnionType,
  graphql,
} = require('graphql')
const {
  GraphQLDate,
  GraphQLDateTime,
  GraphQLTime,
  GraphQLJSON,
  GraphQLUUID,
} = require('../scalars')

const Sequelize = require('../../sequelize')
const { BaseSchemaBuilder } = require('../base-schema-builder')

describe('BaseSchemaBuilder', () => {
  let buildBaseSchema, sequelize

  beforeEach(() => {
    sequelize = new Sequelize(process.env.DATABASE_URL || 'postgres://postgres@localhost:5432/postgres')
    buildBaseSchema = () => new BaseSchemaBuilder().build(sequelize).schema
  })

  afterAll(async () => {
    await sequelize.close()
  })

  describe('schema generation', () => {
    it('should generate various types associated with the model', () => {
      sequelize.define('TestModel', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
        },
      })
      const schema = buildBaseSchema()

      expect(schema.getType('TestModel')).toBeDefined()
      expect(schema.getType('TestModelPage')).toBeDefined()
      expect(schema.getType('TestModelSort')).toBeDefined()
      expect(schema.getType('TestModelFilter')).toBeDefined()
    })

    it('should not expose the model if public is set to false', () => {
      sequelize.define('TestModel', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
        },
      }, {
        public: false,
        crud: ['read', 'update', 'create', 'delete'],
      })
      const schema = buildBaseSchema()
      expect(schema.getType('TestModel')).toBeUndefined()
      expect(schema.getType('TestModelPage')).toBeUndefined()
      expect(schema.getType('Query')).toBeUndefined()
      expect(schema.getType('Mutation')).toBeUndefined()
    })

    it('should not expose the field if public is set to false', () => {
      sequelize.define('TestModel', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
        },
        someInt: {
          type: Sequelize.INTEGER,
          public: false,
        },
      })
      const schema = buildBaseSchema()
      const testModelType = schema.getType('TestModel')
      expect(testModelType.getFields().someInt).toBeUndefined()
    })

    it('should generate the appropriate field types', () => {
      sequelize.define('TestModel', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
        },
        someString: {
          type: Sequelize.TEXT,
        },
        someRequired: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        someInt: {
          type: Sequelize.INTEGER,
        },
        someInt2: {
          type: Sequelize.SMALLINT,
        },
        someInt3: {
          type: Sequelize.MEDIUMINT,
        },
        someInt4: {
          type: Sequelize.BIGINT,
        },
        someFloat: {
          type: Sequelize.FLOAT,
        },
        someFloat2: {
          type: Sequelize.REAL,
        },
        someFloat3: {
          type: Sequelize.DOUBLE,
        },
        someFloat4: {
          type: Sequelize.DECIMAL,
        },
        someBool: {
          type: Sequelize.BOOLEAN,
        },
        someDate: {
          type: Sequelize.DATEONLY,
        },
        someDateTime: {
          type: Sequelize.DATE,
        },
        someTime: {
          type: Sequelize.TIME,
        },
        someJSON: {
          type: Sequelize.JSON,
        },
        someJSONB: {
          type: Sequelize.JSONB,
        },
        someEnum: {
          type: Sequelize.ENUM(['FOO', 'BAR']),
        },
        someStringArray: {
          type: Sequelize.ARRAY(Sequelize.STRING),
        },
        someRange: {
          type: Sequelize.RANGE(Sequelize.DATE),
        },
        someGeometry: {
          type: Sequelize.GEOMETRY,
        },
        someValidVirtual: {
          type: Sequelize.VIRTUAL(Sequelize.STRING, ['someString']),
        },
        someInvalidVirtual: {
          type: Sequelize.VIRTUAL,
        },
        someInvalidVirtual2: {
          type: Sequelize.VIRTUAL(Sequelize.STRING),
        },
      }, {
        crud: ['create', 'update'],
      })
      const schema = buildBaseSchema()
      const enumType = schema.getType('TestModelSomeEnum')
      const fields = schema.getType('TestModel').getFields()
      expect(fields.id.type).toEqual(GraphQLNonNull(GraphQLUUID))
      expect(fields.someString.type).toEqual(GraphQLString)
      expect(fields.someRequired.type).toEqual(GraphQLNonNull(GraphQLString))
      expect(fields.someInt.type).toEqual(GraphQLInt)
      expect(fields.someInt2.type).toEqual(GraphQLInt)
      expect(fields.someInt3.type).toEqual(GraphQLInt)
      expect(fields.someInt4.type).toEqual(GraphQLInt)
      expect(fields.someFloat.type).toEqual(GraphQLFloat)
      expect(fields.someFloat2.type).toEqual(GraphQLFloat)
      expect(fields.someFloat3.type).toEqual(GraphQLFloat)
      expect(fields.someFloat4.type).toEqual(GraphQLFloat)
      expect(fields.someBool.type).toEqual(GraphQLBoolean)
      expect(fields.someDate.type).toEqual(GraphQLDate)
      expect(fields.someDateTime.type).toEqual(GraphQLDateTime)
      expect(fields.someTime.type).toEqual(GraphQLTime)
      expect(fields.someJSON.type).toEqual(GraphQLJSON)
      expect(fields.someJSONB.type).toEqual(GraphQLJSON)
      expect(fields.someEnum.type).toEqual(enumType)
      expect(fields.someStringArray.type).toEqual(GraphQLList(GraphQLNonNull(GraphQLString)))
      expect(fields.someRange.type).toEqual(GraphQLList(GraphQLNonNull(GraphQLDateTime)))
      expect(fields.someValidVirtual.type).toEqual(GraphQLString)
      expect(fields.someInvalidVirtual).toBeUndefined()
      expect(fields.someInvalidVirtual2).toBeUndefined()
      expect(fields.someGeometry).toBeUndefined()
    })

    it('should add fields to the sort/filter options', () => {
      sequelize.define('TestModel', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
        },
        someInt: {
          type: Sequelize.INTEGER,
          filter: false,
        },
        someString: {
          allowNull: true,
          type: Sequelize.TEXT,
          sort: false,
        },
      })
      const schema = buildBaseSchema()
      const testModelSortType = schema.getType('TestModelSort')
      const testModelSortEnum = schema.getType('TestModelSortField')
      const testModelFilterType = schema.getType('TestModelFilter')

      expect(testModelSortType).toBeDefined()
      expect(testModelSortEnum).toBeDefined()
      expect(testModelFilterType).toBeDefined()
      expect(testModelSortEnum.getValue('someInt')).toBeDefined()
      expect(testModelSortEnum.getValue('someString')).toBeUndefined()
      expect(testModelFilterType.getFields().someString_eq).toBeDefined()
      expect(testModelFilterType.getFields().someString_not_eq).toBeDefined()
      expect(testModelFilterType.getFields().and).toBeDefined()
      expect(testModelFilterType.getFields().or).toBeDefined()
      expect(testModelFilterType.getFields().someInt).toBeUndefined()
    })

    it('should not create filter/sort types if there are no filterable/sortable fields', () => {
      sequelize.define('TestModel', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          public: false,
        },
      }, {
        timestamps: false,
      })
      const schema = buildBaseSchema()

      expect(schema.getType('TestModelSort')).toBeUndefined()
      expect(schema.getType('TestModelSortField')).toBeUndefined()
      expect(schema.getType('TestModelFilter')).toBeUndefined()
    })

    it('should generate fields for associations', () => {
      const TestModel = sequelize.define('TestModel', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
        },
      })
      const TestModel2 = sequelize.define('TestModel2', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
        },
      })
      const TestModel3 = sequelize.define('TestModel3', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
        },
        testModelId: {
          type: Sequelize.UUID,
          primaryKey: true,
        },
        testModel2Id: {
          type: Sequelize.UUID,
          primaryKey: true,
        },
      })
      TestModel3.belongsTo(TestModel, { foreignKey: 'testModelId' })
      TestModel3.belongsTo(TestModel2, { foreignKey: 'testModel2Id', public: false })
      TestModel.hasMany(TestModel3, { foreignKey: 'testModelId' })
      const schema = buildBaseSchema()
      expect(schema.getType('TestModel').getFields().testModel3s).toBeDefined()
      expect(schema.getType('TestModel3').getFields().testModel).toBeDefined()
      expect(schema.getType('TestModel3').getFields().testModel2).toBeUndefined()
    })

    it('should generate queries for model', () => {
      sequelize.define('TestModel', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
        },
        someString: {
          allowNull: true,
          type: Sequelize.TEXT,
        },
      }, {
        crud: ['read'],
      })
      const schema = buildBaseSchema()
      const queryType = schema.getType('Query')
      const testModelField = queryType.getFields().testModel
      const testModelsField = queryType.getFields().testModels

      expect(testModelField).toBeDefined()
      expect(testModelsField).toBeDefined()
    })

    it('should generate update mutation for model', () => {
      sequelize.define('TestModel', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
        },
        someString: {
          allowNull: true,
          type: Sequelize.TEXT,
        },
      }, {
        crud: ['update'],
      })
      const schema = buildBaseSchema()
      const mutationType = schema.getType('Mutation')
      const field = mutationType.getFields().updateTestModel

      expect(field).toBeDefined()
    })

    it('should generate create mutation for model', () => {
      sequelize.define('TestModel', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
        },
        someString: {
          allowNull: true,
          type: Sequelize.TEXT,
        },
      }, {
        crud: ['create'],
      })
      const schema = buildBaseSchema()
      const mutationType = schema.getType('Mutation')
      const field = mutationType.getFields().createTestModel

      expect(field).toBeDefined()
    })

    it('should generate delete mutation for model', () => {
      sequelize.define('TestModel', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
        },
      }, {
        crud: ['delete'],
      })
      const schema = buildBaseSchema()
      const mutationType = schema.getType('Mutation')
      const field = mutationType.getFields().deleteTestModel

      expect(field).toBeDefined()
    })

    it('should generate interface and possible types', () => {
      const TestModel = sequelize.define('TestModel', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
        },
      })
      const TestModel2 = sequelize.define('TestModel2', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
        },
      })
      const TestModel3 = sequelize.define('TestModel3', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
        },
        type: {
          type: Sequelize.TEXT,
        },
        testModelId: {
          type: Sequelize.UUID,
          actualTypes: ['Foo'],
        },
        testModel2Id: {
          type: Sequelize.UUID,
          actualTypes: ['Bar'],
        },
        testModel3Id: {
          type: Sequelize.UUID,
        },
      }, {
        timestamps: false,
        possibleTypes: ['Foo', 'Bar'],
        crud: ['read', 'create', 'update', 'delete'],
      })
      TestModel3.belongsTo(TestModel, { foreignKey: 'testModelId', actualTypes: ['Foo'] })
      TestModel3.belongsTo(TestModel2, { foreignKey: 'testModel2Id', actualTypes: ['Bar'] })
      TestModel3.belongsTo(TestModel3, { foreignKey: 'testModel3Id' })
      const schema = buildBaseSchema()
      const interfaceType = schema.getType('TestModel3')
      const interfaceTypeFields = interfaceType.getFields()
      const fooTypeFields = schema.getType('Foo').getFields()
      const barTypeFields = schema.getType('Bar').getFields()

      expect(interfaceType).toBeInstanceOf(GraphQLInterfaceType)
      expect(interfaceTypeFields.type).toBeDefined()
      expect(interfaceTypeFields.testModelId).toBeUndefined()
      expect(interfaceTypeFields.testModel2Id).toBeUndefined()
      expect(interfaceTypeFields.testModel3Id).toBeDefined()
      expect(interfaceTypeFields.testModel).toBeUndefined()
      expect(interfaceTypeFields.testModel2).toBeUndefined()
      expect(interfaceTypeFields.testModel3).toBeDefined()

      expect(fooTypeFields.type).toBeDefined()
      expect(fooTypeFields.testModelId).toBeDefined()
      expect(fooTypeFields.testModel2Id).toBeUndefined()
      expect(fooTypeFields.testModel3Id).toBeDefined()
      expect(fooTypeFields.testModel).toBeDefined()
      expect(fooTypeFields.testModel2).toBeUndefined()
      expect(fooTypeFields.testModel3).toBeDefined()

      expect(barTypeFields.type).toBeDefined()
      expect(barTypeFields.testModelId).toBeUndefined()
      expect(barTypeFields.testModel2Id).toBeDefined()
      expect(barTypeFields.testModel3Id).toBeDefined()
      expect(barTypeFields.testModel).toBeUndefined()
      expect(barTypeFields.testModel2).toBeDefined()
      expect(barTypeFields.testModel3).toBeDefined()
    })

    it('should generate union and possible types', () => {
      sequelize.define('TestModel', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          actualTypes: ['Foo', 'Bar'],
        },
        type: {
          type: Sequelize.TEXT,
          actualTypes: ['Foo', 'Bar'],
        },
        foo: {
          allowNull: true,
          type: Sequelize.TEXT,
          actualTypes: ['Foo'],
        },
        bar: {
          allowNull: true,
          type: Sequelize.TEXT,
          actualTypes: ['Bar'],
        },
      }, {
        timestamps: false,
        possibleTypes: ['Foo', 'Bar'],
      })
      const schema = buildBaseSchema()
      const unionType = schema.getType('TestModel')
      const fooType = schema.getType('Foo')
      const barType = schema.getType('Bar')
      const fooTypeFields = fooType.getFields()
      const barTypeFields = barType.getFields()

      expect(unionType).toBeInstanceOf(GraphQLUnionType)
      expect(unionType.getTypes()).toContain(fooType)
      expect(unionType.getTypes()).toContain(barType)

      expect(fooTypeFields.type).toBeDefined()
      expect(fooTypeFields.foo).toBeDefined()
      expect(fooTypeFields.bar).toBeUndefined()

      expect(barTypeFields.type).toBeDefined()
      expect(barTypeFields.foo).toBeUndefined()
      expect(barTypeFields.bar).toBeDefined()
    })

    it('should throw if passed invalid typenameField option', () => {
      sequelize.define('TestModel', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
        },
      }, {
        possibleTypes: ['Foo', 'Bar'],
        typenameField: 'ofType',
      })
      expect(() => buildBaseSchema()).toThrow()
    })
  })

  describe('field resolution', () => {
    beforeEach(async () => {
      await sequelize.getQueryInterface().dropTable('humans')
      await sequelize.getQueryInterface().createTable('humans', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
        },
        count: {
          type: Sequelize.INTEGER,
        },
      })
      await sequelize.getQueryInterface().dropTable('animals')
      await sequelize.getQueryInterface().createTable('animals', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
        },
        type: {
          type: Sequelize.STRING,
        },
        picnic_baskets: {
          type: Sequelize.INTEGER,
        },
        count: {
          type: Sequelize.INTEGER,
        },
        human_id: {
          type: Sequelize.INTEGER,
        },
      })

      const Human = sequelize.define('Human', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
        },
        count: {
          type: Sequelize.INTEGER,
        },
      }, {
        crud: ['read', 'update', 'create', 'delete'],
        timestamps: false,
      })
      const Animal = sequelize.define('Animal', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
        },
        type: {
          type: Sequelize.STRING,
        },
        count: {
          type: Sequelize.INTEGER,
        },
        picnicBaskets: {
          type: Sequelize.INTEGER,
          actualTypes: ['Bear'],
        },
        humanId: {
          type: Sequelize.INTEGER,
        },
      }, {
        crud: ['read', 'update', 'create', 'delete'],
        possibleTypes: ['Lion', 'Tiger', 'Bear'],
        timestamps: false,
      })
      Human.hasMany(Animal, { foreignKey: 'humanId', as: 'pets' })

      await Human.bulkCreate([
        { count: 6, id: 1 },
        { count: 4, id: 2 },
        { count: 2, id: 3 },
      ])

      await Animal.bulkCreate([
        { type: 'Bear', count: 1, picnicBaskets: 4, id: 1 },
        { type: 'Bear', count: 1, picnicBaskets: 2, id: 2 },
        { type: 'Lion', count: 1, humanId: 1, id: 3 },
        { type: 'Tiger', count: 1, id: 4 },
      ])
    })

    async function execute (query, variables = {}) {
      const schema = buildBaseSchema()
      const { data, errors } = await graphql(schema, query, {}, {}, variables)
      if (errors) {
        throw errors[0]
      }
      return data
    }

    it('should fetch all instances of a model', async () => {
      const { humans, animals, bears, lions, tigers } = await execute(`{
        humans {
          results {
            id
          }
          aggregate {
            avg {
              count
            }
            max {
              count
            }
            min {
              count
            }
            median {
              count
            }
            sum {
              count
            }
          }
        }
        animals {
          results {
            id
          }
        }
        bears {
          results {
            id
          }
          aggregate {
            avg {
              picnicBaskets
            }
            max {
              picnicBaskets
            }
            min {
              picnicBaskets
            }
            median {
              picnicBaskets
            }
            sum {
              picnicBaskets
            }
          }
        }
        lions {
          results {
            id
          }
        }
        tigers {
          results {
            id
          }
        }
      }`)

      expect(humans.results.length).toEqual(3)
      expect(animals.results.length).toEqual(4)
      expect(bears.results.length).toEqual(2)
      expect(lions.results.length).toEqual(1)
      expect(tigers.results.length).toEqual(1)
      expect(humans.aggregate).toMatchObject({
        avg: { count: 4 },
        max: { count: 6 },
        min: { count: 2 },
        median: { count: 4 },
        sum: { count: 12 },
      })
      expect(bears.aggregate).toMatchObject({
        avg: { picnicBaskets: 3 },
        max: { picnicBaskets: 4 },
        min: { picnicBaskets: 2 },
        median: { picnicBaskets: 3 },
        sum: { picnicBaskets: 6 },
      })
    })

    it('should fetch a single model instance', async () => {
      const { human, animal, bear, lion, tiger } = await execute(`{
        human(id: 1) {
          id
        }
        animal(id: 2) {
          id
        }
        bear(id: 1) {
          id
        }
        lion(id: 3) {
          id
        }
        tiger(id: 4) {
          id
        }
      }`)

      expect(human.id).toBeDefined()
      expect(animal.id).toBeDefined()
      expect(bear.id).toBeDefined()
      expect(lion.id).toBeDefined()
      expect(tiger.id).toBeDefined()
    })

    it('should fetch associated instances', async () => {
      const { human } = await execute(`{
        human(id: 1) {
          pets {
            results{
              id
            }
          }
        }
      }`)

      expect(human.pets.results[0].id).toBeDefined()
    })

    it('should update a model instance', async () => {
      const { updateHuman, updateAnimal, updateBear, updateLion, updateTiger } = await execute(`mutation {
        updateHuman(id: 1, input: { count: 5 }) {
          human {
            count
          }
        }
        updateAnimal(id: 2, input: { count: 5 }) {
          animal {
            count
          }
        }
        updateBear(id: 1, input: { count: 5 }) {
          bear {
            count
          }
        }
        updateLion(id: 3, input: { count: 5 }) {
          lion {
            count
          }
        }
        updateTiger(id: 4, input: { count: 5 }) {
          tiger {
            count
          }  
        }
      }`)

      expect(updateHuman.human.count).toEqual(5)
      expect(updateAnimal.animal.count).toEqual(5)
      expect(updateBear.bear.count).toEqual(5)
      expect(updateLion.lion.count).toEqual(5)
      expect(updateTiger.tiger.count).toEqual(5)
    })

    it('should create a model instance', async () => {
      const { createHuman, createBear, createLion, createTiger } = await execute(`mutation {
        createHuman(input: { id: 5, count: 5 }) {
          human {
            id
            count
          }
        }
        createBear(input: { id: 7, count: 5 }) {
          bear {
            id
            count
          }
        }
        createLion(input: { id: 8, count: 5 }) {
          lion {
            id
            count
          }
        }
        createTiger(input: { id: 9, count: 5 }) {
          tiger {
            id
            count
          }  
        }
      }`)

      expect(createHuman.human.count).toEqual(5)
      expect(createBear.bear.count).toEqual(5)
      expect(createLion.lion.count).toEqual(5)
      expect(createTiger.tiger.count).toEqual(5)
    })

    it('should delete a model instance', async () => {
      const { deleteHuman, deleteAnimal, deleteBear, deleteLion, deleteTiger } = await execute(`mutation {
        deleteHuman(id: 1) {
          deletedId
        }
        deleteAnimal(id: 2) {
          deletedId
        }
        deleteBear(id: 1) {
          deletedId
        }
        deleteLion(id: 3) {
          deletedId
        }
        deleteTiger(id: 4) {
          deletedId
        }
      }`)

      expect(deleteHuman.deletedId).toEqual(1)
      expect(deleteAnimal.deletedId).toEqual(2)
      expect(deleteBear.deletedId).toEqual(1)
      expect(deleteLion.deletedId).toEqual(3)
      expect(deleteTiger.deletedId).toEqual(4)
    })

    afterEach(async () => {
      await sequelize.getQueryInterface().dropTable('users')
      await sequelize.getQueryInterface().dropTable('animals')
    })
  })
})
