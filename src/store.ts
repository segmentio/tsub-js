import { TransformerConfig } from './transformers'

export interface Rule {
  scope: string
  target_type: string
  matchers: Matcher[]
  transformers: Transformer[][]
  destinationName?: string
}

export interface Matcher {
  type: string
  ir: string
}

export interface Transformer {
  type: string
  config?: TransformerConfig
}

export default class Store {
  private readonly rulesByDestination: { [key: string]: Rule[] } = {}
  private readonly globalRules: Rule[] = []

  constructor(rules: Rule[] = []) {
    // Initialize the maps
    for (const rule of rules) {
      // Rules with no destinationName are global (workspace || workspace::source)
      if (rule.destinationName !== undefined) {
        if (this.rulesByDestination[rule.destinationName] === undefined) {
          this.rulesByDestination[rule.destinationName] = []
        }

        this.rulesByDestination[rule.destinationName].push(rule)
      } else {
        this.globalRules.push(rule)
      }
    }
  }

  public getRulesByDestinationName(destinationName: string): Rule[] {
    const rules: Rule[] = [...this.globalRules]

    const destinationRules = this.rulesByDestination[destinationName]
    if (destinationRules !== undefined && destinationRules.length > 0) {
      rules.push(...destinationRules)
    }

    return rules
  }
}
