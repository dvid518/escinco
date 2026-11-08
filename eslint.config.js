import globals from "globals"

export default [
  {
    ignores: [
      "node_modules/",
      "dist/",
      "coverage/",
      "tests/fixtures/",
      "*.md",
      // Librerías vendorizadas y minificadas: no las mantenemos nosotros.
      "js/lib/",
      // Código de experimentos y de la demo: no forma parte de la app desplegada.
      "experimentos/",
      "firebase/demo/"
    ]
  },
  {
    files: ["**/*.{js,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        // SortableJS se carga como UMD desde js/lib/sortable.min.js.
        Sortable: "readonly"
      }
    },
    rules: {
      // Solo reglas de corrección (no estilo de formateo)
      "no-console": ["error", { allow: ["info", "warn", "error"] }],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-undef": "error",
      "no-unreachable": "error",
      "no-unsafe-finally": "error",
      "no-unsafe-negation": "error",
      "require-await": "error",
      "no-redeclare": "error",
      "no-shadow": "error",
      "no-undef-init": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-use-before-define": ["error", { functions: false, classes: false }],
      "prefer-const": "error",
      "no-var": "error",
      "no-dupe-keys": "error",
      "no-duplicate-case": "error",
      "no-empty-character-class": "error",
      "no-empty-pattern": "error",
      "no-ex-assign": "error",
      "no-extend-native": "error",
      "no-extra-boolean-cast": "error",
      "no-fallthrough": "error",
      "no-func-assign": "error",
      "no-global-assign": "error",
      "no-invalid-this": "error",
      "no-label-var": "error",
      "no-labels": "error",
      "no-lone-blocks": "error",
      "no-new": "error",
      "no-new-object": "error",
      "no-new-symbol": "error",
      "no-new-wrappers": "error",
      "no-obj-calls": "error",
      "no-octal": "error",
      "no-proto": "error",
      "no-prototype-builtins": "error",
      "no-self-assign": "error",
      "no-self-compare": "error",
      "no-sequences": "error",
      "no-template-curly-in-string": "error",
      "no-this-before-super": "error",
      "no-throw-literal": "error",
      "no-unexpected-multiline": "error",
      "no-unmodified-loop-condition": "error",
      "no-unneeded-ternary": "error",
      "no-unused-expressions": "error",
      "no-useless-call": "error",
      "no-useless-catch": "error",
      "no-useless-computed-key": "error",
      "no-useless-concat": "error",
      "no-useless-constructor": "error",
      "no-useless-escape": "error",
      "no-useless-rename": "error",
      "no-useless-return": "error",
      "no-void": "error",
      "no-with": "error",
      "radix": "error",
      "strict": ["error", "never"],
      "symbol-description": "error",
      "use-isnan": "error",
      "valid-typeof": "error",
      "vars-on-top": "error",
      "yoda": "error"
    }
  },
  {
    // La suite y las herramientas de CLI imprimen su resultado por consola, y
    // definen dobles `async` sin `await` porque imitan APIs asíncronas reales.
    files: ["tests/**/*.{js,mjs}", "tools/**/*.{js,mjs}"],
    rules: {
      "no-console": "off",
      "require-await": "off"
    }
  },
  {
    // Los tests evalúan fragmentos del código fuente con `new Function`/`eval`
    // a propósito (cargan un módulo y extraen una función concreta).
    files: ["tests/**/*.mjs"],
    rules: {
      "no-new-func": "off",
      "no-eval": "off"
    }
  }
]
