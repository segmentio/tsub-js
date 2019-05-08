import { Matcher } from './store'

export interface FQL {
    // TODO: Input IR format here
    dummy: boolean
}

export function matches(matcher: Matcher): boolean | Error {
    switch (matcher.type) {
        case 'all':
            return all()
        case 'fql':
            return fql(matcher.config)
        default:
            return new Error(`Matcher of type ${matcher.type} unsupported.`)
    }
}

function all(): boolean {
    return true
}

function fql(config: Matcher['config']): boolean | Error {
    let expr: FQL
    try {
        expr = JSON.parse(config)
    } catch (e) {
        return new Error(`Failed to JSON.parse FQL intermediate representation "${config}": ${e}`)
    }

    fqlEvaluate(expr)
}

function fqlEvaluate(expr): Error {
    // TODO: Parse the FQL IR depending on API/spec from Tyson & Jeremy
    return new Error(`Not implemented: ${expr}`)
}