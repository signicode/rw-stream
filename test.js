const {StringStream} = require("scramjet");
const {promisify} = require("util");

const fs = require("fs");
const [open, read, write] = [
    promisify(fs. open),
    promisify(fs. read),
    promisify(fs.write),
];

const {Readable, Writable} = require("stream");

const rw = (async (file, {readStart, writeStart} = {}) => {
    const fd = await open(file, "r+");
    console.error(`File ${file} open`);

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
        console.error(`Advance read position by ${pos}`);
        lastReadPromise(pos);
    }
    advanceReadPosition(0);

    if (readStart < writeStart) throw new Error("Read index MUST come before write index.");

    const readStream = new Readable({async read(size) {
        try {
            const ret = Buffer.alloc(size);
            const {bytesRead} = await read(fd, ret, 0, size, readIndex);
            console.error(`Read ${bytesRead} from ${readIndex}`);
            advanceReadPosition(bytesRead);

            if (!bytesRead)
                return this.push(null);

            this.push(ret.slice(0, bytesRead));
        } catch(e) {
            console.error(e);
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
                            console.error(`Awaiting for advance of read position at ${writeIndex + currentIndex} wanting write ${toWrite}`);

                            if (await _readPositonUpdated === 0 && toWrite.length === currentIndex) return;
                            continue;
                        }

                        const {bytesWritten} = await write(fd, toWrite, currentIndex, maxWrite, writeIndex + currentIndex);
                        console.error(`Wrote ${bytesWritten} at ${writeIndex + currentIndex}`);

                        currentIndex += bytesWritten;
                        if (currentIndex === toWrite.length) break;
                    }

                    writeIndex += currentIndex;
                    callback();
                } catch(e) {
                    console.error(e);
                    callback(e);
                }
            })();
        },
        flush(callback) {
            _writePromise.then(callback);
        }
    });

    return {
        fd,
        readStream,
        writeStream
    };
});

(async () => {
    const {readStream, writeStream} = await rw("test.txt");

    const out = StringStream.from(readStream)
        .lines()
        .map(x => +x + 1)
        .endWith("1")
        .map(x => `${3*x}\n${x+10}\n`);

    out.pipe(writeStream);

    await out.whenEnd();
    console.log("read all");

})();
