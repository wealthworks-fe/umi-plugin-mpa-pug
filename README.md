# umi-plugin-mpa-pug

该插件 Fork [umi-plugin-mpa](https://github.com/umijs/umi-plugin-mpa) 仓库，做了一下几点的修改，以便无缝迁移项目用。

- ✔︎ ejs 模板改成 pug 模板
- ✔︎ 去掉默认模板的功能
- ✔︎ 支持只有 html 文件，没有 js 文件，生成页面

## Why

1. ejs 不支持模板继承的功能，因此替换成功能更强的 pug 模板

   > 使用场景：react 页面，在加载 JS 的时候，增加一个 Loading 效果

2. 为了支持一些简单的页面，只有 html，没有 js。 因此生成的页面，是遍历 pug/html 列表生成，而不是遍历 entry 入口生成。

3. mpa 页面不支持 umi-plugin-react 的 fastclick 功能

   > 因为 fastclick 是放在 umi.js 下，单页面并不会去引用打包该文件，因此 fastclick 就算是开启了，也没用引入到文件中。

## Installation

```bash
$ yarn add umi-plugin-mpa-pug
```

## Usage

Config it in `.umirc.js` or `config/config.js`,

```js
export default {
  plugins: ['umi-plugin-mpa-pug'],
};
```

with options,

```js
export default {
  plugins: [['umi-plugin-mpa-pug', options]],
};
```

## Features

1. 约定 index.jsx 文件，会作为 webpack 入口文件被打包，避免把组件也打包出一个 js 文件

2. 支持给每个页面注入公共代码

   > 比如数据打点，错误统计，一些所有页面都需要的通用逻辑，比如再微信内，都默认静默授权

3. 自定义 JS 文件注入到 HTML 中的规则

   > 默认是 **同一目录下，同名文件则注入**
   >
   > 只是在自定义注入方法

   ```js
   {
     html: {},
     // 返回 html 和 js 的路径
     injectCheck:(html,js)=>{
       return html === js  // 默认 同一目录，同名文件
     }
   }

   ```

4. 给所有页面增加公共代码

   ```js
   {
     html: {
       commonChunks:{
           'common/base': path.resolve(__dirname,'./common/base.js')
       }
     },
   }
   ```

> 最终效果，类似这样
>
> ![](https://guihua-static.licaigc.com/2019-12-11-073722.png)

## Options

> 不建议使用的 Options 项，是因为该插件还没有去适配这块的内容，不知道是否可行。如果非要使用的话，建议先使用 [umi-plugin-mpa]

### pagesPath

页面代码的路径，如果配置，则会从该目录去自动寻找 jsx 文件为 entry 入口，并找到目录下所有 pug /html 生成 html 文件。

- Type : `string`
- Default : `pages`

> 默认会寻找 pages 目录下的所有 jsx /tsx 文件，作为 entry 入口

### html

配置给 [html-webpack-plugin](https://github.com/jantimon/html-webpack-plugin) 的配置，用于为每个 entry 自动生成 html 文件。

- Type: `Object`
- Default: `null`

如有配置，则会基于以下默认值进行覆盖，

```js
{
  template,
  filename: `${page}.html`,
  chunks: [page]
}
```

其中，

- 如果有一个和 entry 文件同目录同文件名但后缀为 `.pug` 的文件，则会用次文件作为其 template，且优先级最高
- entry 和 pug 模板匹配的规则可以通过 `injectCheck` 函数来判断，如果匹配上，则会把 entry 生成的 js 文件注入到 pug 中

更多配置方式，详见 https://github.com/jantimon/html-webpack-plugin#options 。

### injectCheck

entry 注入到 pug /html 文件的规则

- Type：Function
- Default ：((_html_, _js_) _=>_ html === js)

html，js 表示 分别得路径和文件名（不包含后缀）

### deepPageEntry

在自动查找 `src/pages` 下的 js 或 ts 文件为 entry 时，是否进入子目录查找

- Type: `Boolean`
- Default: `false`

注：会跳过以 `__` 或 `.` 开头的目录

### entry【暂建议默认】

指定 webpack 的 [entry](https://webpack.js.org/configuration/entry-context/#entry) 。

- Type: `Object`
- Default: `null`

如果没有设置 entry，会自动查找 `src/pages` 下的 js 或 ts 文件为 entry 。

entry 项的值如果是数组且最后一个是对象时，会作为此 entry 的额外配置项。

entry 的额外配置项目前支持：

#### context

如果有配 `html` 时会作为 html 的模板内容。

比如：

```js
{
  entry: {
    foo: [
      './src/foo.js',
      {
        context: { title: '首页' }
      },
    ],
  },
  html: {},
}
```

然后在 html 模板里可以通过 `htmlWebpackPlugin.options` 使用通过 `context` 指定的配置项，

```html
<title><%= htmlWebpackPlugin.options.title %></title>
```

### htmlName [暂建议默认]

指定 import 生成的 html 文件的文件名。

- Type: `String`
- Default: `[name].[ext]`

可以用 `[name]`、`[path]`、`[hash]` 和 `[ext]`，详见 https://github.com/webpack-contrib/file-loader 。

### splitChunks [暂建议默认]

配置 webpack 的 splitChunks，用于提取 common 或 vendors 等。

- Type: `Boolean | Object`
- Default: false

如果值为 `true`，等于配置了 `{ chunks: 'all', name: 'vendors', minChunks: 2 }`，并且 html 的 chunks 会配置为 `["vendors", "<%= page %>"]`，详见 https://webpack.js.org/plugins/split-chunks-plugin/ 。

比如只要包含 node_modules 下的公共部分，可以这样配：

```js
{
  splitChunks: {
    cacheGroups: {
      vendors: {
        chunks: 'all',
        minChunks: 2,
        name: 'vendors',
        test: /[\\/]node_modules[\\/]/,
      },
    },
  },
  html: {
    chunks: ['vendors', '<%= page %>'],
  },
}
```

### selectEntry [暂建议默认]

是否开启 entry 选择，以提升开发效率。

- Type: `Boolean | Object`
- Default: `false`

注：

1. 值为 Object 时会用于覆盖默认的 inquirer 配置，详见https://github.com/SBoudrias/Inquirer.js#question
2. 适用于 entry 量大的项目，只在 dev 时开启
3. 由于使用了 deasync-promise，所以在入口选择界面上按 Ctrl+C 退出会失败，且进程清理不干净。这时需手动强制退出相关 node 进程。
