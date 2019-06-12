const {promisify} = require("util");

const fs = require("fs");
const [open, close, read, write, ftruncate] = [
    promisify(fs.     open),
    promisify(fs.    close),
    promisify(fs.     read),
    promisify(fs.    write),
    promisify(fs.ftruncate),
];

const {Readable, Writable} = require("stream");
const debug = process.env.DEBUG && process.env.DEBUG.match(/\brw-stream\b/);
const log = (...data) => debug && console.error(...data);

module.exports = (async (file, {readStart, writeStart} = {}) => {
    const fd = await open(file, "r+");
    log(`File ${file} open`);

    let readIndex = +readStart || 0;
    let writeIndex = +writeStart || 0;

    let _updateReadPosition = () => 0;
    let _readPositonUpdated;
    function advanceReadPosition(pos) {
        const lastReadPromise = _updateReadPosition;
        if (pos > 0) {
            readIndex += pos;
            _readPositonUpdated = new Promise(res => _updateReadPosition = res);
        } else {
            readIndex = Infinity;
        }
        log(`Advance read position by ${pos}`);
        lastReadPromise(pos);
    }
    advanceReadPosition(0);

    if (readStart < writeStart) throw new Error("Read index MUST come before write index.");

    const readStream = new Readable({async read(size) {
        try {
            const ret = Buffer.alloc(size);
            const {bytesRead} = await read(fd, ret, 0, size, readIndex);
            log(`Read ${bytesRead} from ${readIndex}`);
            advanceReadPosition(bytesRead);

            if (!bytesRead)
                return this.push(null);

            this.push(ret.slice(0, bytesRead));
        } catch(e) {
            log(e);
            this.emit("error", e);
        }
    }});

    let _writePromise;
    const writeStream = new Writable({
        writev(chunks, callback) {
            return this._write(
                Buffer.concat(
                    chunks.map(({chunk, encoding}) => Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding))
                ),
                "binary",
                callback
            );
        },
        write(chunk, encoding, callback) {
            _writePromise = (async () => {
                try {
                    const toWrite = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);
                    let currentIndex = 0;
                    while (true) { /* eslint-disable-line no-constant-condition */
                        const maxWrite = Math.min(readIndex - (writeIndex + currentIndex), toWrite.length - currentIndex);
                        if (maxWrite === 0) {
                            log(`Awaiting for advance of read position at ${writeIndex + currentIndex} wanting write ${toWrite}`);

                            if (await _readPositonUpdated === 0 && toWrite.length === currentIndex) return;
                            continue;
                        }

                        const {bytesWritten} = await write(fd, toWrite, currentIndex, maxWrite, writeIndex + currentIndex);
                        log(`Wrote ${bytesWritten} at ${writeIndex + currentIndex}`);

                        currentIndex += bytesWritten;
                        if (currentIndex === toWrite.length) break;
                    }

                    writeIndex += currentIndex;
					
                    callback();
                } catch(e) {
                    log(e);
                    callback(e);
                }
            })();
        },
        final(callback) {
            _writePromise
                .then(() => ftruncate(fd, writeIndex))
                .then(() => close(fd))
                .then(callback);
        }
    });
	
    return {
        fd,
        readStream,
        writeStream
    };
});
