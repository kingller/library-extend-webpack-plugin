# library-extend-webpack-plugin
A webpack plugin that changes the output to an extended library and add it to an existing global library.

## Install

```bash
npm i -D library-extend-webpack-plugin
``` 

## Usage

In your webpack configuration (`webpack.config.js`):

```javascript
const LibraryExtendWebpackPlugin = require("library-extend-webpack-plugin");

module.exports = {
    mode: "production",
    entry: "index.js",
    output: {
        library: "LIB",
        libraryTarget: "jsonp"
    },
    //...
    plugins: [
        new LibraryExtendWebpackPlugin()
    ]
}
```

Notice the use of `output.library` and `output.libraryTarget`, which indicates a library is being built and the bundle will expose it via a scoped variable named `LIB`.

>   __NOTE__: the value for `output.library` must as same as the existing global library which you want to add to.

>   __NOTE__: the value for `output.libraryTarget` must be `jsonp`.


## Example

Given the above Usage example:

### Entry File: `index.js`

```javascript
export { default as horn } from './lib/horn';

export { default as bark } from './lib/bark';
```

### Output Bundle

```javascript
Object.assign(LIB,/******/ (function(modules) {/* webpack bundle code */}));
```

Function `horn` and `bark` are added to global library `LIB`.

And `LIB.horn` and `LIB.bark` work well.

## Polyfill

If the browser does not support `Object.assign`, you can add `polyfill` as bellow,

```javascript
new LibraryExtendWebpackPlugin({ polyfill: true })
```

## Example of usage on the Browser

For example, the global library file is `lib.js`, 
and the output js file we generate with this plugin is `lib.extend.js`.

In the browser:

```html
<script src="https://cdn.xx.com/lib.js"></script>
<script src="https://cdn.xx.com/lib.extend.js"></script>
```

If we use `jquery` as an example, it will be
```html
<script src="https://code.jquery.com/jquery-1.12.4.js"></script>
<script src="https://code.jquery.com/ui/1.12.1/jquery-ui.js"></script>
```
