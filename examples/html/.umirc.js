
import path from 'path'

export default {
  plugins: [
    ['../../dist/index', {
      html: {
        commonChunks:{
            'common/base': path.resolve(__dirname,'./common/base.js')
        }
      },
      deepPageEntry:true
    }],
  ],
};
