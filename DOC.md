# umi-plugin-mpa-pug

该插件 Fork [umi-plugin-mpa](https://github.com/umijs/umi-plugin-mpa) 仓库，做了一下几点的修改

- ✔︎ ejs 模板改成 pug 模板
- ✔︎ 去掉默认模板的使用
- ✔︎ 支持只有 html 文件，没有 js 文件，生成页面

## WHY

1. ejs 不支持模板继承的功能，因此替换成功能更强的 pug 模板

   > 使用场景：react 页面，在加载 JS 的时候，增加一个 Loading 效果

2. 为了支持一些简单的页面，只有 html，没有 js。 因此生成的页面，是遍历 pug/html 列表生成，而不是遍历 entry 入口生成。

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
