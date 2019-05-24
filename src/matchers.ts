import * as Store from './store'
import * as Transformers from './transformers'

export function matches(matcher: Store.Matcher, event): boolean {
    switch (matcher.type) {
        case 'all':
            return all()
        case 'fql':
            return fql(matcher.ir, event)
        default:
            throw new Error(`Matcher of type ${matcher.type} unsupported.`)
    }
}

function all(): boolean {
    return true
}

function fql(ir: Store.Matcher['ir'], event): boolean {
    if (!ir) {
        return false
    }

    try {
        ir = JSON.parse(ir)
    } catch (e) {
        throw new Error(`Failed to JSON.parse FQL intermediate representation "${ir}": ${e}`)
    }

    const result = fqlEvaluate(ir, event)
    if (typeof result !== 'boolean') {
        // An error was returned, or a lowercase, typeof, or similar function was run alone. Nothing to evaluate.
        return false
    }

    return result
}

// FQL is 100% type strict in Go. Show no mercy to types which do not comply.
function fqlEvaluate(ir, event) {
    // If the given ir chunk is not an array, then we should check the single given path or value for literally `true`.
    if (!Array.isArray(ir)) {
        return getValue(ir, event) === true
    }

    // Otherwise, it is a sequence of ordered steps to follow to reach our solution!
    const item = ir[0]
    switch (item) {
        /*** Unary cases ***/
        // '!' => Invert the result
        case '!':
            return !fqlEvaluate(ir[1], event)

        /*** Binary cases ***/
        // 'or' => Any condition being true returns true
        case 'or':
            for (let i = 1; i < ir.length; i++) {
                if (fqlEvaluate(ir[i], event)) {
                    return true
                }
            }
            return false
        // 'and' => Any condition being false returns false
        case 'and':
            for (let i = 1; i < ir.length; i++) {
                if (!fqlEvaluate(ir[i], event)) {
                    return false
                }
            }
            return true
        // Equivalence comparisons
        case '=':
        case '!=':
            return compareItems(getValue(ir[1], event), getValue(ir[2], event), item, event)
        // Numerical comparisons
        case '<=':
        case '<':
        case '>':
        case '>=':
            // Compare the two values with the given operator.
           return compareNumbers(getValue(ir[1], event), getValue(ir[2], event), item, event)

        /*** Functions ***/
        // 'contains(str1, str2)' => The first string has a substring of the second string
        case 'contains':
            return contains(getValue(ir[1], event), getValue(ir[2], event))
        // 'match(str, match)' => The given string matches the provided glob matcher
        case 'match':
            // TODO: Import glob match library that === segmentio/glob
        // 'lowercase(str)' => Returns a lowercased string, null if the item is not a string
        case 'lowercase':
            const target = getValue(ir[1], event)
            if (typeof target !== 'string') {
                return null
            }
            return target.toLowerCase()
        // 'typeof(val)' => Returns the FQL type of the value
        case 'typeof':
            // TODO: Do we need mapping to allow for universal comparisons? e.g. Object -> JSON, Array -> List, Floats?
            return typeof getValue(ir[1], event)
        // 'length(val)' => Returns the length of an array or string, NaN if neither
        case 'length':
            return length(getValue(ir[1], event))
        // If nothing hit, we or the IR messed up somewhere.
        default:
            throw new Error(`FQL IR could not evaluate for token: ${item}`)
    }
}

function getValue(item, event) {
    // If item is an array, leave it as-is.
    if (Array.isArray(item)) {
        return item
    }

    // If item is an object, it has the form of `{"value": VAL}`
    if (typeof item === 'object') {
        return item.value
    }

    // Otherwise, it's an event path, e.g. "properties.email"
    return Transformers.getFieldFromKey(event, item)
}

function compareNumbers(first, second, operator, event): boolean {
    // Check if it's more IR (such as a length() function)
    if (isIR(first)) {
        first = fqlEvaluate(first, event)
    }

    if (isIR(second)) {
        second = fqlEvaluate(second, event)
    }

    if (typeof first !== 'number' || typeof second !== 'number') {
        return false
    }

    // Reminder: NaN is not comparable to any other number (including NaN) and will always return false as desired.
    switch (operator) {
        // '<=' => The first number is less than or equal to the second.
        case '<=':
            return first <= second
        // '>=' => The first number is greater than or equal to the second
        case '>=':
            return first >= second
        // '<' The first number is less than the second.
        case '<':
            return first < second
        // '>' The first number is greater than the second.
        case '>':
            return first > second
        default:
            throw new Error(`Invalid operator in compareNumbers: ${operator}`)
    }
}

function compareItems(first, second, operator, event): boolean {
    // Check if it's more IR (such as a lowercase() function)
    if (isIR(first)) {
        first = fqlEvaluate(first, event)
    }

    if (isIR(second)) {
        second = fqlEvaluate(second, event)
    }

    if (typeof first === 'object' && typeof second === 'object') {
        first = JSON.stringify(first)
        second = JSON.stringify(second)
    }

    // Objects with the exact same contents AND order ARE considered identical. (Don't compare by reference)
    // Even in Go, this MUST be the same byte order.
    // e.g. {a: 1, b:2} === {a: 1, b:2} BUT {a:1, b:2} !== {b:2, a:1}
    // Maybe later we'll use a stable stringifier, but we're matching server-side behavior for now.
    switch (operator) {
        // '=' => The two following items are exactly identical
        case '=':
            return first === second
        // '!=' => The two following items are NOT exactly identical.
        case '!=':
            return first !== second
        default:
            throw new Error(`Invalid operator in compareItems: ${operator}`)
    }
}

function contains(first, second): boolean {
    if (typeof first !== 'string' || typeof second !== 'string') {
        return false
    }



    return first.indexOf(second) !== -1
}

function length(item) {
    // Type-check to avoid returning .length of an object
    if (!Array.isArray(item) && typeof item !== 'string') {
        return NaN
    }

    return item.length
}

// This is a heuristic technically speaking, but should be close enough. The odds of someone trying to test
// a func with identical IR notation is pretty low.
function isIR(value): boolean {
    if (!Array.isArray(value)) {
        return false
    }

    // Function checks
    if ((value[0] === 'lowercase' || value[0] === 'length' || value[0] === 'typeof') && value.length === 2) {
        return true
    }

    if ((value[0] === 'contains' || value[0] === 'match') && value.length === 3) {
        return true
    }

    return false
}