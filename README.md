<p align="center">
  <img src='https://user-images.githubusercontent.com/18018864/59799926-67d00c80-92b3-11e9-95c3-4bbe53333362.png' height='300' alt='Minerva Server'>
</p>

# Minerva Server
*Making GraphQL a hoot!*

[![CircleCI](https://circleci.com/gh/danielrearden/minerva-server.svg?style=svg)](https://circleci.com/gh/danielrearden/minerva-server)
[![codecov](https://codecov.io/gh/danielrearden/minerva-server/branch/master/graph/badge.svg)](https://codecov.io/gh/danielrearden/minerva-server)

<details><summary>Table of Contents</summary>

- [Features](#features)
- [Getting started](#getting-started)
- [Base schema generation](#base-schema-generation)
- [Pagination](#pagination)
- [Aggregation](#aggregation)
- [Extending the schema](#extending-the-schema)
  * [Extending types](#extending-types)
- [Validation and error handling](#validation-and-error-handling)
  * [Customizing client errors](#customizing-client-errors)
  * [Extending the schema with client errors](#extending-the-schema-with-client-errors)
  * [Custom client errors](#custom-client-errors)
- [Unions and Interfaces](#unions-and-interfaces)
- [Directives](#directives)
- [Configuration](#configuration)
</details>

> ⚠️ This project 

**Minerva Server** is a Node.js framework for generating efficient SQL queries from GraphQL requests. With Minerva, you can write a data model like this:

```js
const Employee = sequelize.define('Employee', {
  firstName: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  lastName: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  salary: {
    type: Sequelize.DECIMAL,
    allowNull: false,
  },
  completedTraining: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
  },
  orientationDate: {
    type: Sequelize.DATE,
  }
}, {
  crud: ['read'],
})
Employee.hasMany(Absence, { foreignKey: 'employeeId' })
```

and then automatically generate a schema that will let you write complex, efficient queries like this:

```gql
query {
  employees(
    first: 5
    sort: {
      field: createdAt
      dir: DESC
    }
    filter: {
      or: {
        completedTraining_eq: true
        orientationDate_gte: "2017-12-03T10:15:30Z"
      }
    }
  ) {
    results {
      id
      lastName
      absences(
        sort: { field: startDate }
        filter: { numberDays_gt: 2 }
      ) {
        id
        startDate
        endDate
      }
    }
    pageInfo {
      hasNextPage
      pageCount
    }
    aggregate {
      avg {
        salary
      }
    }
  }
}
```

## Features

Minerva is built on top of two amazing libraries -- [Apollo Server](https://github.com/apollographql/apollo-server) and [Sequelize](https://github.com/sequelize/sequelize) -- and includes a number of cool features:

* Query across nested associations while minimizing the number of requests made to your database
* Generate GraphQL types for your Sequelize models, while controlling which types and individuals fields are exposed in your schema
* Easily implement sorting, filtering and pagination with generated input types and helper directives
* Get aggregated information like sums and averages about individual model fields for queried pages
* Leverage data model validation and sensible error handling for mutations
* Optionally generate Query and Mutation fields for querying, creating, updating and deleting instances of your models
* Easily extend the generated schema with your own types, fields and directives

Because Minerva is built on top of Apollo, you can also leverage all the features of Apollo Server like:

* File uploads
* Subscriptions
* Custom directives
* GraphQL Playground
* Schema mocking
* and more

Minerva also supports [graphql-middleware](https://github.com/prisma/graphql-middleware) so you can easily plug in [graphql-shield](https://github.com/maticzav/graphql-shield) or the middleware of your choice.

## Getting started
Install the module: 
```sh
$ npm i minerva-server graphql
```

and the driver for the dialect of your choice:

```sh
$ npm i pg pg-hstore
$ npm i mysql2
$ npm i mariadb
$ npm i sqlite3
$ npm i tedious
```

> **WARNING**: Do not install `sequelize`. Minerva uses a patched version of the library that should be used instead.

Configure a new instance of `MinervaServer`:

```js
const { MinervaServer } = require('minerva-server')

const server = new MinervaServer({
  database: {
    url: 'postgres://postgres@localhost:5432/postgres',
    models,
  },
})
```

Start the server:

```js
server.start()

// or apply the middleware to an existing express app
server.applyMiddleware({ app })
```

## Base schema generation
Minerva turns your Sequelize models into GraphQL types. Each model generates several types by default:

  - `[ModelName]` - An object type representing a model instance
  - `[ModelName]Page` - An object type used for pagination
  - `[ModelName]Filter` - An input object type for providing filter options
  - `[ModelName]Sort` - An input object type for providing sort options

Individual models or model attributes may be omitted from the schema by setting the `public` option to `false`. In addition, you can pass specify a `crud` array in the model options to generate queries and mutations for the model. For example, we can set the `crud` option on the `Employee` model above to `['read', 'update', 'create', 'delete']` to generate the following fields:

```graphql
type Query {
  employee(id: Int!): User
  employees(
    first: Int
    last: Int
    after: ID
    before: ID
    sort: EmployeeSort
    filter: EmployeeFilter
  ): EmployeePage!
}

type Mutation {
  createEmployee(input: EmployeeInput!): CreateEmployeePayload!
  updateEmployee(id: Int!, input: UserInput!): UpdateEmployeePayload!
  deleteEmployee(id: Int!): DeleteEmployeePayload!
}
```

## Pagination
Fields that return a Page type (for example `EmployeePage`) allow us to query a slice of the available data:

```graphql
query {
  employees {
    results {
      id
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      pageCount
      totalCount
    }
  }
}
```

A limit can be provided using either the `first` or `last` arguments, while `before` or `after` are used to indicate where the page should begin. Instead of cursors, `before` or `after` simply accept the `id` (or whatever the models' primary key field is called) of one of the results. Sort and filter options may also be used to narrow down the results.

## Aggregation
In addition to a `PageInfo` object, every Page type also includes an `aggregate` field. This field can be used to easily run aggregate functions against the returned Page:

```graphql
query {
  employees {
    aggregate {
      min {
        salary
        orientationDate
      }
      max {
        salary
        orientationDate
      }
      avg {
        salary
      }
      median {
        salary
      }
      sum {
        salary
      }
    }
  }
}
```

## Extending the schema

Additional type definitions, resolvers and schema directives may be passed in to the `MinervaServer` constructor to extend the generated schema. **Note**: type definitions are *merged* with the base schema, so it's generally not necessary to utilize the `extend` keyword. This handling of type definitions is slightly different from Apollo Server, where defining multiple types with the same name will throw an error. You can define a type as many times as you need -- its multiple definitions will be merged into one before the GraphQL service is created.

For example, instead of generating the `employees` Query field above, we could write it ourselves:

```js
const typeDefs = `
  type Query {
    employees: EmployeePage! @paginate
  }
`
```

We can use the `@paginate` directive to automatically inject pagination arguments (`first`, `last`, `before` and `after`). By default, `@paginate` will also include the `sort` and `filter` arguments, though this can be turned off (i.e. `@paginate(sort: false)`). The `@sort` and `@filter` directives can likewise we used on any field to inject the respective arguments.

Next, we add a resolver for our field:

```js
const resolvers = {
  Query: {
    employees: (root, args, ctx, info) => {
      return context.models.Employee.paginate({ info })
    },
  },
}

const server = new MinervaServer({
  graphql: { typeDefs, resolvers },
  ...
})
```

Our models are injected into the context for us, so they are available inside every resolver without being directly imported. We call the `paginate` method of our model and pass it the `info` parameter from our resolver -- and that's it! Minerva parses any pagination, sort or filter arguments, as well as the requested fields and queries our database appropriately.

Note: `paginate` method is a new method added to all Sequelize models by Minerva. It accepts most of the same options other Sequelize ["find" methods](http://docs.sequelizejs.com/class/lib/model.js~Model.html#static-method-findAll) do (i.e. `where`, `paranoid`, `transaction`, etc.) in addition to the options described below. However, all "find" options (`findAll`, `findByPk`, `findOne`) also accept the `info` parameter as an option. So we can also do this:

```js
const typeDefs = `
  type Query {
    employee: Employee @filter
  }
`
const resolvers = {
  Query: {
    employees: (root, args, ctx, info) => {
      return context.models.Employee.findOne({ info })
    },
  },
}
```

Again, additional options like `where` can be passed in to the Model's method narrow the scope down of your resolver in addition to the options generated from the `info` parameter.

For additional information on building schemas, please refer to the Apollo [documentation](https://www.apollographql.com/docs/graphql-tools/generate-schema).

### Extending types

Generated types can be modified by providing the appropriate type definitions and resolvers. For example, if we wanted to add a `fullName` field to our `Employee` type, we could write:

```js
const typeDefs = `
  # Note: no need to use the "extend" keyword!
  type Employee {
    fullName: String!
  }
`
const resolvers = {
  Employee: {
    fullName: (employee) => {
      // The first parameter here will be an instance of our model
      return employee.firstName + ' ' + employee.lastName
    },
  },
}
```

## Validation and error handling
API servers typically deal with two distinct types of errors -- server errors, which represent some unexpected failure, and client errors, which occur "normally" due to, for example, bad input from the client. While server errors should be obfuscated, client errors need to be returned to the client with additional details, for example like the model fields that failed validation.

Sequelize allows you to provide [validate functions](http://docs.sequelizejs.com/manual/models-definition.html#validations) for models and invidual model fields. When updating or creating instances, Sequelize will throw validation erros based on these validate functions. Similarly, validation errors are also thrown when encountering certain database errors, like constraint errors. Minerva turns these errors into `ClientError`s that include an appropriate `message`, a `code` (based on the validator) and the affected `field`.

Moreover, unlike regular execution errors, these client errors are returned **as part of the data in the server's response**.

For example, a typical (generated) update mutation looks like this:

```gql
mutation {
  updateEmployee(id: 10, input: { salary: 50000 }) {
    employee {
      id
      salary
    }
    errors {
      message
      code
      field
    }
  }
}
```

This approach has the distinct advantage of allowing us to return *multiple* client errors, which is not normally possible if simply throwing an error inside a resolver.

### Customizing client errors
A `formatClientError` function may be passed to the `MinervaServer` constructor along with other `graphql` options. This function takes the client error and context as parameters and should return the formatted client error:

```js
const formatClientError = ({ message, code, field }, context) => {
  return {
    message: 'A different message',
    code,
    field,
  }
}
const server = new MinervaServer({ graphql: { formatClientError}, ... })
```

### Extending the schema with client errors
You might write your own `update` mutation like this:

```js
const typeDefs = `
  type Mutation {
    giveRaise(id: Int!, amount: Int!): Employee @withErrors(field: "employee")
  }
`
const resolvers = {
  Mutation: {
    giveRaise: async (root, args, ctx, info) => {
      const { id, amount } = args
      const employee = await ctx.models.Employee.findByPk(id, { info })
      await employee.update({ salary: employee.salary + amount }, { returning: true })
      return employee
    }
  }
}
```

Our resolver just fetches an Employee instance, updates it and returns it. The `@withErrors` directive, however, does two things: One, it converts our field's type into a payload type. This new type will have two fields -- an `errors` field with our client errors and an `employee` field with our returned Employee. The other field is named `employee` because that's what we told the directive to name it. The resulting type looks like this:

```gql
type GiveRaisePayload {
  employee: Employee
  errors: [ClientError!]!
}
```

However, the `@withErrors` directive *also* ensures that any validation errors are also caught and returned appropriately. Without the directive, these errors would instead show up in the `errors` part of the GraphQL response like normal.

The directive may be used to inject the `errors` field into an existing type, by not passing in the `field` argument:

```gql
type Mutation {
  giveRaise: CustomPayload! @withErrors
}

type CustomPayload {
  employee: Employee
  throwParty: Boolean
}
```

### Custom client errors
Errors that are not considered client errors are still treated normally, and won't be returned inside the response's `data`. Any error may be treated as a client error, however, by simply setting the `isClient` property on it to `true`. This allows you to throw custom client errors in addition to Sequelize validation errors.

```js
const resolvers = {
  Mutation: {
    giveRaise: async (root, args, ctx, info) => {
      if (args.amount > 10000) {
        const error = new Error('That is too much!')
        error.isClient = true
        error.code = 'EXCESSIVE_AMOUNT'
        error.field = 'amount'
        throw error
      } 
      // ...
    }
  }
}
```

## Unions and Interfaces
Minerva supports creating Unions and Interfaces through [single table inheritance](https://en.wikipedia.org/wiki/Single_Table_Inheritance). Minerva generates both the abstract type and all its possible types from a single Sequelize model. To utilize this feature, follow these steps:

1. Ensure that your table has a `type` column that specifies which possible type a particular row has (the exact field name used can be specified by providing the `typeField` option to your model, but it defaults to `"type"`).
2. Create a single model to represent the above table. Name the model whatever name your Interface or Union will be.
3. Pass a `possibleTypes` option to your Model that lists all its possible types. For example, an `Animal` interface might have a `possibleTypes` value like `["Cat", "Dog", "Bird"]`.
4. For each field on the model, add an `actualTypes` field. This options specifies which of the possible types will actually have the field. If the `actualTypes` field is omitted, the field will become part of the Interface's fields and all types will have it. You can similarly specify `actualTypes` on any associations to limit the association to one or more actual types.

For example, we can create a model like this:

```js
const Persons = sequelize.define('Person', {
  id: {
    type: Sequelize.UUID,
    allowNull: false
  },
  type: {
    type: Sequelize.STRING,
    allowNull: false
  },
  name: {
    type: Sequelize.STRING,
    allowNull: false
  },
  salary: {
    type: Sequelize.DECIMAL,
    actualTypes: ['Employee'],
  },
  rate: {
    type: Sequelize.DECIMAL,
    actualTypes: ['Contractor'],
  },
}, {
  possibleTypes: ['Employee', 'Contractor'],
})
```

which will generate the following type definitions:

```gql
interface Person {
  id: UUID!
  type: String!
  name: String!
}

type Employee implements Person {
  id: UUID!
  type: String!
  name: String!
  salary: Float
}

type Contractor implements Person {
  id: UUID!
  type: String!
  name: String!
  rate: Float
}
```

## Directives
These are the schema directives included with Minerva. You don't *have* to use these directives, but they can be helpful when extending the base schema.
<details>
<summary>Click to view</summary>

### @page
Decorates the field definition with pagination arguments: `first`, `last`, `before` and `after`. Will also add `sort` and `filter` arguments unless the relevant input types do not exist. 

Argument | Default Value | Description
--- | --- | ---
`type` | Derived from field type | The name of the node type for the connection
`filter` | `true` | Whether to include the `filter` argument
`sort` | `true` | Whether to include the `sort` argument

### @filter
Decorates the field definition with `filter` argument unless the relevant input type does not exist. 

Argument | Default Value | Description
--- | --- | ---
`type` | Derived from field type | The name of the type to get filter options for

### @sort
Decorates the field definition with `sort` argument unless the relevant input type does not exist. 

Argument | Default Value | Description
--- | --- | ---
`type` | Derived from field type | The name of the type to get sort options for

### @withErrors
Transforms the field return type to include an `errors` field. If the existing return type is not an object type, the directive will create one with the specified field name.

Argument | Default Value | Description
--- | --- | ---
`field` | `undefined` | The name of the created field

</details>

## Configuration
`MinervaServer`'s constructor takes the configuration options outlined below.

<details>
<summary>Click to view</summary>

Option | Default value | Description
--- | --- | ---
`database` |   | Options for configuring the Sequelize instance.
`database.url` | `undefined` | Connection url for database. Can be provided in lieu of providing a dialect and the individual connection options below.
`database.username` | `undefined` | Username to authenticate against database.
`database.password` | `undefined` | Password to authenticate against database.
`database.host` | `undefined` | Host of the database.
`database.port` | `undefined` | Port of the database.
`database.database` | `undefined` | Database name.
`database.dialect` | `undefined` | Dialect of database.
`database.models` | `[]` | An array of functions that return Sequelize models. Each function is passed two parameters -- the Sequelize instance, and a Sequelize object.
`database.crud` | `[]` | Default CRUD configuration for models. See Model options below.
`database[]` |  | All other options are passed to the Sequelize constructor. See [usage](http://docs.sequelizejs.com/class/lib/sequelize.js~Sequelize.html#instance-constructor-constructor).
`graphql` |   | Options for configuring the GraphQL service.
`graphql.typeDefs` | `[]` | A `String` or `DocumentNode` representing any additional type definitions.
`graphql.resolvers` | `{}` | Resolvers for any additional type definitions. See [usage](https://www.apollographql.com/docs/graphql-tools/generate-schema/).
`graphql.formatClientError` | `(error, context)  => error` | Function for formatting any client errors returned by the service.
 `graphql[]` |  | All other options passed to `ApolloServer` constructor. See [usage](https://www.apollographql.com/docs/apollo-server/api/apollo-server/).
`server` | | Options for configuring the API endpoint.
`server.path` | `/graphql` | Path for API endpoint.
`server.port` | `4000` | Port for API endpoint.
`server.host` | `undefined` | Hostname passed to [`server.listen`](https://nodejs.org/api/net.html#net_server_listen_options_callback).
`server.cors` | `false` | CORS options (see [usage](https://github.com/expressjs/cors#cors)). Set to `false` to turn off middleware, or `true` to use defaults.
`server.disableHealthCheck` | `false` | Disable the health check endpoint (see [usage](https://www.apollographql.com/docs/apollo-server/features/health-checks/)).
`server.onHealthCheck` | `undefined` | Callback for health check (see [usage](https://www.apollographql.com/docs/apollo-server/features/health-checks/)).

</details>

Note: Instead of a connection url or a configuration object, the `database` option may also be an instance of Sequelize:

```js
const { MinervaServer, Sequelize } = require('minerva-server')
const database = new Sequelize({...})
const server = new MinervaServer({ database, ... })
```

Sequelize modules can imported directly like so:

```js
const { Op, literal, col } = require('minerva-server/sequelize')
```

### Model options
Models should be defined as outlined in the Sequelize [documentation](http://docs.sequelizejs.com/manual/models-definition.html). Individual models may also be passed these additional options:

<details>
<summary>Click to view</summary>

Option | Default value | Description
--- | --- | ---
`public` | `true` | Whether a GraphQL type should be generated for the model
`crud` | `[]` | Array of operations (`"read"`, `"create"`, `"update"` and `"delete"`) for which to generate queries and/or mutations.
`possibleTypes` | `undefined` | Array of implementing types. If provided, the model will be treated as an Interface and types will be generated based on the array.
`typenameField` | `"type"` | The field distinguishing between different types implementing the Interface.

</details>

The following additional options are available when defining a Model attribute:
 
<details>
<summary>Click to view</summary>

Option | Default value | Description
--- | --- | ---
`public` | `true` | Whether the attribute should be exposed as a GraphQL field
`create` | `true` | whether the attribute should be included as a field in the generated input used for instance creation
`update` | `true` | Whether the attribute should be included as a field in the generated input used for instance updates
`sort` | `false` | Whether the attribute should be included as a sort option
`filter` | `false` | Whether the attribute should be included as a sort option
`deprecationReason` | `undefined` | Providing a reason will mark the field as deprecated.
`actualTypes` | `undefined` | When defining an abstract type model, providing an `actualTypes` option to an attribute marks that attribute as belonging to one or more possible types instead of the abstract type itself.

</details>

The following additional options are available when defining a Model association:
 
<details>
<summary>Click to view</summary>

Option | Default value | Description
--- | --- | ---
`public` | `true` | Whether the association should be exposed as an GraphQL field
`actualTypes` | `undefined` | When defining an abstract type model, providing a `actualTypes` option to an association marks that association as belonging to one or more possible types instead of the abstract type itself.
`type` | `undefined` | When defining an abstract type model, providing a `type` option to an association will change the resulting association field's type from the abstract type to the type specified.

</details>