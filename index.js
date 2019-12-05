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
    constructor(options = { exclude: nonJsFiles }) {
        this._options = options;
    }

    apply(compiler) {
        compiler.hooks.compilation.tap(PLUGIN_NAME, compilationTap.bind(this));
    }
};

function compilationTap(compilation) {
    const libVar = compilation.outputOptions.library;
    const exclude = this._options.exclude;

    if (!libVar) {
        warn("output.library is expected to be set!");
    }

    if (
        compilation.outputOptions.libraryTarget &&
        compilation.outputOptions.libraryTarget !== "jsonp"
    ) {
        warn(`output.libraryTarget (${compilation.outputOptions.libraryTarget}) expected to be 'jsonp'!`);
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
                    source.replace(0, libVar.length, `Object.assign(${libVar},`);
                    compilation.assets[fileName] = source;
                });
            }
        });

        done();
    });
}
