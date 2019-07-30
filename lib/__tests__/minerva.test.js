const express = require('express')
const request = require('supertest')
const { MinervaServer, Sequelize } = require('../minerva')

describe('MinervaServer', () => {
  const models = [(sequelize, Sequelize) => {
    return sequelize.define('TestModel', {
      foo: {
        type: Sequelize.STRING,
      },
    })
  }]
  const config = {
    database: {
      url: DATABASE_URL,
      models,
    },
    graphql: {
      typeDefs: `type Query { foo: String }`,
      context: () => ({}),
    },
  }

  it('should initialize a new server instance', () => {
    const server = new MinervaServer(config)

    expect(server.sequelize).toBeDefined()
    expect(server.models).toBeDefined()
    expect(server.options).toBeDefined()
  })

  it('should take an existing sequelize instance', () => {
    const sequelize = new Sequelize(DATABASE_URL)
    const withSequelize = { ...config, database: sequelize }
    const server = new MinervaServer(withSequelize)

    expect(server.sequelize).toBeDefined()
  })

  it('should start the server', async () => {
    const server = new MinervaServer(config)
    await server.start()
    const response = await request(server.app)
      .post('/graphql')
      .send({ query: '{foo}' })
    await server.stop()

    expect(response.status).toEqual(200)
    expect(response.text.trim()).toEqual('{"data":{"foo":null}}')
  })

  it('should apply middleware to existing app', async () => {
    const app = express()
    const server = new MinervaServer(config)
    const middleware = server.getMiddleware()
    app.use(middleware)
    const response = await request(app)
      .post('/graphql')
      .send({ query: '{foo}' })

    expect(response.status).toEqual(200)
    expect(response.text.trim()).toEqual('{"data":{"foo":null}}')
  })

  it('should throw when provided invalid config', async () => {
    expect(() => new MinervaServer({ graphql: config.graphql })).toThrow()
    expect(() => new MinervaServer({ graphql: config.graphql, database: { url: DATABASE_URL } })).toThrow()
  })
})
