import path from 'path';

export default {
  alias: {
    '@package': path.resolve(__dirname, 'package'),
  },
  plugins: [
    [
      '../dist/index',
      {
        selectEntry: true,
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
