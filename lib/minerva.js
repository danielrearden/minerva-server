const parseurl = require('parseurl')
const { compose } = require('compose-middleware')
const { execute, subscribe } = require('graphql')

const Apollo = require('apollo-server-core')
const GraphQLTools = require('graphql-tools')
const GraphQLSubscriptions = require('graphql-subscriptions')
const {
  ApolloServerBase,
  formatApolloErrors,
  processFileUploads,
} = Apollo

const Sequelize = require('./sequelize')
const { generateSchema } = require('./graphql/schema')
const scalars = require('./graphql/scalars')
const {
  bodyParserMiddleware,
  corsMiddleware,
  fileUploadMiddleware,
  healthCheckMiddleware,
  graphQLMiddleware,
} = require('./middleware')

class MinervaServer extends ApolloServerBase {
  constructor (options = {}) {
    const sequelize = initializeSequelize(options.database)
    const context = createContext(sequelize, options.graphql)
    const schema = generateSchema(sequelize, options.graphql)
    const { path } = (options.server || {})
    const { typeDefs, resolvers, schemaDirectives, modules, subscriptions = {}, ...otherOptions } = (options.graphql || {})

    if (subscriptions !== false) {
      subscriptions.path = subscriptions.path || path
    }

    const config = { ...otherOptions, subscriptions, schema, context }
    super(config)

    this.sequelize = sequelize
    this.models = sequelize.models
    this.httpServer = undefined
    this.options = options
  }

  supportsSubscriptions () {
    return true
  }

  supportsUploads () {
    return true
  }

  getMiddleware (options = {}) {
    const {
      path = '/graphql',
      cors,
      bodyParserConfig,
      disableHealthCheck,
      onHealthCheck,
    } = { ...this.options.server, ...options }
    const middleware = []

    this.graphqlPath = path

    middleware.push(middlewareFromPath(path, (_req, _res, next) => {
      this.willStart().then(() => next()).catch(next)
    }))

    if (!disableHealthCheck) {
      middleware.push(
        middlewareFromPath('/.well-known/apollo/server-health', healthCheckMiddleware(onHealthCheck)),
      )
    }

    if (cors === true) {
      middleware.push(middlewareFromPath(path, corsMiddleware()))
    } else if (cors !== false) {
      middleware.push(middlewareFromPath(path, corsMiddleware(cors)))
    }

    if (bodyParserConfig === true) {
      middleware.push(middlewareFromPath(path, bodyParserMiddleware()))
    } else if (bodyParserConfig !== false) {
      middleware.push(middlewareFromPath(path, bodyParserMiddleware(bodyParserConfig)))
    }

    if (this.uploadsConfig && typeof processFileUploads === 'function') {
      middleware.push(middlewareFromPath(path, fileUploadMiddleware(this.uploadsConfig, this)))
    }

    middleware.push(
      middlewareFromPath(path, graphQLMiddleware(this)),
    )

    return compose(middleware)
  }

  installSubscriptionHandlers (server) {
    if (!this.subscriptionServerOptions) {
      throw Error(
        'Subscriptions are disabled, due to subscriptions set to false in the MinervaServer constructor',
      )
    }

    const { SubscriptionServer } = require('subscriptions-transport-ws')
    const {
      onDisconnect,
      onConnect = (connectionParams) => ({ ...connectionParams }),
      keepAlive,
      path,
    } = this.subscriptionServerOptions

    const onOperation = async (message, connection) => {
      connection.formatResponse = (value) => ({
        ...value,
        errors:
          value.errors &&
          formatApolloErrors([...value.errors], {
            formatter: this.requestOptions.formatError,
            debug: this.requestOptions.debug,
          }),
      })
      let context = this.context ? this.context : { connection }

      try {
        context =
          typeof this.context === 'function'
            ? await this.context({ connection, payload: message.payload })
            : context
      } catch (e) {
        throw formatApolloErrors([e], {
          formatter: this.requestOptions.formatError,
          debug: this.requestOptions.debug,
        })[0]
      }

      return { ...connection, context: { ...connection.context, ...context } }
    }
    const serverOptions = {
      schema: this.schema,
      execute,
      subscribe,
      onConnect,
      onDisconnect,
      onOperation,
      keepAlive,
    }
    const socketOptions = { server, path }

    this.subscriptionServer = SubscriptionServer.create(serverOptions, socketOptions)
  }

  async start () {
    const express = require('express')
    const http = require('http')
    const { sequelize, options: { server = {} } } = this
    const { cors, disableHealthCheck, host, path = '/graphql', port = 4000, onHealthCheck } = server

    await sequelize.authenticate()

    this.app = express()
    this.app.use(this.getMiddleware({ path, cors, disableHealthCheck, onHealthCheck }))
    this.httpServer = http.createServer(this.app)

    if (this.subscriptionServerOptions) {
      this.installSubscriptionHandlers(this.httpServer)
    }

    await new Promise((resolve) => {
      this.httpServer.once('listening', resolve)
      this.httpServer.listen(port, host)
    })
  }

  async stop () {
    if (this.httpServer) {
      const httpServer = this.httpServer
      await new Promise(resolve => httpServer.close(resolve))
      this.httpServer = undefined
      this.app = undefined
    }
    await super.stop()
  }
}

function createContext ({ models }, { context = {}, formatClientError }) {
  return async (params) => {
    let baseContext = context
    if (typeof context === 'function') {
      baseContext = await context(params)
    }
    return {
      ...baseContext,
      formatClientError,
      models,
    }
  }
}

function initializeSequelize (options) {
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

function middlewareFromPath (path, middleware) {
  return (req, res, next) => {
    const parsedUrl = parseurl(req)
    if (parsedUrl && parsedUrl.pathname === path) {
      return middleware(req, res, next)
    } else {
      return next()
    }
  }
}

module.exports = {
  ...Apollo,
  ...GraphQLTools,
  ...GraphQLSubscriptions,
  ...scalars,
  MinervaServer,
  Sequelize,
}
