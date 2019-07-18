const { parseValue: parse } = require('graphql')
const {
  GraphQLDateRange,
  GraphQLDateTimeRange,
  GraphQLFloatRange,
  GraphQLIntRange,
} = require('../scalars')

describe('Range scalars', () => {
  describe('serialize', () => {
    it('should serialize the scalar', () => {
      const assertSerializesCorrectly = ({ serialize }, lowerValue, upperValue, serializedLower, serializedUpper) => {
        expect(serialize([
          { value: lowerValue, inclusive: true },
          { value: upperValue, inclusive: false },
        ])).toEqual([
          { value: serializedLower, inclusive: true },
          { value: serializedUpper, inclusive: false },
        ])
        expect(serialize([
          { value: lowerValue, inclusive: false },
          { value: upperValue, inclusive: true },
        ])).toEqual([
          { value: serializedLower, inclusive: false },
          { value: serializedUpper, inclusive: true },
        ])
        expect(serialize([
          { value: -Infinity, inclusive: true },
          { value: Infinity, inclusive: true },
        ])).toEqual([
          { value: null, inclusive: true },
          { value: null, inclusive: true },
        ])
        expect(serialize([
          { value: Infinity, inclusive: false },
          { value: -Infinity, inclusive: false },
        ])).toEqual([
          { value: null, inclusive: false },
          { value: null, inclusive: false },
        ])
      }
      const dateA = new Date()
      const dateB = new Date(Date.now() + 1000)
      const assertions = [
        [GraphQLDateRange, dateA, dateB, dateA.toISOString().substring(0, 10), dateB.toISOString().substring(0, 10)],
        [GraphQLDateTimeRange, dateA, dateB, dateA.toISOString(), dateB.toISOString()],
        [GraphQLFloatRange, 2.5, 7.5, 2.5, 7.5],
        [GraphQLIntRange, 7, 42, 7, 42],
      ]
      assertions.forEach(assertion => assertSerializesCorrectly(...assertion))
    })
    it('should throw an error', () => {
      const assertSerializeThrows = ({ serialize }, lowerValue, upperValue) => {
        const lower = { value: lowerValue, inclusive: true }
        const upper = { value: upperValue, inclusive: false }
        expect(() => serialize()).toThrow('should be an array of length 2')
        expect(() => serialize([])).toThrow('should be an array of length 2')
        expect(() => serialize([
          { value: lower.value, inclusive: 0 },
          upper,
        ])).toThrow('Lower bound inclusive field must be a boolean')
        expect(() => serialize([
          lower,
          { value: upper.value, inclusive: 0 },
        ])).toThrow('Upper bound inclusive field must be a boolean')
        expect(() => serialize([
          { inclusive: lower.inclusive },
          upper,
        ])).toThrow('Lower field must specify value field')
        expect(() => serialize([
          lower,
          { inclusive: upper.inclusive },
        ])).toThrow('Upper field must specify value field')
      }
      const date = new Date()
      const assertions = [
        [GraphQLDateRange, date, new Date(date.getTime() + 1000)],
        [GraphQLDateTimeRange, date, new Date(date.getTime() + 1000)],
        [GraphQLFloatRange, 2.5, 7.5],
        [GraphQLIntRange, 7, 42],
      ]
      assertions.forEach(assertion => assertSerializeThrows(...assertion))
    })
  })

  describe('parseValue', () => {
    it('should parse a value correctly', () => {
      const assertParsesCorrectly = ({ parseValue }, lowerValue, upperValue, parsedLower, parsedUpper) => {
        expect(parseValue([
          { value: lowerValue, inclusive: true },
          { value: upperValue, inclusive: false },
        ])).toEqual([
          { value: parsedLower, inclusive: true },
          { value: parsedUpper, inclusive: false },
        ])
        expect(parseValue([
          { value: lowerValue, inclusive: false },
          { value: upperValue, inclusive: true },
        ])).toEqual([
          { value: parsedLower, inclusive: false },
          { value: parsedUpper, inclusive: true },
        ])
        expect(parseValue([
          { value: null, inclusive: false },
          { value: null, inclusive: true },
        ])).toEqual([
          { value: null, inclusive: false },
          { value: null, inclusive: true },
        ])
        expect(parseValue([
          { value: lowerValue },
          { value: upperValue },
        ])).toEqual([
          { value: parsedLower, inclusive: true },
          { value: parsedUpper, inclusive: false },
        ])
      }
      const dateA = new Date()
      const dateAParsed = new Date(dateA.toISOString().substring(0, 10))
      const dateB = new Date(Date.now() + 86400000)
      const dateBParsed = new Date(dateB.toISOString().substring(0, 10))
      const assertions = [
        [GraphQLDateRange, dateA.toISOString().substring(0, 10), dateB.toISOString().substring(0, 10), dateAParsed, dateBParsed],
        [GraphQLDateTimeRange, dateA.toISOString(), dateB.toISOString(), dateA, dateB],
        [GraphQLFloatRange, 2.5, 7.5, 2.5, 7.5],
        [GraphQLIntRange, 7, 42, 7, 42],
      ]
      assertions.forEach(assertion => assertParsesCorrectly(...assertion))
    })
    it('should throw an error', () => {
      const assertParseValueThrows = ({ parseValue }, lowerValue, upperValue) => {
        const lower = { value: lowerValue, inclusive: true }
        const upper = { value: upperValue, inclusive: false }
        expect(() => parseValue()).toThrow('should be an array of length 2')
        expect(() => parseValue([])).toThrow('should be an array of length 2')
        expect(() => parseValue([
          false,
          upper,
        ])).toThrow('lower bound must be an object')
        expect(() => parseValue([
          lower,
          42,
        ])).toThrow('upper bound must be an object')
        expect(() => parseValue([
          { value: lower.value, inclusive: 42 },
          upper,
        ])).toThrow('Lower bound inclusive field must be a boolean')
        expect(() => parseValue([
          lower,
          { value: upper.value, inclusive: 42 },
        ])).toThrow('Upper bound inclusive field must be a boolean')
        expect(() => parseValue([
          { inclusive: lower.inclusive },
          upper,
        ])).toThrow('Lower bound must specify value field')
        expect(() => parseValue([
          lower,
          { inclusive: upper.inclusive },
        ])).toThrow('Upper bound must specify value field')
      }
      const date = new Date()
      const assertions = [
        [GraphQLDateRange, date.toISOString(), new Date(date.getTime() + 1000).toISOString()],
        [GraphQLDateTimeRange, date.toISOString(), new Date(date.getTime() + 1000).toISOString()],
        [GraphQLFloatRange, 2.5, 7.5],
        [GraphQLIntRange, 7, 42],
      ]
      assertions.forEach(assertion => assertParseValueThrows(...assertion))
    })
  })

  describe('parseLiteral', () => {
    it('should parse a literal value correctly', () => {
      const assertParsesCorrectly = ({ parseLiteral }, lowerValue, upperValue, parsedLower, parsedUpper) => {
        expect(parseLiteral(parse(`[
          { value: ${lowerValue}, inclusive: true },
          { value: ${upperValue}, inclusive: false },
        ]`))).toEqual([
          { value: parsedLower, inclusive: true },
          { value: parsedUpper, inclusive: false },
        ])
        expect(parseLiteral(parse(`[
          { value: ${lowerValue}, inclusive: false },
          { value: ${upperValue}, inclusive: true },
        ]`))).toEqual([
          { value: parsedLower, inclusive: false },
          { value: parsedUpper, inclusive: true },
        ])
        expect(parseLiteral(parse(`[
          { value: null, inclusive: false },
          { value: null, inclusive: true },
        ]`))).toEqual([
          { value: null, inclusive: false },
          { value: null, inclusive: true },
        ])
        expect(parseLiteral(parse(`[
          { value: ${lowerValue} },
          { value: ${upperValue} },
        ]`))).toEqual([
          { value: parsedLower, inclusive: true },
          { value: parsedUpper, inclusive: false },
        ])
      }
      const dateA = new Date()
      const dateALiteral = JSON.stringify(dateA.toISOString())
      const dateAParsed = new Date(dateA.toISOString().substring(0, 10))
      const dateALiteralDayOnly = JSON.stringify(dateAParsed.toISOString().substring(0, 10))
      const dateB = new Date(Date.now() + 86400000)
      const dateBLiteral = JSON.stringify(dateB.toISOString())
      const dateBParsed = new Date(dateB.toISOString().substring(0, 10))
      const dateBLiteralDayOnly = JSON.stringify(dateBParsed.toISOString().substring(0, 10))
      const assertions = [
        [GraphQLDateRange, dateALiteralDayOnly, dateBLiteralDayOnly, dateAParsed, dateBParsed],
        [GraphQLDateTimeRange, dateALiteral, dateBLiteral, dateA, dateB],
        [GraphQLFloatRange, 2.5, 7.5, 2.5, 7.5],
        [GraphQLIntRange, 7, 42, 7, 42],
      ]
      assertions.forEach(assertion => assertParsesCorrectly(...assertion))
    })
    it('should throw an error', () => {
      const assertParseValueThrows = ({ parseLiteral }, lowerValue, upperValue) => {
        const lower = `{ value: ${lowerValue}, inclusive: true }`
        const upper = `{ value: ${upperValue}, inclusive: false }`
        expect(() => parseLiteral(parse(`{}`))).toThrow('should be an array of length 2')
        expect(() => parseLiteral(parse(`[]`))).toThrow('should be an array of length 2')
        expect(() => parseLiteral(parse(`[
          false,
          ${upper},
        ]`))).toThrow('lower bound must be an object')
        expect(() => parseLiteral(parse(`[
          ${lower},
          42,
        ]`))).toThrow('upper bound must be an object')
        expect(() => parseLiteral(parse(`[
          { value: ${lowerValue}, inclusive: 42 },
          ${upper},
        ]`))).toThrow('Lower bound inclusive field must be a boolean')
        expect(() => parseLiteral(parse(`[
          ${lower},
          { value: ${upperValue}, inclusive: 42 },
        ]`))).toThrow('Upper bound inclusive field must be a boolean')
        expect(() => parseLiteral(parse(`[
          { inclusive: true },
          ${upper},
        ]`))).toThrow('Lower bound must specify value field')
        expect(() => parseLiteral(parse(`[
          ${lower},
          { inclusive: true },
        ]`))).toThrow('Upper bound must specify value field')
      }
      const dateA = new Date()
      const dateALiteral = JSON.stringify(dateA.toISOString())
      const dateAParsed = new Date(dateA.toISOString().substring(0, 10))
      const dateALiteralDayOnly = JSON.stringify(dateAParsed.toISOString().substring(0, 10))
      const dateB = new Date(Date.now() + 86400000)
      const dateBLiteral = JSON.stringify(dateB.toISOString())
      const dateBParsed = new Date(dateB.toISOString().substring(0, 10))
      const dateBLiteralDayOnly = JSON.stringify(dateBParsed.toISOString().substring(0, 10))
      const assertions = [
        [GraphQLDateRange, dateALiteralDayOnly, dateBLiteralDayOnly],
        [GraphQLDateTimeRange, dateALiteral, dateBLiteral],
        [GraphQLFloatRange, 2.5, 7.5],
        [GraphQLIntRange, 7, 42],
      ]
      assertions.forEach(assertion => assertParseValueThrows(...assertion))
    })
  })
})
