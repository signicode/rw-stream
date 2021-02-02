/* eslint-disable node/no-unpublished-require */
const {promisify} = require("util");
const {Transform} = require("stream");
const rw = require("../../");
const {copyFile, readFile} = require("fs");

module.exports = async (assert) => {
    const testFile = `${__dirname}/test.empty.tmp`;
    await promisify(copyFile)(`${__dirname}/test.txt`, testFile);
    const {readStream, writeStream} = await rw(testFile);

    await new Promise((resolve, reject) => {
        readStream
            .pipe(new Transform({
                transform(chunk, encoding, cb) {
                    return cb();
                },
                flush (cb) {
                    return cb(null, "");
                }
            }))
            .pipe(writeStream)
            .on("finish", resolve)
            .on("error", reject)
    });

    const contents = await promisify(readFile)(testFile, {encoding: "utf-8"});
    assert.strictEqual(contents, "");

    console.log("empty test done");
};
