import * as Matchers from './matchers'
import * as Store from './store'

import * as simple from '../fixtures/simple.json'
import * as many from '../fixtures/manyProperties.json'

let simpleEvent
let manyPropertiesEvent
let matcher: Store.Matcher
beforeEach(() => {
    simpleEvent = JSON.parse(JSON.stringify(simple))
    manyPropertiesEvent = JSON.parse(JSON.stringify(many))
    matcher = {
        ir: 'true',
        type: 'fql'
    }
})

describe('error handling and basic checks', () => {
    test('throws on a bad IR', () => {
        matcher.ir = 'Invalid//**[]""""json',

            expect(() => {
                Matchers.matches(matcher, {})
            }).toThrow()
    })

    test('throws on a bad Type', () => {
        matcher.type = 'its free real estate'

        expect(() => {
            Matchers.matches(matcher, {})
        }).toThrow()
    })

    test('returns true and accepts no IR if the type is All', () => {
        matcher.ir = ''
        matcher.type = 'all'

        expect(Matchers.matches(matcher, {})).toBe(true)
    })

    test('returns false on an empty IR for FQL', () => {
        matcher.ir = ''

        expect(Matchers.matches(matcher, {})).toBe(false)
    })

    test('can handle large payloads', () => {
        // FQL: "trueValue"
        matcher.ir = '"trueValue"'

        manyPropertiesEvent.trueValue = true
        expect(Matchers.matches(matcher, manyPropertiesEvent)).toBe(true)
    })

    test('can parse paths', () => {
        // FQL: "trueValue"
        matcher.ir = '"trueValue"'

        simpleEvent.trueValue = true
        expect(Matchers.matches(matcher, simpleEvent)).toBe(true)
    })

    test('can parse values', () => {
        // FQL: true
        matcher.ir = '{"value": true}'

        expect(Matchers.matches(matcher, simpleEvent)).toBe(true)
    })

    test('returns false if the fql returns a non-boolean', () => {
        // FQL: "stringValue"
        matcher.ir = '"stringValue"'

        simpleEvent.stringValue = 'true'
        expect(Matchers.matches(matcher, simpleEvent)).toBe(false)
    })
})

describe('boolean literals', () => {
    test('handles true literals', () => {
        // FQL: true
        matcher.ir = `{"value":true}`
        expect(Matchers.matches(matcher, {})).toBe(true)
    })

    test('handles false literals', () => {
        // FQL: false
        matcher.ir = `{"value":false}`
        expect(Matchers.matches(matcher, {})).toBe(false)
    })
})

describe('functions', () => {
    // TODO MATCH. :(
    /*
    test(match works)
     */

    test('contains() works', () => {
        // FQL: contains(email, ".com")
        matcher.ir = `["contains", "email", {"value": ".com"}]`
        simpleEvent.email = 'test@test.com'
        expect(Matchers.matches(matcher, simpleEvent)).toBe(true)

        simpleEvent.email = 'test@test.org'
        expect(Matchers.matches(matcher, simpleEvent)).toBe(false)
    })

    test('lowercase() works', () => {
        // FQL: "test" = lowercase("TEST")
        matcher.ir = `["=", {"value": "test"}, ["lowercase", {"value": "TEST"}]]`
        expect(Matchers.matches(matcher, {})).toBe(true)

        // FQL: "TEST" = lowercase("TEST")
        matcher.ir = `["=", {"value": "TEST"}, ["lowercase", {"value": "TEST"}]]`
        expect(Matchers.matches(matcher, {})).toBe(false)
    })

    test('length() works', () => {
        // FQL: 4 = length("TEST")
        matcher.ir = `["=", {"value": 4}, ["length", {"value": "TEST"}]]`
        expect(Matchers.matches(matcher, {})).toBe(true)

        // FQL: 5 = length("TEST")
        matcher.ir = `["=", {"value": 5}, ["length", {"value": "TEST"}]]`
        expect(Matchers.matches(matcher, {})).toBe(false)
    })

    test('typeof() works', () => {
        // FQL: "boolean" = typeof(true)
        matcher.ir = `["=", {"value": "boolean"}, ["typeof", {"value": true}]]`
        expect(Matchers.matches(matcher, {})).toBe(true)

        // FQL: "boolean" = typeof("str")
        matcher.ir = `["=", {"value": "boolean"}, ["typeof", {"value": "str"}]]`
        expect(Matchers.matches(matcher, {})).toBe(false)
    })

    test('unknown functions fail', () => {
        // FQL: <Not valid FQL>
        matcher.ir = `["findTheDefiniteIntegralOf", {"value": "2x+47"}, {"value": "Bounded from 1 to 3"}]`
        expect(() => {
            Matchers.matches(matcher, {})
        }).toThrow()
    })
})

describe('arrays', () => {
    test('arrays with same contents and order are equal', () => {
        // FQL: [] = []
        matcher.ir = `["=",{"value":[]},{"value":[]}]`
        expect(Matchers.matches(matcher, {})).toBe(true)

        // FQL: [1] = [1]
        matcher.ir = `["=",{"value":[{"value":1}]},{"value":[{"value":1}]}]`
        expect(Matchers.matches(matcher, {})).toBe(true)

        // FQL: [1, 2] = [1, 2]
        matcher.ir = `["=",{"value":[{"value":1}, {"value":2}]},{"value":[{"value":1}, {"value":2}]}]`
        expect(Matchers.matches(matcher, {})).toBe(true)

        // FQL: [1, 2] = [2, 1]
        matcher.ir = `["=",{"value":[{"value":1}, {"value":2}]},{"value":[{"value":2}, {"value":1}]}]`
        expect(Matchers.matches(matcher, {})).toBe(false)
    })
})

describe('number comparison operands', () => {
    test('= works', () => {
        // FQL: 0 = 0
        matcher.ir = `["=",{"value":0},{"value":0}]`
        expect(Matchers.matches(matcher, {})).toBe(true)

        // FQL: 0 = 1
        matcher.ir = `["=",{"value":0},{"value":1}]`
        expect(Matchers.matches(matcher, {})).toBe(false)
    })

    test('!= works', () => {
        // FQL: 5 != 6
        matcher.ir = `["!=",{"value":5},{"value":6}]`
        expect(Matchers.matches(matcher, {})).toBe(true)

        // FQL: 7 != 7
        matcher.ir = `["!=",{"value":7},{"value":7}]`
        expect(Matchers.matches(matcher, {})).toBe(false)
    })

    test('<= works', () => {
        // FQL: 5 <= 6
        matcher.ir = `["<=",{"value":5},{"value":6}]`
        expect(Matchers.matches(matcher, {})).toBe(true)

        // FQL: 6 <= 6
        matcher.ir = `["<=",{"value":6},{"value":6}]`
        expect(Matchers.matches(matcher, {})).toBe(true)

        // FQL: 7 <= 6
        matcher.ir = `["<=",{"value":7},{"value":6}]`
        expect(Matchers.matches(matcher, {})).toBe(false)
    })

    test('>= works', () => {
        // FQL: 5 >= 6
        matcher.ir = `[">=",{"value":5},{"value":6}]`
        expect(Matchers.matches(matcher, {})).toBe(false)

        // FQL: 6 >= 6
        matcher.ir = `[">=",{"value":6},{"value":6}]`
        expect(Matchers.matches(matcher, {})).toBe(true)

        // FQL: 7 >= 6
        matcher.ir = `[">=",{"value":7},{"value":6}]`
        expect(Matchers.matches(matcher, {})).toBe(true)
    })

    test('< works', () => {
        // FQL: 5 < 6
        matcher.ir = `["<",{"value":5},{"value":6}]`
        expect(Matchers.matches(matcher, {})).toBe(true)

        // FQL: 6 < 6
        matcher.ir = `["<",{"value":6},{"value":6}]`
        expect(Matchers.matches(matcher, {})).toBe(false)
    })

    test('> works', () => {
        // FQL: 6 > 6
        matcher.ir = `[">",{"value":6},{"value":6}]`
        expect(Matchers.matches(matcher, {})).toBe(false)

        // FQL: 7 > 6
        matcher.ir = `[">",{"value":7},{"value":6}]`
        expect(Matchers.matches(matcher, {})).toBe(true)
    })
})


describe('binary operands', () => {
    test('and works', () => {
        // FQL: true and true and true
        matcher.ir = `["and",{"value":true},{"value":true},{"value":true}]`
        expect(Matchers.matches(matcher, {})).toBe(true)

        // FQL: true and true and false
        matcher.ir = `["and",{"value":true},{"value":true},{"value":false}]`
        expect(Matchers.matches(matcher, {})).toBe(false)
    })

    test('or works', () => {
        // FQL: false or false or true
        matcher.ir = `["or",{"value":false},{"value":false},{"value":true}]`
        expect(Matchers.matches(matcher, {})).toBe(true)

        // FQL: false or false or false
        matcher.ir = `["or",{"value":false},{"value":false},{"value":false}]`
        expect(Matchers.matches(matcher, {})).toBe(false)
    })
})

describe('subexpressions', () => {
    test('nested and/ors work', () => {
        // FQL: (false or true) and true
        matcher.ir = `["and",["or",{"value":false},{"value":true}],{"value":true}]`
        expect(Matchers.matches(matcher, {})).toBe(true)
    })
})
