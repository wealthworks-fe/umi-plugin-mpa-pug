import path from 'path';

export default {
  targets: {
    android: 4,
    ios: 8,
    ie: 9,
  },
  plugins: [
    [
      '../../dist/index',
      {
        prefixPath: 'm/',
        commonChunks: {
          'm/common/base': path.resolve(__dirname, './common/base.js'),
        },
        px2rem: {
          rootValue: 16,
        },
      },
    ],
  ],
};
