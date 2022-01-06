const ReplaceSource = require('webpack-sources').ReplaceSource;
const PLUGIN_NAME = 'LibraryExtendWebpackPlugin';
const warn = (msg) => console.warn(`\u001b[33m[${PLUGIN_NAME}] ${msg}\u001b[39m`);
const error = (msg) => {
    console.error(`\u001b[31mERROR: [${PLUGIN_NAME}] ${msg}\u001b[39m`);
    throw new Error(msg);
};
const IS_JS_FILE = /\.[tj]sx?$/i;
const nonJsFiles = (fileName) => !IS_JS_FILE.test(fileName);

/**
 * A webpack plugin that changes the output to an extended library
 * and add it to an existing global library.
 */
module.exports = class LibraryExtendWebpackPlugin {
    /**
     *
     * @param {Object} [options]
     * @param {Function} [options.exclude]
     *  A callback function to evaluate each output file name and determine if it should be
     *  excluded from being wrapped with Object.assign global variable. By default, all files whose
     *  file extension is not `.jsx?` or `.tsx?` will be excluded.
     *  The provided callback will receive two input arguments:
     *  -   `{String} fileName`: the file name being evaluated
     *  -   `{Chunk} chunk`: the webpack `chunk` being worked on.
     * @param {Boolean} [options.polyfill]
     * @param {String: 'warn' | 'error'} [options.promptType]
     */
    constructor(options = {}) {
        this._options = Object.assign(
            {
                exclude: nonJsFiles,
                polyfill: false,
                promptType: 'warn', // warn || error
            },
            options
        );
    }

    apply(compiler) {
        compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
            if (!this.checkConfig(compilation)) {
                return;
            }

            const exclude = this._options.exclude || nonJsFiles;
            const libVar = compilation.outputOptions.library.name || compilation.outputOptions.library;

            let polyfillStr = '';
            if (this._options.polyfill) {
                polyfillStr = `if (typeof Object.assign !== 'function') {
  // Must be writable: true, enumerable: false, configurable: true
  Object.defineProperty(Object, "assign", {
    value: function assign(target, varArgs) { // .length of function is 2
      'use strict';
      if (target === null || target === undefined) {
        throw new TypeError('Cannot convert undefined or null to object');
      }

      var to = Object(target);
  
      for (var index = 1; index < arguments.length; index++) {
        var nextSource = arguments[index];
  
        if (nextSource !== null && nextSource !== undefined) { 
          for (var nextKey in nextSource) {
            // Avoid bugs when hasOwnProperty is shadowed
            if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
              to[nextKey] = nextSource[nextKey];
            }
          }
        }
      }
      return to;
    },
    writable: true,
    configurable: true
  });
};
`;
            }

            compilation.hooks.processAssets.tapAsync(
                { name: PLUGIN_NAME, stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS },
                (assets, done) => {
                    const libraryTarget = compilation.outputOptions.library.type;
                    for (const chunk of compilation.chunks) {
                        if (!chunk.canBeInitial()) {
                            continue;
                        }

                        for (const file of chunk.files) {
                            if (exclude && exclude(file)) {
                                continue;
                            }

                            console.log(`[${PLUGIN_NAME}] Add extend to file: `, file);

                            compilation.updateAsset(file, (originalSource) => {
                                let source = new ReplaceSource(originalSource);
                                if (libraryTarget === 'var') {
                                    // Insert `)` before `;` at the end of source
                                    source.insert(source.source().length - 1, ')');
                                    // Replace `var ${libVar} =` to `Object.assign(${libVar},`
                                    source.replace(0, libVar.length + 5, `${polyfillStr}Object.assign(${libVar},`);
                                } else if (libraryTarget === 'umd') {
                                    replaceUmdSource(source, originalSource, libVar);
                                    if (polyfillStr) {
                                        source.replace(0, -1, polyfillStr);
                                    }
                                } else {
                                    // Replace `${libVar}(` to `Object.assign(${libVar},`
                                    source.replace(0, libVar.length, `${polyfillStr}Object.assign(${libVar},`);
                                }
                                return source;
                            });
                        }
                    }

                    done();
                }
            );
        });
    }

    prompt(msg) {
        const { promptType } = this._options;
        const logFuc = promptType === 'error' ? error : warn;
        logFuc(msg);
    }

    checkConfig(compilation) {
        const libVar = compilation.outputOptions.library;
        if (!libVar) {
            this.prompt('output.library is expected to be set!');
            return false;
        }

        const libraryTarget = compilation.outputOptions.library.type;
        if (libraryTarget && libraryTarget !== 'var' && libraryTarget !== 'umd' && libraryTarget !== 'jsonp') {
            this.prompt(`output.library.type (${libraryTarget}) expected to be 'var' or 'umd' or 'jsonp'!`);
            return false;
        }

        const libName = compilation.outputOptions.library.name || compilation.outputOptions.library;
        if (!libName || typeof libName !== 'string') {
            this.prompt(`output.library.name (${libName}) is expected to be set!`);
            return false;
        }

        return true;
    }
};

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function replaceUmdSource(replaceSource, originalSource, libVar) {
    const sourceCode = originalSource.source();
    const searchStr = `root["${libVar}"]`;
    let startIndex = sourceCode.indexOf(searchStr);
    if (startIndex < 0) {
        warn('cannot find the string to replace!');
        return;
    }

    const replaceStrRegExp = new RegExp(`${escapeRegExp(searchStr)}(\\s*=\\s*([^;]+))`);
    const matchReplace = sourceCode.match(replaceStrRegExp);
    if (!matchReplace) {
        warn('cannot find the string to replace!');
        return;
    }
    const length = matchReplace[0].length;
    const replaceString = `!${searchStr} && (${searchStr} = {}), Object.assign(${searchStr}, ${matchReplace[2]})`;
    replaceSource.replace(startIndex, startIndex + length - 1, replaceString);
}
