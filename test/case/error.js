/* eslint-disable node/no-unpublished-require */
const {promisify} = require("util");
const {Transform} = require("stream");
const rw = require("../../");
const {writeFile, unlink} = require("fs");

module.exports = async (assert) => {
    const testFile = `${__dirname}/test.error.tmp`;
    await promisify(writeFile)(
        testFile, "test".split("").join("\n").repeat(40000000)
    );
    const {readStream, writeStream} = await rw(testFile);

    let counter = 0;
    const transformStream = (
        new Transform({
            transform(chunk, encoding, cb) {
                if(counter++ > 1) {
                    readStream.push = () => {throw new Error("sth")};
                }
                return cb(null, chunk);
            }
        })
    );

    await assert.rejects(
        () => new Promise((resolve, reject) => {
            readStream
                  .on("error", err => {
                    transformStream.destroy();
                    writeStream.destroy();
                    return reject(err);
                  })
              .pipe(transformStream)
                  .on("error", err => {
                    readStream.destroy();
                    writeStream.destroy();
                    return reject(err);
                  })
              .pipe(writeStream)
                  .on("finish", resolve)
        }),
        err => {
            return (
                readStream.destroyed
                    &&
                transformStream.destroyed
                    &&
                writeStream.destroyed
            );
        },
        "Undestroyed stream(s) detected. Memory leaks may occur"
    )

    unlink(testFile, () => console.log("error test done"));
};
