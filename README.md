# rw-stream

A stream that can substitute contents of a file in streaming fashion.

The aim of this module is to expose a readable and writable stream connected to a single file at the same time. It works similarily to `fs.createReadStream` and `fs.createWriteStream`, but allows writing and reading simultanously, without creating a new file or move operations.

This is achieved by disallowing any write operations to advance further than the current reading index. This module will then make sure that a byte of the file will be read before it's overwritten.

***Note:*** In any case, the file will be accessed and it's contents may be overwritten even if there's no actual read operation done (due to node.js streams buffering mechanisms).

## Usage:

```javascript
const rw = require("../");

const {fd, readStream, writeStream} = await rw(path, options);
```

Arguments:

 * **path** `string` - the path of the file to access.
 * **options** `object` - options, currently none.

Returns an `object` with the following properties:

 * **fd** `int` - file descriptor number (from `fs.open`)
 * **writeStream** `Writable` - Writable stream for new file contents.
 * **readStream** `Readable` - Readable stream containing previous contents.

## Samples

A simple module that replaces the contents of a file while keeping a backup:

```javascript
const replaceAndBackup = async (newContentStream) => {
    const {readStream, writeStream} = await rw(path);

    readStream.pipe(fs.createWriteStream(`${path}.bak`));
    newContentStream.pipe(writeStream);

    return new Promise((res, rej) => writeStream.on('finish', res).on('error', rej));
}
```

## Testing

For now there's just:

```bash
$ node test
```

Two tests will be executed:

* one for file that's being grown.
* one for file that's being shrinked.

We're working on more and proper tests.
