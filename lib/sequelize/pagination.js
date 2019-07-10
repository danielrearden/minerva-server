const Sequelize = require('sequelize')

const { Op, literal } = Sequelize

async function paginate (Model, method, options = {}) {
  const primaryKeyField = Model.primaryKeyAttribute
  if (!primaryKeyField) {
    throw new Error('Cannot paginate a model that does not have a primary key field')
  }

  const {
    desc = false, first, last, before, after, where, includeTotal, paginateBy = primaryKeyField, ...otherFindOptions
  } = options
  const paginateByIsNonPK = paginateBy !== primaryKeyField

  if (first && last) {
    throw new Error('Cannot provide both first and last parameters')
  }

  let afterQuery; let
    beforeQuery

  if (after) {
    afterQuery = getPaginationQuery(Model, after, desc ? Op.lt : Op.gt, paginateBy, primaryKeyField)
  }
  if (before) {
    beforeQuery = getPaginationQuery(Model, before, desc ? Op.gt : Op.lt, paginateBy, primaryKeyField)
  }

  const whereQuery = { [Op.and]: [beforeQuery, afterQuery, where] }

  const orderIsDesc = desc ? !last : !!last
  const order = [[paginateBy, orderIsDesc ? 'DESC' : 'ASC']]
  if (paginateByIsNonPK && primaryKeyField) {
    order.push([primaryKeyField, orderIsDesc ? 'DESC' : 'ASC'])
  }

  const limit = ((first || last) + 1) || undefined

  const results = await method({
    ...otherFindOptions,
    limit,
    order,
    where: whereQuery,
  })
  const hasMore = !!limit && results.length >= limit

  if (hasMore) {
    results.pop()
  }

  if (last) {
    results.reverse()
  }

  let totalCount = 0
  if (includeTotal) {
    const allRows = await method({ where })
    totalCount = allRows.length
  }

  return pageObjectFromResults(results, hasMore, totalCount, first, last, before, after)
}

function getPaginationQuery (
  Model,
  primaryKeyFieldValue,
  cursorOrderOperator,
  paginateBy,
  primaryKeyField
) {
  const { tableName, rawAttributes } = Model
  const paginateByFieldRaw = rawAttributes[paginateBy].field
  const primaryKeyFieldRaw = rawAttributes[primaryKeyField].field
  const primaryKeyFieldRawValue = getEscapedPrimaryKeyFieldValue(Model, primaryKeyField, primaryKeyFieldValue)

  const subquery = literal(`(
    SELECT ${paginateByFieldRaw} FROM ${tableName}
    WHERE ${primaryKeyFieldRaw} = ${primaryKeyFieldRawValue}
    LIMIT 1
  )`)
  if (primaryKeyField !== paginateBy) {
    return {
      [Op.or]: [
        {
          [paginateBy]: {
            [cursorOrderOperator]: subquery,
          },
        },
        {
          [paginateBy]: {
            [Op.eq]: subquery,
          },
          [primaryKeyField]: {
            [cursorOrderOperator]: literal(primaryKeyFieldRawValue),
          },
        },
      ],
    }
  }
  return {
    [primaryKeyField]: {
      [cursorOrderOperator]: literal(primaryKeyFieldRawValue),
    },
  }
}

/**
 * Transforms query results into a connection object
 */
function pageObjectFromResults (results, hasMore, totalCount, first, last, before, after) {
  return {
    results,
    pageInfo: {
      hasNextPage: hasNextPage(first, last, before, hasMore),
      hasPreviousPage: hasPreviousPage(first, last, after, hasMore),
      totalCount,
      pageCount: results.length,
      numberPages: Math.max(1, Math.ceil(totalCount / (first || last || totalCount))),
    },
  }
}

function hasNextPage (first, last, before, hasMore) {
  let hasNext = false

  if (before) {
    hasNext = true
  } else if (last) {
    hasNext = false
  } else if (first) {
    hasNext = hasMore
  }

  return hasNext
}

function hasPreviousPage (first, last, after, hasMore) {
  let hasPrevious = false

  if (after) {
    hasPrevious = true
  } else if (first) {
    hasPrevious = false
  } else if (last) {
    hasPrevious = hasMore
  }

  return hasPrevious
}

function getEscapedPrimaryKeyFieldValue (Model, primaryKeyField, primaryKeyFieldValue) {
  const attribute = Model.rawAttributes[primaryKeyField]
  return attribute.type instanceof Sequelize.NUMBER ? primaryKeyFieldValue : `'${primaryKeyFieldValue}'`
}

module.exports = {
  paginate,
  pageObjectFromResults,
}
