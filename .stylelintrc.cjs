module.exports = {
  extends: ['stylelint-config-standard'],
  rules: {
    // Tailwind at-rules
    'at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: ['tailwind', 'apply', 'variants', 'screen', 'layer']
      }
    ]
  }
}
