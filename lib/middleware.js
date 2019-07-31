const accepts = require('accepts')
const bodyParser = require('body-parser')
const cors = require('cors')
const typeIs = require('type-is')
const {
  renderPlaygroundPage,
} = require('@apollographql/graphql-playground-html')
const {
  convertNodeHttpToRequest,
  formatApolloErrors,
  processFileUploads,
  runHttpQuery,
} = require('apollo-server-core')

function graphQLMiddleware (server) {
  return (req, res, next) => {
    if (server.playgroundOptions && req.method === 'GET') {
      const accept = accepts(req)
      const types = accept.types()
      const prefersHTML =
        types.find(
          (x) => x === 'text/html' || x === 'application/json',
        ) === 'text/html'

      if (prefersHTML) {
        const playgroundRenderPageOptions = {
          endpoint: req.originalUrl,
          subscriptionEndpoint: server.subscriptionsPath,
          ...server.playgroundOptions,
        }
        res.setHeader('Content-Type', 'text/html')
        const playground = renderPlaygroundPage(
          playgroundRenderPageOptions,
        )
        res.write(playground)
        res.end()
        return
      }
    }

    return graphqlExpress(() => server.graphQLServerOptions({ req, res }))(
      req,
      res,
      next,
    )
  }
}

function graphqlExpress (options) {
  return (req, res, next) => {
    runHttpQuery([req, res], {
      method: req.method,
      options: options,
      query: req.method === 'POST' ? req.body : req.query,
      request: convertNodeHttpToRequest(req),
    }).then(
      ({ graphqlResponse, responseInit }) => {
        if (responseInit.headers) {
          for (const [name, value] of Object.entries(responseInit.headers)) {
            res.setHeader(name, value)
          }
        }
        res.write(graphqlResponse)
        res.end()
      },
      (error) => {
        if (error.name !== 'HttpQueryError') {
          return next(error)
        }

        if (error.headers) {
          for (const [name, value] of Object.entries(error.headers)) {
            res.setHeader(name, value)
          }
        }

        res.statusCode = error.statusCode
        res.write(error.message)
        res.end()
      },
    )
  }
}

function healthCheckMiddleware (onHealthCheck) {
  return (req, res) => {
    // Response follows https://tools.ietf.org/html/draft-inadarei-api-health-check-01
    res.type('application/health+json')

    if (onHealthCheck) {
      onHealthCheck(req)
        .then(() => res.json({ status: 'pass' }))
        .catch(() => res.status(503).json({ status: 'fail' }))
    } else {
      res.json({ status: 'pass' })
    }
  }
}

function fileUploadMiddleware (uploadsConfig, server) {
  return (req, res, next) => {
    // Note: we use typeis directly instead of via req.is for connect support.
    if (
      typeof processFileUploads === 'function' &&
      typeIs(req, ['multipart/form-data'])
    ) {
      processFileUploads(req, res, uploadsConfig)
        .then(body => {
          req.body = body
          next()
        })
        .catch(error => {
          if (error.status && error.expose) res.status(error.status)

          next(
            formatApolloErrors([error], {
              formatter: server.requestOptions.formatError,
              debug: server.requestOptions.debug,
            }),
          )
        })
    } else {
      next()
    }
  }
}

module.exports = {
  bodyParserMiddleware: bodyParser.json,
  corsMiddleware: cors,
  fileUploadMiddleware,
  healthCheckMiddleware,
  graphQLMiddleware,
}
