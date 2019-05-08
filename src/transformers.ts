import { Transformer } from './store'
import * as MD5 from 'crypto-js/md5'
import * as ldexp from 'math-float64-ldexp'

export interface TransformerConfig {
    drop: Map<string, string[]>
    sample: TransformerConfigSample
}

export interface TransformerConfigSample {
    percent: number
    path: string
}

export function transform(payload: any, transformers: Transformer[]): any {
    const transformedPayload: any = payload

    for (const transformer of transformers) {
        let config: TransformerConfig
        try {
            config = JSON.parse(transformer.config)
        } catch (e) {
            return new Error(`Failed to JSON.parse transformer config "${transformer.config}": ${e}`)
        }

        switch (transformer.type) {
            case 'drop':
                return null
            case 'drop_properties':
                dropProperties(transformedPayload, config)
                break
            case 'allow_properties':
                allowProperties(transformedPayload, config)
                break
            case 'sample_event':
                if (sampleEvent(transformedPayload, config)) {
                    break
                }
                return null
            default:
                return new Error(`Transformer of type "${transformer.type}" is unsupported.`)
        }
    }

    return transformedPayload
}

// dropProperties removes all specified props from the object.
function dropProperties(payload: any, config: TransformerConfig) {
    for (const key in config.drop) {
        if (!config.drop.hasOwnProperty(key)) {
            continue
        }

        const field = getFieldFromKey(payload, key)
        if (typeof field !== 'object' || field === null) {
            continue
        }

        for (const target of config.drop[key]) {
            delete field[target]
        }
    }
}

// allowProperties ONLY allows the specific targets within the keys. (e.g. "a.foo": ["bar", "baz"]
// on {a: {foo: {bar: 1, baz: 2}, other: 3}} will not have any drops, as it only looks inside a.foo
function allowProperties(payload: any, config: TransformerConfig) {
    for (const key in config.drop) {
        if (!config.drop.hasOwnProperty(key)) {
            continue
        }

        const field = getFieldFromKey(payload, key)
        if (typeof field !== 'object' || field === null) {
            continue
        }

        // Execution order fortunately doesn't really matter (e.g. if someone filtered off of foo.bar, then foo.bar.baz)
        // except for micro-optimization.
        for (const k in field) {
            if (!field.hasOwnProperty(k)) {
                continue
            }

            if (config.drop[key].indexOf(k) !== -1) {
                delete field[k]
            }
        }
    }
}

function sampleEvent(payload: any, config: TransformerConfig): boolean {
    if (config.sample.percent <= 0) {
        return false
    } else if (config.sample.percent >= 1) {
        return true
    }

    // If we're not filtering deterministically, just use raw percentage.
    if (!config.sample.path) {
        return samplePercent(config.sample.percent)
    }

    // Otherwise, use a deterministic hash.
    return sampleConsistentPercent(payload, config)
}

function samplePercent(percent: number): boolean {
    // Math.random returns [0, 1) => 0.0<>0.9999...
    return Math.random() <= percent
}

// sampleConsistentPercent converts an input string of bytes into a consistent uniform
// continuous distribution of [0.0, 1.0]. This is based on
// http://mumble.net/~campbell/tmp/random_real.c, but using the digest
// result of the input value as the random information.

// IMPORTANT - This function needs to === the Golang implementation to ensure that the two return the same vals!
// See: https://github.com/segmentio/sampler/blob/65cb04132305a04fcd4bcaef67d57fbe40c30241/sampler.go#L13-L38

// Since AJS supports IE9+ (typed arrays were introduced in IE10) we're doing some manual array math.
function sampleConsistentPercent(payload: any, config: TransformerConfig): boolean {
    const field = getFieldFromKey(payload, config.sample.path)
    const digest: number[] = MD5(JSON.stringify(field))
    let exponent = -64

    // Manually maintain 64-bit int as an array.
    let significand: number[] = []

    // Left-shift and OR for first 8 bytes of digest. (8 bytes * 8 = 64 bits)
    consumeDigest(digest.slice(0, 8), significand)

    let leadingZeros = 0
    for (let i = 0; i < 64; i++) {
        if (significand[i] === 1) {
            break
        }

        leadingZeros++
    }

    if (leadingZeros !== 0) {
        // Use the last 8 bytes of the digest, same as before.
        const val: number[] = []
        consumeDigest(digest.slice(9, 16), val)

        exponent -= leadingZeros
        // Left-shift away leading zeros in significand.
        significand.splice(0, leadingZeros)

        // Right-shift val by 64 minus leading zeros and push into significand.
        significand = significand.concat(val.splice(64 - leadingZeros))
    }

    // Flip 64th bit
    significand[63] = significand[63] === 0 ? 1 : 0

    // Convert our manual binary into a JS num (binary arr => binary string => psuedo-int) and run the ldexp!
    return ldexp(parseInt(significand.join(''), 2), exponent) < config.sample.percent
}

// Array byte filler helper
function consumeDigest(digest: number[], arr: number[]) {
    for (let i = 0; i < 8; i++) {
        let remainder = digest[i]
        for (let binary = 128; binary >= 1; binary /= 2) {
            if (remainder - binary >= 0) {
                remainder -= binary
                arr.push(1)
            } else {
                arr.push(0)
            }
        }
    }
}

// Keys in destination filters are split by periods (other incidental periods are not allowed)
function getFieldFromKey(payload: any, key: string): any {
    const splitKey = key.split('.')
    let val = payload
    for (const k of splitKey) {
        val = val[k]
    }

    return val
}

