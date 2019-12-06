const ReplaceSource = require("webpack-sources").ReplaceSource;
const PLUGIN_NAME = "LibraryExtendWebpackPlugin";
const warn = msg => console.warn(`[${PLUGIN_NAME}] ${msg}`);
const IS_JS_FILE = /\.[tj]sx?$/i;
const nonJsFiles = fileName => !IS_JS_FILE.test(fileName);

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
     *  excluded from being wrapped with ESM exports. By default, all files whose
     *  file extension is not `.jsx?` or `.tsx?` will be excluded.
     *  The provided callback will receive two input arguments:
     *  -   `{String} fileName`: the file name being evaluated
     *  -   `{Chunk} chunk`: the webpack `chunk` being worked on.
     */
    constructor(options = { exclude: nonJsFiles, polyfill: false }) {
        this._options = options;
    }

    apply(compiler) {
        compiler.hooks.compilation.tap(PLUGIN_NAME, compilationTap.bind(this));
    }
};

function compilationTap(compilation) {
    const libVar = compilation.outputOptions.library;
    const exclude = this._options.exclude || nonJsFiles;

    if (!libVar) {
        warn("output.library is expected to be set!");
    }

    if (
        compilation.outputOptions.libraryTarget &&
        compilation.outputOptions.libraryTarget !== "jsonp"
    ) {
        warn(`output.libraryTarget (${compilation.outputOptions.libraryTarget}) expected to be 'jsonp'!`);
    }

    let polyfillStr = '';
    if(this._options.polyfill) {
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

    compilation.hooks.optimizeChunkAssets.tapAsync(PLUGIN_NAME, (chunks, done) => {
        chunks.forEach(chunk => {
            if (chunk.entryModule && chunk.entryModule.buildMeta.providedExports) {
                chunk.files.forEach(fileName => {
                    if (exclude && exclude(fileName, chunk)) {
                        return;
                    }

                    // Replace `${libVar}(` to `Object.assign(${libVar},`
                    // and add that file back to the compilation
                    let source = new ReplaceSource(compilation.assets[fileName]);
                    source.replace(0, libVar.length, `${polyfillStr}Object.assign(${libVar},`);
                    compilation.assets[fileName] = source;
                });
            }
        });

        done();
    });
}
