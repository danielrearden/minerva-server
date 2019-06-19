const { handleClientError } = require('../handle-client-error')

describe('handleClientError', () => {
  const instance = { rawAttributes: { foo: { field: 'foo' }, bar: { field: 'bar' } } }

  it('should return the result when an error is not thrown', async () => {
    const [result, errors] = await handleClientError(async () => 'FOO', {})
    expect(result).toBe('FOO')
    expect(errors).toBeUndefined()
  })

  it('should handle a SequelizeUniqueConstraintError', async () => {
    const error = new Error('Validation Error')
    error.name = 'SequelizeUniqueConstraintError'
    error.errors = [{ validatorKey: 'not_unique', path: 'foo', instance }]
    const [result, errors] = await handleClientError(async () => { throw error }, {})
    expect(result).toBeUndefined()
    expect(errors[0]).toMatchObject({
      message: 'Value must be unique',
      code: 'NOT_UNIQUE',
      field: 'foo',
    })
  })

  it('should handle a SequelizeValidationError', async () => {
    const error = newValidationError('not_null', 'bar')
    const [result, errors] = await handleClientError(async () => { throw error }, {})
    expect(result).toBeUndefined()
    expect(errors[0]).toMatchObject({
      message: 'Value cannot be null',
      code: 'NOT_NULL',
      field: 'bar',
    })
  })

  it('should provide appropriate messages for each kind of validator', async () => {
    const validators = [
      ['isAfter', 'Value is too early'],
      ['isAlpha', 'Value must contain only letters'],
      ['isAlphanumeric', 'Value must contain only letters and numbers'],
      ['isAscii', 'Value must contain only ASCII characters'],
      ['isBefore', 'Value is too late'],
      ['isBoolean', 'Value is not a boolean'],
      ['isByteLength', 'Value is too short'],
      ['isCreditCard', 'Value is not a valid credit card number'],
      ['isCurrency', 'Value is not a valid currency amount'],
      ['isDataURI', 'Value is not a valid data URI'],
      ['isMagnetURI', 'Value is not a valid magnet URI'],
      ['isDecimal', 'Value is not a decimal value'],
      ['isDivisibleBy', 'Value is not divisible by 10'],
      ['isEmail', 'Value is not a valid email'],
      ['isEmpty', 'Value must be empty'],
      ['isFQDN', 'Value is not a FQDN'],
      ['isFloat', 'Value is not a float value'],
      ['isHash', 'Value is not a hash'],
      ['isHexColor', 'Value is not a hexadecimal color'],
      ['isHexadecimal', 'Value is not a hexadecimal value'],
      ['isIP', 'Value is not a valid IP address'],
      ['isIPRange', 'Value is not a valid IP range'],
      ['isISBN', 'Value is not a valid ISBN'],
      ['isISSN', 'Value is not a valid ISSN'],
      ['isISIN', 'Value is not a valid ISIN'],
      ['isISO8601', 'Value is not a valid ISO 8601 date'],
      ['isRFC3339', 'Value is not a valid RFC 3339 date'],
      ['isISO31661Alpha2', 'Value is not a valid country code'],
      ['isISO31661Alpha3', 'Value is not a valid country code'],
      ['isISRC', 'Value is not a valid ISRC'],
      ['isInt', 'Value is not an integer'],
      ['isJSON', 'Value is not valid JSON'],
      ['isJWT', 'Value is not a valid JWT'],
      ['isLatLong', 'Value is not a valid coordinate'],
      ['isLength', 'Value is too short'],
      ['len', 'Value is too short'],
      ['isLowercase', 'Value is not lowercase'],
      ['isMACAddress', 'Value is not a valid MAC address'],
      ['isMD5', 'Value is not a valid MD5 hash'],
      ['isMobilePhone', 'Value is not a valid phone number'],
      ['isMongoId', 'Value is not a valud ObjectId'],
      ['isNumeric', 'Value is must only contain numbers'],
      ['isPort', 'Value is not a valid port'],
      ['isPostalCode', 'Value is not a valid postal code'],
      ['isURL', 'Value is not a valid URL'],
      ['isUUID', 'Value is not a valid UUID'],
      ['isUppercase', 'Value is not uppercase'],
      ['notEmpty', 'Value cannot be empty'],
      ['notNull', 'Value cannot be null'],
      ['isNull', 'Value must be null'],
      ['isDate', 'Value is not a valid date'],
      ['notContains', 'Value is invalid'],
      ['max', 'Value cannot be greater than 10'],
      ['min', 'Value cannot be less than 10'],
    ]
    for (const validator of validators) {
      const [key, message] = validator
      const error = newValidationError(key)
      const [, errors] = await handleClientError(async () => { throw error }, {})
      expect(errors[0].message).toBe(message)
    }
  })

  it('should handle multiple validation error items', async () => {
    const error = new Error('Validation Error')
    error.name = 'SequelizeValidationError'
    error.errors = [
      { validatorKey: 'isEmail', path: 'foo', instance },
      { validatorKey: 'isNull', path: 'bar', instance },
    ]
    const [, errors] = await handleClientError(async () => { throw error }, {})
    expect(errors.length).toBe(2)
    expect(errors[0]).toMatchObject({
      message: 'Value is not a valid email',
      code: 'IS_EMAIL',
      field: 'foo',
    })
    expect(errors[1]).toMatchObject({
      message: 'Value must be null',
      code: 'IS_NULL',
      field: 'bar',
    })
  })

  it('should handle model-level validators', async () => {
    const error = new Error('Validation Error')
    error.name = 'SequelizeValidationError'
    error.errors = [{ message: 'My custom message', validatorKey: 'myCustomValidator', path: 'myCustomValidator', instance }]
    const [result, errors] = await handleClientError(async () => { throw error }, {})
    expect(result).toBeUndefined()
    expect(errors[0]).toMatchObject({
      message: 'My custom message',
      code: 'MY_CUSTOM_VALIDATOR',
      field: undefined,
    })
  })

  it('should handle custom client errors', async () => {
    const error = new Error('Some custom message')
    error.isClient = true
    error.code = 'FOO_BAR'
    error.field = 'foobar'
    const [result, errors] = await handleClientError(async () => {
      throw error
    }, {})
    expect(result).toBeUndefined()
    expect(errors[0]).toMatchObject({ code: error.code, field: error.field, message: error.message })
  })

  it('should throw all other errors', async () => {
    const error = new Error('Some custom message')
    error.code = 'FOO_BAR'
    error.field = 'foobar'
    await expect(handleClientError(async () => { throw error }, {})).rejects.toEqual(error)
  })

  function newValidationError (validatorKey, path = 'foo') {
    const error = new Error('Validation Error')
    error.name = 'SequelizeValidationError'
    error.errors = [{ validatorKey, validatorArgs: [10], path, instance }]
    return error
  }
})
