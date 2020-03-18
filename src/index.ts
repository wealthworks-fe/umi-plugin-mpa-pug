import { IApi } from 'umi';
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
inquirer.registerPrompt(
  'checkbox-plus',
  require('inquirer-checkbox-plus-prompt'),
);
// semver版本号判断
const semver = require('semver');

interface IOption {
  // 页面前缀 www.xxx.com/{prefixPath}/index.html , 作用：微前端，方便项目做 nginx 代理
  // 比如：/m/ 开头的代理 指定前端项目中
  prefixPath?: string;
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
  deepPageEntry: true,
  splitChunks: true,
  px2rem: {
    rootValue: 16,
  },
  injectCheck: (html, js) => html === js, // 默认js会注入到同一目录下，同名的 pug/html 文件内
};

// .umirc 的默认配置
// 避免项目忘记配置，导致兼容性问题
const DEFAULT_UMI_CONFIG = {
  hash: true, // 生成的文件名加上 hash
  disableCSSModules: true, // 不使用 CSS Module 否则需要改代码
  treeShaking: true,
  targets: {
    browsers: [
      'last 2 versions',
      'Firefox ESR',
      '> 1%',
      'ie >= 9',
      'iOS >= 8',
      'Android >= 4',
    ],
  },
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

export default function(api: IApi) {
  let { logger, paths } = api;

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

  let options = api.service.userConfig.mpaPug || {};

  // 如果 umi 升级到3.x，需要来校验一下，看是否兼容
  const umiVersion = process.env.UMI_VERSION;

  assert(
    semver.gte(umiVersion, '3.0.0') && semver.lt(umiVersion, '4.0.0'),
    `Your umi version is ${umiVersion}, >=3.0.0 and <4.0.0 is required.`,
  );

  // validate options with ajv
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
    logger.warn(
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

  // 修改 umi 默认配置
  // 提供一个假的 routes 配置，这样就不会走约定式路由，解析 src/pages 目录
  // https://umijs.org/zh/config/#routes
  api.modifyDefaultConfig((memo: any) => {
    return { ...memo, routes: [] };
  });

  // 修改 umi 默认配置
  api.modifyDefaultConfig((memo: any) => {
    return { ...DEFAULT_UMI_CONFIG, ...memo };
  });

  // 遍历文件找到页面入口，注入到 webpack 中
  api.modifyBundleConfig(webpackConfig => {
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

    // 如果未设置 entry，则自动匹配 pages 下的js 文件
    if (!options.entry) {
      logger.info(
        `[umi-plugin-mpa-pug] options.entry is null, find files in ${pagesPath} for entry`,
      );
      webpackConfig.entry = jsxEntrys;
    } else {
      webpackConfig.entry = options.entry as IEntry;
    }

    // 支持选择部分  htmlEntry 以提升开发效率
    if (isDev && options.selectEntry) {
      logger.warn(
        `[注意，注意，注意] 如需 Ctrl+C 退出，请先选择完入口在退出，否则会造成 Node 进程无法自动关闭，占用内存!!`,
      );
      const keys = Object.keys(htmlEntrys);
      if (keys.length > 1) {
        // 在选择部分页面的时候，Ctrl+C 关闭控制台，node 进程不会被关闭
        // 选择完页面后，再 Ctrl+C 退出，则不会有问题
        const selectedKeys = deasyncPromise(
          inquirer.prompt([
            Object.assign(
              {
                type: 'checkbox-plus',
                message: 'Please select your entry pages [support filter]：',
                name: 'pages',
                highlight: true,
                searchable: true,
                choices: keys.map(v => ({
                  name: v,
                })),
                validate: v => {
                  return v.length >= 1 || 'Please choose at least one';
                },
                source: function(answersSoFar, input) {
                  return new Promise(resolve => {
                    let currentEntry = keys.filter(
                      item => item.toLowerCase().indexOf(input || '') !== -1,
                    );
                    resolve(currentEntry);
                  });
                },
                pageSize: 18,
              },
              isPlainObject(options.selectEntry) ? options.selectEntry : {},
            ),
          ]),
        );

        Object.keys(webpackConfig.entry).forEach(key => {
          if (!selectedKeys.pages.includes(key)) {
            delete webpackConfig.entry[key];
          }
        });
        Object.keys(htmlEntrys).forEach(key => {
          if (!selectedKeys.pages.includes(key)) {
            delete htmlEntrys[key];
          }
        });
      }
    }

    // 注入工具包(uuid,debug,fastclick), 注入公共模块
    let otherEntrys: any = {
      [`${options.prefixPath}tools`]: require.resolve(
        '../templates/tools/index.js',
      ),
    };
    if (options.commonChunks) {
      otherEntrys = { ...otherEntrys, ...options.commonChunks };
    }
    webpackConfig.entry = { ...otherEntrys, ...webpackConfig.entry };

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
      if (Object.keys(htmlEntrys).includes('index')) {
        filename = '__index.html';
        const port = process.env.PORT || '8000';
        logger.warn(
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

  // 添加 html-loader 和 pug-loader
  api.chainWebpack(webpackConfig => {
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

    // https://github.com/umijs/umi/blob/659f6314d4b3a5942664a44f10bb6c85c3824fb4/packages/af-webpack/src/getWebpackConfig/index.js#L111
    // 静态资源在非根目录或 cdn
    // 由于 umi 中，处理图片、字体、音频等资源都放到 /static 目录下
    // 因为目前项目 nginx 代理的时候，把 /mobile/ 开头的请求 => 代理到前端web服务
    // 而图片资源却是类似 /staitc/loggero.png ，不是 mobile 开头的请求，导致找不到图片
    // 后面研究加 base 或者 publicPath 是否可以解决
    if (options.prefixPath) {
      webpackConfig.module
        .rule('images')
        .use('url-loader')
        .tap(oldOptions => {
          return { ...oldOptions, outputPath: options.prefixPath };
        });

      webpackConfig.module
        .rule('svg')
        .use('file-loader')
        .tap(oldOptions => {
          return { ...oldOptions, outputPath: options.prefixPath };
        });

      webpackConfig.module
        .rule('fonts')
        .use('file-loader')
        .tap(oldOptions => {
          return { ...oldOptions, outputPath: options.prefixPath };
        });
    }

    if (!api.config.hash) {
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
                default: false,
              },
            },
      );
    }

    return webpackConfig;
  });

  // 添加 rem，添加 urlloader
  api.modifyBundleConfigOpts(opts => {
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
