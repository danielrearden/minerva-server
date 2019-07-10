const Sequelize = require('../')

describe('paginate', () => {
  const sequelize = new Sequelize(DATABASE_URL)
  let TestModel, TestModel2, allItems, allItemsByCounter

  beforeAll(async () => {
    await sequelize.getQueryInterface().dropTable('test_model')
    await sequelize.getQueryInterface().createTable('test_model', {
      id: { type: Sequelize.INTEGER, primaryKey: true },
      counter: { type: Sequelize.INTEGER },
      flag: { type: Sequelize.BOOLEAN },
    })
    await sequelize.getQueryInterface().dropTable('test_model2')
    await sequelize.getQueryInterface().createTable('test_model2', {
      id: { type: Sequelize.TEXT, primaryKey: true },
    })
    TestModel = sequelize.define('TestModel', {
      id: { type: Sequelize.INTEGER, primaryKey: true },
      counter: Sequelize.INTEGER,
      flag: Sequelize.BOOLEAN,
    }, { tableName: 'test_model', timestamps: false })
    TestModel2 = sequelize.define('TestModel2', {
      id: { type: Sequelize.TEXT, primaryKey: true },
    }, { tableName: 'test_model2', timestamps: false })
    await TestModel.bulkCreate([
      { counter: 4, id: 1, flag: true },
      { counter: 4, id: 2, flag: true },
      { counter: 1, id: 3, flag: false },
      { counter: 3, id: 4, flag: true },
      { counter: 2, id: 5, flag: true },
    ])
    await TestModel2.bulkCreate([
      { id: '00c015fa-571e-406b-9d98-aac927267306' },
      { id: '1b7efab2-9c95-44ff-8287-bb6f64ad14fb' },
      { id: '2506aa9c-de76-4646-a189-4afa81f91561' },
      { id: '33f96f60-998c-4fca-ad19-186d53665878' },
      { id: '48b2de75-9df7-4c38-ae06-60f0bf6f58d1' },
    ])

    allItems = await TestModel.paginate()
    allItemsByCounter = await TestModel.paginate({ paginateBy: 'counter' })
  })

  afterAll(async () => {
    await sequelize.getQueryInterface().dropTable('test_model')
    await sequelize.getQueryInterface().dropTable('test_model2')
    await sequelize.close()
  })

  it('returns results and pageInfo', async () => {
    const page = await TestModel.paginate()
    expect(page).toHaveProperty('pageInfo.hasNextPage')
    expect(page).toHaveProperty('pageInfo.hasPreviousPage')
    expect(page).toHaveProperty('results')
  })

  it('returns totalCount and pageCount', async () => {
    const page = await TestModel.paginate({ includeTotal: true })
    expect(page).toHaveProperty('pageInfo.totalCount')
    expect(page).toHaveProperty('pageInfo.pageCount')
    expect(page).toHaveProperty('pageInfo.numberPages')
    expect(page.pageInfo.totalCount).toEqual(page.results.length)
  })

  it('returns all items if first or last is not specified', async () => {
    const page = await TestModel.paginate()
    expect(page.results.length).toEqual(5)
    expect(getNodeIds(page)).toEqual([1, 2, 3, 4, 5])
  })

  it('returns correct results if additional where conditions are provided', async () => {
    const page = await TestModel.paginate({ first: 4, where: { flag: true } })
    expect(page.results.length).toEqual(4)
    expect(getNodeIds(page)).toEqual([1, 2, 4, 5])
  })

  it('returns correct results for model with non-numberic primary key field', async () => {
    const page = await TestModel2.paginate({ after: '1b7efab2-9c95-44ff-8287-bb6f64ad14fb' })
    expect(page.results.length).toEqual(3)
    expect(getNodeIds(page)).toEqual(['2506aa9c-de76-4646-a189-4afa81f91561', '33f96f60-998c-4fca-ad19-186d53665878', '48b2de75-9df7-4c38-ae06-60f0bf6f58d1'])
  })

  it('throws error if model does not have a primary key field', async () => {
    const TestModel3 = sequelize.define('TestModel3', {
      counter: Sequelize.INTEGER,
      flag: Sequelize.BOOLEAN,
    }, { tableName: 'test_model3', timestamps: false })
    TestModel3.removeAttribute('id')
    await expect(TestModel3.paginate()).rejects.toBeDefined()
  })

  it('throws error if both first and last are specified', async () => {
    await expect(TestModel.paginate({ first: 2, last: 2 })).rejects.toBeDefined()
  })

  describe('when pagination field is primary key field and order is ASC', () => {
    it('returns the first x results', async () => {
      const page = await TestModel.paginate({ first: 2 })
      expect(page.results.length).toEqual(2)
      expect(getNodeIds(page)).toEqual([1, 2])
    })

    it('returns the first x results after cursor', async () => {
      const cursor = allItems.results[1].id
      const page = await TestModel.paginate({ first: 2, after: cursor })
      expect(page.results.length).toEqual(2)
      expect(getNodeIds(page)).toEqual([3, 4])
    })

    it('returns the first x results before cursor', async () => {
      const cursor = allItems.results[3].id
      const page = await TestModel.paginate({ first: 4, before: cursor })
      expect(page.results.length).toEqual(3)
      expect(getNodeIds(page)).toEqual([1, 2, 3])
    })

    it('returns the first x results before cursor and after different cursor', async () => {
      const startCursor = allItems.results[0].id
      const endCursor = allItems.results[allItems.results.length - 1].id

      const page = await TestModel.paginate({ first: 2, before: endCursor, after: startCursor })
      expect(page.results.length).toEqual(2)
      expect(getNodeIds(page)).toEqual([2, 3])
    })

    it('returns the last x results', async () => {
      const page = await TestModel.paginate({ last: 2 })
      expect(page.results.length).toEqual(2)
      expect(getNodeIds(page)).toEqual([4, 5])
    })

    it('returns the last x results before cursor', async () => {
      const cursor = allItems.results[3].id
      const page = await TestModel.paginate({ last: 2, before: cursor })
      expect(page.results.length).toEqual(2)
      expect(getNodeIds(page)).toEqual([2, 3])
    })

    it('returns the last x results before cursor and after different cursor', async () => {
      const startCursor = allItems.results[0].id
      const endCursor = allItems.results[allItems.results.length - 1].id

      const page = await TestModel.paginate({ last: 2, before: endCursor, after: startCursor })
      expect(page.results.length).toEqual(2)
      expect(getNodeIds(page)).toEqual([3, 4])
    })
  })

  describe('when pagination field is primary key field and order is DESC', () => {
    it('returns the first x results', async () => {
      const page = await TestModel.paginate({ first: 2, desc: true })
      expect(page.results.length).toEqual(2)
      expect(getNodeIds(page)).toEqual([5, 4])
    })

    it('returns the first x results after cursor', async () => {
      const cursor = allItems.results[4].id
      const page2 = await TestModel.paginate({ first: 2, after: cursor, desc: true })
      expect(page2.results.length).toEqual(2)
      expect(getNodeIds(page2)).toEqual([4, 3])
    })

    it('returns the first x results before cursor', async () => {
      const cursor = allItems.results[1].id
      const page = await TestModel.paginate({ first: 4, before: cursor, desc: true })
      expect(page.results.length).toEqual(3)
      expect(getNodeIds(page)).toEqual([5, 4, 3])
    })

    it('returns the first x results before cursor and after different cursor', async () => {
      const startCursor = allItems.results[0].id
      const endCursor = allItems.results[allItems.results.length - 1].id

      const page = await TestModel.paginate({ first: 2, before: startCursor, after: endCursor, desc: true })
      expect(page.results.length).toEqual(2)
      expect(getNodeIds(page)).toEqual([4, 3])
    })

    it('returns the last x results', async () => {
      const page = await TestModel.paginate({ last: 2, desc: true })
      expect(page.results.length).toEqual(2)
      expect(getNodeIds(page)).toEqual([2, 1])
    })

    it('returns the last x results before cursor', async () => {
      const cursor = allItems.results[3].id
      const page = await TestModel.paginate({ last: 2, before: cursor, desc: true })
      expect(page.results.length).toEqual(1)
      expect(getNodeIds(page)).toEqual([5])
    })

    it('returns the last x results before cursor and after different cursor', async () => {
      const startCursor = allItems.results[0].id
      const endCursor = allItems.results[allItems.results.length - 1].id

      const page = await TestModel.paginate({ last: 2, before: startCursor, after: endCursor, desc: true })
      expect(page.results.length).toEqual(2)
      expect(getNodeIds(page)).toEqual([3, 2])
    })
  })

  describe('when pagination field is not primary key field and order is ASC', () => {
    it('returns the first x results', async () => {
      const page = await TestModel.paginate({ first: 2, paginateBy: 'counter' })
      expect(page.results.length).toEqual(2)
      expect(getNodeIds(page)).toEqual([3, 5])
    })

    it('returns the first x results after cursor', async () => {
      const cursor = allItemsByCounter.results[1].id
      const page2 = await TestModel.paginate({ first: 2, after: cursor, paginateBy: 'counter' })
      expect(page2.results.length).toEqual(2)
      expect(getNodeIds(page2)).toEqual([4, 1])
    })

    it('returns the first x results before cursor', async () => {
      const cursor = allItemsByCounter.results[3].id
      const page = await TestModel.paginate({ first: 4, before: cursor, paginateBy: 'counter' })
      expect(page.results.length).toEqual(3)
      expect(getNodeIds(page)).toEqual([3, 5, 4])
    })

    it('returns the first x results before cursor and after different cursor', async () => {
      const startCursor = allItemsByCounter.results[0].id
      const endCursor = allItemsByCounter.results[allItems.results.length - 1].id

      const page = await TestModel.paginate({ first: 2, before: endCursor, after: startCursor, paginateBy: 'counter' })
      expect(page.results.length).toEqual(2)
      expect(getNodeIds(page)).toEqual([5, 4])
    })

    it('returns the last x results', async () => {
      const page = await TestModel.paginate({ last: 2, paginateBy: 'counter' })
      expect(page.results.length).toEqual(2)
      expect(getNodeIds(page)).toEqual([1, 2])
    })

    it('returns the last x results before cursor', async () => {
      const cursor = allItemsByCounter.results[3].id
      const page = await TestModel.paginate({ last: 2, before: cursor, paginateBy: 'counter' })
      expect(page.results.length).toEqual(2)
      expect(getNodeIds(page)).toEqual([5, 4])
    })

    it('returns the last x results before cursor and after different cursor', async () => {
      const startCursor = allItemsByCounter.results[0].id
      const endCursor = allItemsByCounter.results[allItems.results.length - 1].id

      const page = await TestModel.paginate({ last: 2, before: endCursor, after: startCursor, paginateBy: 'counter' })
      expect(page.results.length).toEqual(2)
      expect(getNodeIds(page)).toEqual([4, 1])
    })
  })

  describe('when pagination field is not primary key field and order is DESC', () => {
    it('returns the first x results', async () => {
      const page = await TestModel.paginate({ first: 2, desc: true, paginateBy: 'counter' })
      expect(page.results.length).toEqual(2)
      expect(getNodeIds(page)).toEqual([2, 1])
    })

    it('returns the first x results after cursor', async () => {
      const cursor = allItemsByCounter.results[4].id
      const page2 = await TestModel.paginate({ first: 2, after: cursor, desc: true, paginateBy: 'counter' })
      expect(page2.results.length).toEqual(2)
      expect(getNodeIds(page2)).toEqual([1, 4])
    })

    it('returns the first x results before cursor', async () => {
      const cursor = allItemsByCounter.results[1].id
      const page = await TestModel.paginate({ first: 4, before: cursor, desc: true, paginateBy: 'counter' })
      expect(page.results.length).toEqual(3)
      expect(getNodeIds(page)).toEqual([2, 1, 4])
    })

    it('returns the first x results before cursor and after different cursor', async () => {
      const startCursor = allItemsByCounter.results[0].id
      const endCursor = allItemsByCounter.results[allItems.results.length - 1].id

      const page = await TestModel.paginate({ first: 2, before: startCursor, after: endCursor, desc: true, paginateBy: 'counter' })
      expect(page.results.length).toEqual(2)
      expect(getNodeIds(page)).toEqual([1, 4])
    })

    it('returns the last x results', async () => {
      const page = await TestModel.paginate({ last: 2, desc: true, paginateBy: 'counter' })
      expect(page.results.length).toEqual(2)
      expect(getNodeIds(page)).toEqual([5, 3])
    })

    it('returns the last x results before cursor', async () => {
      const cursor = allItemsByCounter.results[3].id
      const page = await TestModel.paginate({ last: 2, before: cursor, desc: true, paginateBy: 'counter' })
      expect(page.results.length).toEqual(1)
      expect(getNodeIds(page)).toEqual([2])
    })

    it('returns the last x results before cursor and after different cursor', async () => {
      const startCursor = allItemsByCounter.results[0].id
      const endCursor = allItemsByCounter.results[allItems.results.length - 1].id

      const page = await TestModel.paginate({ last: 2, before: startCursor, after: endCursor, desc: true, paginateBy: 'counter' })
      expect(page.results.length).toEqual(2)
      expect(getNodeIds(page)).toEqual([4, 5])
    })
  })
})

function getNodeIds (page) {
  return page.results.map(result => result.id)
}
