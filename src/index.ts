import { IApi } from 'umi-plugin-types';
import { readdirSync, lstatSync } from 'fs';
import { join, extname, basename } from 'path';
import { cloneDeep, isPlainObject, flattenDeep } from 'lodash';
import px2rem from 'postcss-plugin-px2rem';
// 验证 JSON 结构和数据类型是否符合约定的规范
import AJV from 'ajv';
import schema from './schema';

const HTMLWebpackPlugin = require('html-webpack-plugin');
const assert = require('assert');
const deasyncPromise = require('deasync-promise');
// 用户与命令行交互的工具
const inquirer = require('inquirer');
// semver版本号判断
const semver = require('semver');

interface IOption {
  // 页面前缀 www.xxx.com/{prefixPath}/index.html , 作用：微前端，方便项目做 nginx 代理
  // 比如：/m/ 开头的代理 指定前端项目中
  prefixPath?: string;
  fastclick?: boolean; //暂未使用该变量，统一加入
  debugTool?: boolean; //暂未使用该变量，统一加入
  deepPageEntry?: boolean;
  splitChunks?: object | boolean;
  injectCheck?: Function; // html 和 js 的匹配规则
  pagesPath?: string; // 页面代码目录
  commonChunks?: IEntry[]; // 公共代码包
  selectEntry?: boolean | object;
  entry?: object;
  px2rem?: {
    rootValue: number | string;
  };
  html?: {
    template?: string;
  };
}

interface IEntry {
  [name: string]: string | string[];
}

// 默认的插件配置
const DEFAULT_OPTIONS: IOption = {
  pagesPath: '',
  prefixPath: '',
  debugTool: true,
  fastclick: true,
  deepPageEntry: true,
  splitChunks: true,
  px2rem: {
    rootValue: 16,
  },
  injectCheck: (html, js) => html === js, // 默认js会注入到同一目录下，同名的 pug/html 文件内
};

function getFiles(basePath: string, path: string, files: string[]) {
  return files.map(f => {
    const lstat = lstatSync(join(basePath, path, f));
    if (f.charAt(0) !== '.' && !f.startsWith('__') && lstat.isDirectory()) {
      const subDirFiles = readdirSync(join(basePath, path, f));
      return getFiles(basePath, join(path, f), subDirFiles);
    } else {
      return join(path, f);
    }
  });
}

/**
 * 从文件列表中，找出指定正则的文件，并处理成对象 entry 的形式
 * @param {string} pagesPath
 * @param {string[]} 文件列表 [dmeo.pug','demo.js','index.js','index.pug']
 * @param {RegExp} regex 匹配文件后缀的正则
 * @param {string} prefixPath 打包资源的路径前缀
 */
function getEntrys(
  pagesPath: string,
  allFiles: string[],
  regex: RegExp,
  prefixPath: string = '',
) {
  return allFiles
    .filter(
      f => basename(f).charAt(0) !== '.' && regex.test(extname(f)), // 过滤出指定正则的文件的文件
    )
    .reduce((memo, f) => {
      /**
       * ['demo/demo.jsx','index.jsx'] => 对象形式，方便作为 entry 入口
       * {
       *  'demo/demo':['demo/demo.js'],
       *  'index':['index.js'],
       * }
       */
      const name = f.replace(regex, '');
      memo[`${prefixPath}${name}`] = [join(pagesPath, f)];
      return memo;
    }, {});
}

export default function(api: IApi, options = {} as IOption) {
  const { log, paths } = api;

  // 如果 umi 升级到3.x，需要来校验一下，看是否兼容
  const umiVersion = process.env.UMI_VERSION;
  assert(
    semver.gte(umiVersion, '2.4.3') && semver.lt(umiVersion, '3.0.0'),
    `Your umi version is ${umiVersion}, >=2.4.3 and <3 is required.`,
  );

  // validate options with ajv
  // TODO:需要对所有属性进行校验，目前允许附加的属性
  const ajv = new AJV({ allErrors: true });
  const isValid = ajv.validate(schema, options);
  if (!isValid) {
    const errors = ajv.errors.map(({ dataPath, message }, index) => {
      return `${index + 1}. ${dataPath}${dataPath ? ' ' : ''}${message}`;
    });
    throw new Error(
      `
Invalid options applied to umi-plugin-mpa-pug

${errors.join('\n')}
`.trim(),
    );
  }

  if (!process.env.DISABLE_WARN) {
    log.warn(
      `
  [umi-plugin-mpa-pug] 使用 mpa 插件，意味着我们只使用 umi 作为构建工具。所以：

      1. 路由相关功能不工作
      2. global.css、global.js 无效
      3. app.js 无效
      4. 不支持 runtimePublicPath
      5. ...
    `.trim(),
    );
    console.log();
  }

  // 下面开始有用的代码，上面主要就是检测版本，校验配置，警告信息

  // don't generate html files
  process.env.HTML = 'none';
  // don't add route middleware
  process.env.ROUTE_MIDDLEWARE = 'none';

  const isDev = process.env.NODE_ENV === 'development';

  options = { ...DEFAULT_OPTIONS, ...options };

  // 提供一个假的 routes 配置，这样就不会走约定式路由，解析 src/pages 目录
  // https://umijs.org/zh/config/#routes
  api.modifyDefaultConfig(memo => {
    return { ...memo, routes: [] };
  });

  api.modifyWebpackConfig(webpackConfig => {
    // set entry
    const hmrScript = webpackConfig.entry['umi'][0];

    // 默认使用 pages 目录
    let pagesPath = paths.absPagesPath;
    if (options.pagesPath) {
      pagesPath = `${paths.absSrcPath}${options.pagesPath}`;
    }

    // 是否进入子目录生成路由
    const allFiles: string[] = options.deepPageEntry
      ? flattenDeep(getFiles(pagesPath, '', readdirSync(pagesPath)))
      : readdirSync(pagesPath);

    const htmlEntrys = getEntrys(
      pagesPath,
      allFiles,
      /\.(html|pug)$/,
      options.prefixPath,
    );
    let jsxEntrys = getEntrys(
      pagesPath,
      allFiles,
      /\.(j|t)sx$/,
      options.prefixPath,
    );
    const toolsEntry = {
      [`${options.prefixPath}tools`]: require.resolve(
        '../templates/tools/index.js',
      ),
    };

    // 注入工具包
    jsxEntrys = { ...toolsEntry, ...jsxEntrys };

    // 打包公共模块
    if (options.commonChunks) {
      jsxEntrys = { ...options.commonChunks, ...jsxEntrys };
    }

    // 如果未设置 entry，则自动匹配 pages 下的js 文件
    if (!options.entry) {
      log.info(
        `[umi-plugin-mpa-pug] options.entry is null, find files in ${pagesPath} for entry`,
      );
      webpackConfig.entry = jsxEntrys;
    } else {
      webpackConfig.entry = options.entry as IEntry;
    }

    // 支持选择部分 entry 以提升开发效率
    if (isDev && options.selectEntry) {
      const keys = Object.keys(webpackConfig.entry);
      if (keys.length > 1) {
        const selectedKeys = deasyncPromise(
          inquirer.prompt([
            Object.assign(
              {
                type: 'checkbox',
                message: 'Please select your entry pages',
                name: 'pages',
                choices: keys.map(v => ({
                  name: v,
                })),
                validate: v => {
                  return v.length >= 1 || 'Please choose at least one';
                },
                pageSize: 18,
              },
              isPlainObject(options.selectEntry) ? options.selectEntry : {},
            ),
          ]),
        );
        keys.forEach(key => {
          if (!selectedKeys.pages.includes(key)) {
            delete webpackConfig.entry[key];
          }
        });
      }
    }

    // 遍历 entry 增加热更新模块
    Object.keys(webpackConfig.entry).forEach(key => {
      const entry = webpackConfig.entry[key];
      webpackConfig.entry[key] = [
        // polyfill
        ...(process.env.BABEL_POLYFILL === 'none'
          ? []
          : [require.resolve(`../templates/polyfill.js`)]),
        // hmr
        ...(isDev && hmrScript.includes('webpackHotDevClient.js')
          ? [hmrScript]
          : []),
        // original entry
        ...(Array.isArray(entry) ? entry : [entry]),
      ];
    });

    // 遍历 html列表，生成 HTMLWebpackPlugin 插件配置
    Object.keys(htmlEntrys).forEach(key => {
      // html-webpack-plugin
      const config = {
        template: htmlEntrys[key][0],
        filename: `${key}.html`,
        chunksSortMode: 'manual',
        minify: {
          removeComments: true,
          collapseWhitespace: false,
        },
        chunks: [`${options.prefixPath}tools`],
        ...cloneDeep(options.html),
      };

      if (options.splitChunks === true) {
        // 使用默认的抽离公共包方式，并把该包注入到 html文件中
        config.chunks.push(`${options.prefixPath}vendors`);
      }
      // 注入公共库
      if (options.commonChunks) {
        for (let chunk in options.commonChunks) {
          config.chunks.push(chunk);
        }
      }
      // 遍历判断注入;
      for (let jsEntry in jsxEntrys) {
        if (options.injectCheck(key, jsEntry)) {
          config.chunks.push(jsEntry);
        }
      }

      webpackConfig.plugins.push(new HTMLWebpackPlugin(config));
    });

    // 开发环境，如果没有找到 index.html ，则展示 __index.html(页面列表清单) 当首页
    if (isDev) {
      let filename = 'index.html';
      if (Object.keys(webpackConfig.entry).includes('index')) {
        filename = '__index.html';
        const port = process.env.PORT || '8000';
        log.warn(
          `Since we already have index.html, checkout http://localhost:${port}/${filename} for entry list.`,
        );
      }

      webpackConfig.plugins.push(
        new HTMLWebpackPlugin({
          template: require.resolve('../templates/entryList.pug'),
          entries: Object.keys(htmlEntrys),
          filename,
          inject: false,
        }),
      );
    }

    // remove all the default aliases which umi-plugin-dev set
    // @see https://github.com/umijs/umi/blob/f74a7dcc3e6ee7cc4e685a0d47db8d37849cb0e0/packages/umi-build-dev/src/plugins/afwebpack-config.js#L67
    [
      'react',
      'react-dom',
      'react-router',
      'react-router-dom',
      'react-router-config',
      'history',
    ].forEach(lib => {
      delete webpackConfig.resolve.alias[lib];
    });

    return webpackConfig;
  });

  api.chainWebpackConfig(webpackConfig => {
    webpackConfig.module
      .rule('html')
      .test(/\.html?$/)
      .use('html-loader')
      .loader('html-loader')
      .options({
        name: '[name].[ext]',
      });

    // ejs模板不能继承
    // 因此增加 pug 版本的支持
    webpackConfig.module
      .rule('pug')
      .test(/\.pug?$/)
      .use('pug-loader')
      .loader('pug-loader')
      .options({
        name: '[name].html',
      });

    const { config } = api;
    if (!config.hash) {
      webpackConfig.output.chunkFilename(`[name].js`);
    }

    if (options.splitChunks) {
      webpackConfig.optimization.splitChunks(
        isPlainObject(options.splitChunks)
          ? options.splitChunks
          : {
              cacheGroups: {
                vendors: {
                  test: /(react|react-dom|core-js|regenerator-runtime)/,
                  name: `${options.prefixPath}vendors`,
                  chunks: 'all',
                },
              },
            },
      );
    }
  });

  api.modifyAFWebpackOpts(opts => {
    opts.urlLoaderExcludes = [
      ...(opts.urlLoaderExcludes || []),
      /\.html?$/,
      /\.pug?$/,
    ];

    // 增加 px 自动转 rem
    if (options.px2rem) {
      opts.extraPostCSSPlugins = [
        ...(opts.extraPostCSSPlugins || []),
        px2rem({
          rootValue: 16,
          ...(options.px2rem || {}),
        }),
      ];
    }

    return opts;
  });
}
