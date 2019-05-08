// import stuff

export interface Rule {
    id: string
    scope: string
    target: Target
    matcher: Matcher
    transformers: Transformer[]
    name: string
    description: string
    priority: number
    enabled: boolean
    createdAt: Date
    updatedAt: Date
}

export interface Target {
    label: string
    id: string
}

export interface Matcher {
    type: string
    config: string // TODO: JSON IR representation
}

export interface Transformer {
    type: string
    config: string
}

export class Store {
    private readonly rules = {}

    constructor(rules?: Rule[]) {
        if (rules) {
            for (const rule of rules) {
                this.rules[rule.id] = rule
            }
        }
    }

    public getRulesByTargets(scope: Rule['scope'], targets: Array<Rule['target']>): Rule[] {
        const rules: Rule[] = []
        for (const target of targets) {
            for (const id in this.rules) {
                if (!this.rules.hasOwnProperty(id)) {
                    continue
                }

                const rule = this.rules[id]
                if (rule.scope === scope && rule.target.id === target.id && rule.target.label === target.label) {
                    rules.push(rule)
                }
            }
        }

        return rules.sort(sortRules)
    }
}

function sortRules(a: Rule, b: Rule): number {
    // First: Rules with higher priority always go first.
    if (a.priority !== b.priority) {
        return a.priority - b.priority
    }

    // Next: Rules without transforms go last.
    if (a.transformers.length === 0) {
        return -1
    } else if (b.transformers.length === 0) {
        return 1
    }

    // Next: Rules with 'preferential' transforms go first.
    const aType = a.transformers[0].type
    const bType = b.transformers[0].type
    if (aType !== bType) {
        // Lowest priority -> Highest priority (not in array = lowest priority, -1)
        const transformPriority = ['whitelist_fields', 'blacklist_fields', 'drop_event']
        return transformPriority.indexOf(aType) - transformPriority.indexOf(bType)
    }

    // Finally, sort by created timestamp.
    return a.createdAt.getTime() - b.createdAt.getTime()
}
