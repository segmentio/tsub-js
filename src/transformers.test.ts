import * as Store from './store'
import * as Transformers from './transformers'

import * as simple from '../fixtures/simple.json'
import * as many from '../fixtures/manyProperties.json'

let simpleEvent
let manyPropertiesEvent
let transformer: Store.Transformer

// Sample transformer config: `[]`
beforeEach(() => {
    simpleEvent = JSON.parse(JSON.stringify(simple))
    manyPropertiesEvent = JSON.parse(JSON.stringify(many))
    transformer = {
        type: 'drop',
        config: null
    }
})

describe('error handling and basic checks', () => {
    test('throws an error on an invalid transform type', () => {
        transformer.config = '{}'
        transformer.type = 'not_a_transform'

        expect(() => { Transformers.transform({}, [transformer]) }).toThrow()
    })

    test('throws an error if unparsable config is supplied', () => {
        transformer.config = '{{{{{{'
        expect(() => { Transformers.transform({}, [transformer]) }).toThrow()
    })

    test('throws an error if config is null and type is not drop', () => {
        transformer.type = 'drop_properties'
        expect(() => { Transformers.transform({}, [transformer]) }).toThrow()

        transformer.type = 'allow_properties'
        expect(() => { Transformers.transform({}, [transformer]) }).toThrow()

        transformer.type = 'sample_event'
        expect(() => { Transformers.transform({}, [transformer]) }).toThrow()
    })

    test('does not throw an error if config is null and type is drop', () => {
        // Using default transformer
        expect(Transformers.transform({}, [transformer])).toBe(null)
    })
})

describe('drop', () => {
    beforeEach(() => {
      transformer.type = 'drop'
      transformer.config = null
    })

    test('drop should return null to any payload', () => {
        expect(Transformers.transform({}, [transformer])).toBe(null)
        expect(Transformers.transform(simpleEvent, [transformer])).toBe(null)
        expect(Transformers.transform(manyPropertiesEvent, [transformer])).toBe(null)
        expect(Transformers.transform('I like cheese.', [transformer])).toBe(null)
    })
})

describe('drop_properties', () => {
    beforeEach(() => {
        transformer.type = 'drop_properties'
        transformer.config = `{"drop": {"properties": ["email", "phoneNumber"]}}`
    })

    test('drop_properties should mutate the input object', () => {
        simpleEvent.properties.phoneNumber = '867-5309'
        Transformers.transform(simpleEvent, [transformer])

        expect(simpleEvent.properties.phoneNumber).toBeUndefined()
    })

    test('drop_properties should drop top-level fields', () => {
        simpleEvent.someTopLevelField = 'test'
        transformer.config = `{"drop": {"": ["someTopLevelField"]}}`

        Transformers.transform(simpleEvent, [transformer])
        expect(simpleEvent.someTopLevelField).toBeUndefined()
    })

    test('drop_properties should drop nested fields', () => {
        simpleEvent.nest1 = {
            nest2: {
                nest3: {
                    nest4: {
                        nest5: 'hai :3'
                    }
                }
            }
        }
        transformer.config = `{"drop": {"nest1.nest2.nest3.nest4": ["nest5"]}}`

        Transformers.transform(simpleEvent, [transformer])
        expect(simpleEvent.nest1.nest2.nest3.nest4.nest5).toBeUndefined()
    })

    test('drop_properties should work quickly even on huge objects', () => {
        manyPropertiesEvent.nest1 = {
            nest2: {
                nest3: {
                    nest4: {
                        nest5: 'hai :3'
                    }
                }
            }
        }
        transformer.config = `{"drop": {"nest1.nest2.nest3.nest4": ["nest5"]}}`

        Transformers.transform(manyPropertiesEvent, [transformer])
        expect(manyPropertiesEvent.nest1.nest2.nest3.nest4.nest5).toBeUndefined()
    }, 500)
})

describe('allow_properties', () => {
    beforeEach(() => {
        transformer.type = 'allow_properties'
        transformer.config = `{"allow": {"properties": ["email"]}}`
    })

    test('allow_properties should mutate the input object', () => {
        simpleEvent.properties.phoneNumber = '867-5309'

        Transformers.transform(simpleEvent, [transformer])
        expect(simpleEvent.properties.phoneNumber).toBeUndefined()
    })

    test('allow_properties should work on the top-level object (ill-advised as it is)', () => {
        simpleEvent.onlyAllowedProp = 'test'
        transformer.config = `{"allow": {"": ["onlyAllowedProp"]}}`
        expect(Object.keys(simpleEvent).length > 1)


        Transformers.transform(simpleEvent, [transformer])
        expect(simpleEvent).toStrictEqual({onlyAllowedProp: 'test'})
    })

    test('allow_properties should drop nested fields and only in those fields', () => {
        simpleEvent.nest1 = {
            nest2: {
                nest3: {
                    nest4: {
                        nest5: 'hai :3',
                        nest6: 'bye ;_;'
                    }
                }
            }
        }
        transformer.config = `{"allow": {"nest1.nest2.nest3.nest4": ["nest5"]}}`
        const originalPropCount = Object.keys(simpleEvent).length

        Transformers.transform(simpleEvent, [transformer])
        expect(originalPropCount === Object.keys(simpleEvent).length)
        expect(simpleEvent.nest1.nest2.nest3.nest4).toStrictEqual({nest5: 'hai :3'})
    })

    test('drop_properties should work quickly even on huge objects', () => {
        manyPropertiesEvent.nest1 = {
            nest2: {
                nest3: {
                    nest4: {
                        nest5: 'hai :3',
                        nest6: 'bye ;_;'
                    }
                }
            }
        }
        transformer.config = `{"allow": {"nest1.nest2.nest3.nest4": ["nest5"]}}`
        const originalPropCount = Object.keys(manyPropertiesEvent).length

        Transformers.transform(manyPropertiesEvent, [transformer])
        expect(originalPropCount === Object.keys(manyPropertiesEvent).length)
        expect(manyPropertiesEvent.nest1.nest2.nest3.nest4).toStrictEqual({nest5: 'hai :3'})
    }, 500)
})

describe('sample_event', () => {
    beforeEach(() => {
        transformer.type = 'sample_event'
        transformer.config = `{"sample": {"percent": 0.0, "path": ""}}`
    })

    test('sample_event always returns false if percent is 0% or less', () => {
        // Run many times to ensure same results each time
        for (let i = 0; i < 1000; i++) {
            simpleEvent = JSON.parse(JSON.stringify(simple))

            const payload = Transformers.transform(simpleEvent, [transformer])
            expect(payload).toBeNull()
        }
    })

    test('sample_event always returns true if percent is 100% or more', () => {
        transformer.config = `{"sample": {"percent": 1.01, "path": ""}}`

        for (let i = 0; i < 1000; i++) {
            simpleEvent = JSON.parse(JSON.stringify(simple))

            const payload = Transformers.transform(simpleEvent, [transformer])
            expect(payload).toStrictEqual(simpleEvent)
        }
    })

    test('sample_event allows sampling based off a JSON path\'s value', () => {
        transformer.config = `{"sample": {"percent": 0.50, "path": "propToSampleOffOf"}}`
        simpleEvent.propToSampleOffOf = 'abcd'

        // Check for no throw - value (null or unfiltered) isn't important in this test.
        expect(Transformers.transform(simpleEvent, [transformer])).toBeDefined()
    })

    test('sample_event returns the same result every time for a given path:value', () => {
        transformer.config = `{"sample": {"percent": 0.50, "path": "propToSampleOffOf"}}`
        for (let i = 0; i < 100; i++) {
            simpleEvent.propToSampleOffOf = Math.random()
            const firstResult = Transformers.transform(simpleEvent, [transformer])
            for (let j = 0; j < 100; j++) {
                const repeatedResult = Transformers.transform(simpleEvent, [transformer])
                expect(repeatedResult).toStrictEqual(firstResult)
            }
        }
    })

    test('sample_event returns the same result for any percent subset', () => {
        // If a given path:value returns true starting at 0.30, then it should continue to return true for 0.31
        // through 1. Thusly, a selection of 30% of values in a field will be a subset of a selection of 60%,
        // and so on.

        // Create a field, up the % until we get a non-null result, then assert that it remains non-null (truthy)
        // from then on.
        for (let i = 0; i < 100; i++) {
            simpleEvent.propToSampleOffOf = Math.random()
            let hasBeenDefined = false
            for (let percent = 0; percent <= 1.01; percent += 0.01) {
                transformer.config = `{"sample": {"percent": ${percent}, "path": "propToSampleOffOf"}}`
                const result = Transformers.transform(simpleEvent, [transformer])
                if (hasBeenDefined) {
                    expect(result).toBeTruthy()
                } else {
                    if (result !== null) {
                        hasBeenDefined = true
                    }
                }
            }
        }
    })
})
