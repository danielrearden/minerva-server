const { dedentBlockStringValue } = require('graphql/language/blockString')
const { print, parse } = require('graphql')
const { mergeTypeDefs } = require('../merge-type-defs')

describe('mergeTypeDefs', () => {
  it('should combine types with the same name', () => {
    const document = mergeTypeDefs([
      `
        scalar CustomScalar

        type Query {
          foo: String
          bar(count: Int = 6, label: String = "text"): String @dir2(arg: 7)
          qux: String
        }

        interface Interface {
          foo: String
        }

        """Interface description 2"""
        interface Interface2 {
          foo: String
          baz: String
        }

        union Union = Foo | Bar

        """Union description 2"""
        union Union2 = Foo | Bar

        enum Enum1 {
          ABC
        }

        """Enum description 2"""
        enum Enum2 {
          XYZ
        }

        input FooInput {
          foo: String
        }

        """Input description2"""
        input FooInput2 {
          foo: String
          bar: String
        }
      `,
      `
        """Query description"""
        type Query @dir1 {
          """foo description"""
          foo: String
          bar(count: Int = 12, label: String, cost: Float): String @dir2(arg: 12, arg2: true)
          baz: String
        }

        type Foo implements Bar @dir3 {
          fob: String
        }

        """Interface description"""
        interface Interface {
          baz: String
        }

        interface Interface2 {
          foo: String
          baz: String
        }

        """Union description"""
        union Union = Bar | Qux

        union Union2 = Bar | Qux

        """Enum description"""
        enum Enum1 {
          DEF
        }

        enum Enum2 {
          XYZ
        }

        """Input description"""
        input FooInput {
          """Input field description"""
          foo: String
          bar: String
        }

        input FooInput2 {
          foo: String
          bar: String
        }
      `,
      parse(`
       type Query implements Interface

       type Foo implements Bar & Qux @dir3(arg: 42)
      `),
    ])
    assertDocumentsEqual(document, `
    scalar CustomScalar

    """Query description"""
    type Query implements Interface @dir1 {
      """foo description"""
      foo: String
      bar(count: Int = 12, label: String = "text", cost: Float): String @dir2(arg: 12, arg2: true)
      qux: String
      baz: String
    }

    """Interface description"""
    interface Interface {
      foo: String
      baz: String
    }

    """Interface description 2"""
    interface Interface2 {
      foo: String
      baz: String
    }

    """Union description"""
    union Union = Foo | Bar | Qux

    """Union description 2"""
    union Union2 = Foo | Bar | Qux

    """Enum description"""
    enum Enum1 {
      ABC
      DEF
    }

    """Enum description 2"""
    enum Enum2 {
      XYZ
    }

    """Input description"""
    input FooInput {
      """Input field description"""
      foo: String
      bar: String
    }

    """Input description2"""
    input FooInput2 {
      foo: String
      bar: String
    }

    type Foo implements Bar & Qux @dir3(arg: 42) {
      fob: String
    }
    `)
  })

  function assertDocumentsEqual (documentAST, documentString) {
    expect(print(documentAST).trim()).toEqual(dedentBlockStringValue(documentString))
  }
})
