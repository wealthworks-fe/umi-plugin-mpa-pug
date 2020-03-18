# 插件升级

> 2020-03-18 12:02:30

开发插件的时候，umi 处于 2.x 版本，此时升级到了 umi3.x， 修改了很多东西，插件的形式也修改了，因此 2.x 版本的插件，在 3.x 版本中无法使用。

## 该插件从 umi2.x 升级到 umi3.x 改动了什么？

### 1、 插件的参数配置 和 插件获取参数的方式变动

把插件配置参数拍平了

```js
plugins: ['../dist/index'],
mpaPug: {
  selectEntry: true,
  prefixPath: 'm/',
  commonChunks: {
    'm/common/base': path.resolve(__dirname, './common/base.js'),
  },
  px2rem: {
    rootValue: 16,
  },
},
```

插件中要获取参数，必须在这里增加校验，否则获取参数会报错。

```js
// 必须对插件插件参数进行校验，否则无法获取参数，会报 Validate config "mpaPug" failed
api.describe({
  key: 'mpaPug',
  config: {
    default: DEFAULT_OPTIONS,
    schema(joi) {
      return joi.object({
        entry: joi.object(),
        pagesPath: joi.string(),
        prefixPath: joi.string(),
        deepPageEntry: joi.boolean(),
        splitChunks: joi.boolean(),
        px2rem: joi.object(),
        injectCheck: joi.function(),
        selectEntry: joi.boolean(),
        commonChunks: joi.object(),
        html: joi.object(),
      });
    },
  },
});
```

### 2、钩子函数变动

umi2.x 修改 webpack 配置的钩子函数和 umi3，函数名变化了。

`modifyWebpackConfig` => `modifyBundleConfig`

> webpack 的名称，很多变成了 bundle， 具体需要看 umi3.x 文档，目前还不是很完善。
