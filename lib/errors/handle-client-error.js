const _ = require('lodash')
const { validator } = require('sequelize/lib/utils/validator-extras')

async function handleClientError (func, context) {
  const { formatClientError = (e) => e } = context
  let result, errors
  try {
    result = await func()
  } catch (error) {
    if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
      errors = handleValidationError(error)
    } else if (error.isClient) {
      errors = [error]
    } else {
      throw error
    }
  }

  if (errors) {
    errors = errors.map(({ code, message, field }) => formatClientError({ code, message, field }, context))
  }

  return [result, errors]
}

function handleValidationError (error) {
  return error.errors.map(validationErrorItem => {
    return {
      message: getValidationErrorMessage(validationErrorItem),
      field: getValidationErrorField(validationErrorItem),
      code: _.toUpper(_.snakeCase(validationErrorItem.validatorKey)),
    }
  })
}

function getValidationErrorMessage (validationErrorItem) {
  const { message, validatorKey, validatorArgs } = validationErrorItem
  if (validatorKey === 'not_null') {
    return 'Value cannot be null'
  } else if (validatorKey === 'not_unique') {
    return 'Value must be unique'
  } else if (validator[validatorKey]) {
    switch (validatorKey) {
      case 'isAfter': return 'Value is too early'
      case 'isAlpha': return 'Value must contain only letters'
      case 'isAlphanumeric': return 'Value must contain only letters and numbers'
      case 'isAscii': return 'Value must contain only ASCII characters'
      case 'isBefore': return 'Value is too late'
      case 'isBoolean': return 'Value is not a boolean'
      case 'isByteLength': return 'Value is too short'
      case 'isCreditCard': return 'Value is not a valid credit card number'
      case 'isCurrency': return 'Value is not a valid currency amount'
      case 'isDataURI': return 'Value is not a valid data URI'
      case 'isMagnetURI': return 'Value is not a valid magnet URI'
      case 'isDecimal': return 'Value is not a decimal value'
      case 'isDivisibleBy': return `Value is not divisible by ${validatorArgs[0]}`
      case 'isEmail': return 'Value is not a valid email'
      case 'isEmpty': return 'Value must be empty'
      case 'isFQDN': return 'Value is not a FQDN'
      case 'isFloat': return 'Value is not a float value'
      case 'isHash': return 'Value is not a hash'
      case 'isHexColor': return 'Value is not a hexadecimal color'
      case 'isHexadecimal': return 'Value is not a hexadecimal value'
      case 'isIP': return 'Value is not a valid IP address'
      case 'isIPRange': return 'Value is not a valid IP range'
      case 'isISBN': return 'Value is not a valid ISBN'
      case 'isISSN': return 'Value is not a valid ISSN'
      case 'isISIN': return 'Value is not a valid ISIN'
      case 'isISO8601': return 'Value is not a valid ISO 8601 date'
      case 'isRFC3339': return 'Value is not a valid RFC 3339 date'
      case 'isISO31661Alpha2': return 'Value is not a valid country code'
      case 'isISO31661Alpha3': return 'Value is not a valid country code'
      case 'isISRC': return 'Value is not a valid ISRC'
      case 'isInt': return 'Value is not an integer'
      case 'isJSON': return 'Value is not valid JSON'
      case 'isJWT': return 'Value is not a valid JWT'
      case 'isLatLong': return 'Value is not a valid coordinate'
      case 'isLength':
      case 'len':
        return 'Value is too short'
      case 'isLowercase': return 'Value is not lowercase'
      case 'isMACAddress': return 'Value is not a valid MAC address'
      case 'isMD5': return 'Value is not a valid MD5 hash'
      case 'isMobilePhone': return 'Value is not a valid phone number'
      case 'isMongoId': return 'Value is not a valud ObjectId'
      case 'isNumeric': return 'Value is must only contain numbers'
      case 'isPort': return 'Value is not a valid port'
      case 'isPostalCode': return 'Value is not a valid postal code'
      case 'isURL': return 'Value is not a valid URL'
      case 'isUUID': return 'Value is not a valid UUID'
      case 'isUppercase': return 'Value is not uppercase'
      case 'notEmpty': return 'Value cannot be empty'
      case 'notNull': return 'Value cannot be null'
      case 'isNull': return 'Value must be null'
      case 'isDate': return 'Value is not a valid date'
      case 'max': return `Value cannot be greater than ${validatorArgs[0]}`
      case 'min': return `Value cannot be less than ${validatorArgs[0]}`
      default: return 'Value is invalid'
    }
  }
  return message
}

function getValidationErrorField (validationErrorItem) {
  const { instance, path } = validationErrorItem
  const attributeName = Object.keys(instance.rawAttributes).find(attributeName => instance.rawAttributes[attributeName].field === path)
  if (attributeName) {
    return attributeName
  }
}

module.exports = {
  handleClientError,
}
