const { parse } = require('graphql')

/**
 * Merges type system definition documents into a single document.
 * Duplicate object type definitions are merged into a single definition.
 */
function mergeTypeDefs (typeDefs) {
  const documents = typeDefs.map((document) => {
    if (typeof document === 'string') {
      return parse(document)
    }
    return document
  })
  const definitions = []

  documents.forEach((document) => {
    document.definitions.forEach(definition => {
      switch (definition.kind) {
        case 'ObjectTypeDefinition': {
          const existingDefinition = definitions.find((def) => {
            return def.kind === 'ObjectTypeDefinition' && def.name.value === definition.name.value
          })
          if (existingDefinition) {
            existingDefinition.description = definition.description || existingDefinition.description
            existingDefinition.fields = mergeFields(existingDefinition.fields, definition.fields)
            existingDefinition.directives = mergeDirectives(existingDefinition.directives, definition.directives)
            existingDefinition.interfaces = mergeInterfaces(existingDefinition.interfaces, definition.interfaces)
            return
          }
          break
        }
        case 'InterfaceTypeDefinition': {
          const existingDefinition = definitions.find((def) => {
            return def.kind === 'InterfaceTypeDefinition' && def.name.value === definition.name.value
          })
          if (existingDefinition) {
            existingDefinition.description = definition.description || existingDefinition.description
            existingDefinition.fields = mergeFields(existingDefinition.fields, definition.fields)
            existingDefinition.directives = mergeDirectives(existingDefinition.directives, definition.directives)
            return
          }
          break
        }
        case 'UnionTypeDefinition': {
          const existingDefinition = definitions.find((def) => {
            return def.kind === 'UnionTypeDefinition' && def.name.value === definition.name.value
          })
          if (existingDefinition) {
            existingDefinition.description = definition.description || existingDefinition.description
            existingDefinition.directives = mergeDirectives(existingDefinition.directives, definition.directives)
            existingDefinition.types = mergeUnionTypes(existingDefinition.types, definition.types)
            return
          }
          break
        }
        case 'EnumTypeDefinition': {
          const existingDefinition = definitions.find((def) => {
            return def.kind === 'EnumTypeDefinition' && def.name.value === definition.name.value
          })
          if (existingDefinition) {
            existingDefinition.description = definition.description || existingDefinition.description
            existingDefinition.directives = mergeDirectives(existingDefinition.directives, definition.directives)
            existingDefinition.values = mergeEnumValues(existingDefinition.values, definition.values)
            return
          }
          break
        }
        case 'InputObjectTypeDefinition': {
          const existingDefinition = definitions.find((def) => {
            return def.kind === 'InputObjectTypeDefinition' && def.name.value === definition.name.value
          })
          if (existingDefinition) {
            existingDefinition.description = definition.description || existingDefinition.description
            existingDefinition.fields = mergeInputValues(existingDefinition.fields, definition.fields)
            existingDefinition.directives = mergeDirectives(existingDefinition.directives, definition.directives)
            return
          }
          break
        }
      }
      definitions.push(definition)
    })
  })

  return {
    kind: 'Document',
    definitions,
  }
}

function mergeFields (fields, newFields) {
  newFields.forEach((newField) => {
    const existingField = fields.find((field) => {
      return field.name.value === newField.name.value
    })
    if (existingField) {
      existingField.description = newField.description || existingField.description
      existingField.arguments = mergeInputValues(existingField.arguments, newField.arguments)
      existingField.directives = mergeDirectives(existingField.directives, newField.directives)
      existingField.type = newField.type
    } else {
      fields.push(newField)
    }
  })

  return fields
}

function mergeInputValues (args, newArgs) {
  newArgs.forEach((newArg) => {
    const existingArg = args.find((arg) => {
      return arg.name.value === newArg.name.value
    })
    if (existingArg) {
      existingArg.description = newArg.description || existingArg.description
      existingArg.defaultValue = newArg.defaultValue || existingArg.defaultValue
      existingArg.directives = mergeDirectives(existingArg.directives, newArg.directives)
      existingArg.type = newArg.type
    } else {
      args.push(newArg)
    }
  })

  return args
}

function mergeDirectives (directives, newDirectives) {
  newDirectives.forEach((newDirective) => {
    const existingDirective = directives.find((directive) => {
      return directive.name.value === newDirective.name.value
    })
    if (existingDirective) {
      existingDirective.arguments = mergeDirectiveArguments(existingDirective.arguments, newDirective.arguments)
    } else {
      directives.push(newDirective)
    }
  })

  return directives
}

function mergeDirectiveArguments (args, newArgs) {
  newArgs.forEach((newArg) => {
    const existingArg = args.find((arg) => {
      return arg.name.value === newArg.name.value
    })
    if (existingArg) {
      existingArg.value = newArg.value
    } else {
      args.push(newArg)
    }
  })

  return args
}

function mergeInterfaces (interfaces, newInterfaces) {
  newInterfaces.forEach((newInterface) => {
    const existingInterface = interfaces.find((anInterface) => {
      return anInterface.name.value === newInterface.name.value
    })
    if (!existingInterface) {
      interfaces.push(newInterface)
    }
  })

  return interfaces
}

function mergeUnionTypes (types, newTypes) {
  newTypes.forEach((newType) => {
    const existingType = types.find((type) => {
      return type.name.value === newType.name.value
    })
    if (!existingType) {
      types.push(newType)
    }
  })

  return types
}

function mergeEnumValues (values, newValues) {
  newValues.forEach((newValue) => {
    const existingValue = values.find((value) => {
      return value.name.value === newValue.name.value
    })
    if (existingValue) {
      existingValue.description = newValue.description || existingValue.description
      existingValue.directives = mergeDirectives(newValue.directives, existingValue.directives)
    } else {
      values.push(newValue)
    }
  })

  return values
}

module.exports = {
  mergeTypeDefs,
}
