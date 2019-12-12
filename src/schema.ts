export default {
  type: 'object',
  additionalProperties: true,
  properties: {
    entry: {
      type: 'object',
    },
    deepPageEntry: {
      type: 'boolean',
    },
    splitChunks: {
      anyOf: [{ type: 'boolean' }, { type: 'object' }],
    },
    html: {
      type: 'object',
      properties: {
        template: {
          type: 'string',
          minLength: 1,
          pattern: '.pug$',
        },
      },
    },
    selectEntry: {
      anyOf: [{ type: 'boolean' }, { type: 'object' }],
    },
  },
};
