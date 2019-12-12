
import path from 'path'

export default {
  plugins: [
    ['../../dist/index', {
      prefixPath:'m/',
      commonChunks:{
        'common/base': path.resolve(__dirname,'./common/base.js')
      },
      px2rem:{
        rootValue:16
      }
    }],
  ],
};
