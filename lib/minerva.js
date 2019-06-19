const express = require('express')
const http = require('http')
const Apollo = require('apollo-server-express')
const { ApolloServer } = Apollo

const Sequelize = require('./sequelize')
const { generateSchema } = require('./graphql/schema')
const scalars = require('./graphql/scalars')

class MinervaServer {
  constructor (options = {}) {
    this.sequelize = this.initializeSequelize(options.database)
    this.apollo = this.initializeApollo(this.sequelize, options.graphql)
    this.models = this.sequelize.models
    this.app = express()
    this.httpServer = undefined
    this.options = options
  }

  initializeSequelize (options) {
    if (!options) {
      throw new Error('Must provide "database" option.')
    }

    if (options instanceof Sequelize) {
      return options
    }

    const { url, username, password, database, models, ...otherOptions } = options
    let sequelize

    if (url) {
      sequelize = new Sequelize(url, otherOptions)
    } else {
      sequelize = new Sequelize(database, username, password, otherOptions)
    }

    if (!models) {
      throw new Error('Must provide "database.models" option.')
    }

    models.forEach((model) => {
      model(sequelize, Sequelize)
    })

    Object.keys(sequelize.models).forEach((modelName) => {
      const model = sequelize.models[modelName]
      if (model.associate) {
        model.associate(sequelize.models)
      }
    })

    return sequelize
  }

  initializeApollo (sequelize, options = {}) {
    const context = this.createContext(sequelize, options)
    const schema = generateSchema(sequelize, options)
    const { typeDefs, resolvers, schemaDirectives, modules, ...otherOptions } = options
    return new ApolloServer({ ...otherOptions, schema, context })
  }

  createContext ({ models }, { context = {}, formatClientError }) {
    return async ({ req, res }) => {
      let baseContext = context
      if (typeof context === 'function') {
        baseContext = await context({ req, res })
      }
      return {
        ...baseContext,
        formatClientError,
        models,
      }
    }
  }

  applyMiddleware ({ app, ...options }) {
    const { apollo, options: { server = {} } } = this
    const { cors, disableHealthCheck, path = '/graphql', onHealthCheck } = { ...server, ...options }
    return apollo.applyMiddleware({ app, path, cors, disableHealthCheck, onHealthCheck })
  }

  async start () {
    const { apollo, app, sequelize, options: { server = {} } } = this
    const { cors, disableHealthCheck, host, path = '/graphql', port = 4000, onHealthCheck } = server
    apollo.applyMiddleware({ app, path, cors, disableHealthCheck, onHealthCheck })

    await sequelize.authenticate()

    const httpServer = http.createServer(app)
    this.httpServer = httpServer

    await new Promise(resolve => {
      httpServer.once('listening', resolve)
      httpServer.listen(port, host)
    })

    return this.createServerInfo(httpServer, this.apollo.subscriptionsPath)
  }

  async stop () {
    if (this.httpServer) {
      const httpServer = this.httpServer
      await new Promise(resolve => httpServer.close(resolve))
      this.httpServer = undefined
    }
    await this.apollo.stop()
  }

  createServerInfo (server, subscriptionsPath) {
    const serverInfo = {
      ...server.address(),
      server,
      subscriptionsPath,
    }
    const { server: { path = '/graphql' } = {} } = this.options

    let hostForUrl = serverInfo.address
    if (serverInfo.address === '' || serverInfo.address === '::') {
      hostForUrl = 'localhost'
    }

    serverInfo.url = require('url').format({
      protocol: 'http',
      hostname: hostForUrl,
      port: serverInfo.port,
      pathname: path,
    })

    serverInfo.subscriptionsUrl = require('url').format({
      protocol: 'ws',
      hostname: hostForUrl,
      port: serverInfo.port,
      slashes: true,
      pathname: subscriptionsPath,
    })

    return serverInfo
  }
}

module.exports = {
  ...Apollo,
  ...scalars,
  MinervaServer,
  Sequelize,
}
