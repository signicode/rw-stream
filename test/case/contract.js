/* eslint-disable node/no-unpublished-require */
const {promisify} = require("util");
const {StringStream} = require("scramjet");
const rw = require("../../");
const {copyFile, readFile} = require("fs");

module.exports = async (assert) => {
    const testFile = `${__dirname}/test.contract.tmp`;
    await promisify(copyFile)(`${__dirname}/test.txt`, testFile);
    const {readStream, writeStream} = await rw(testFile);

    const out = StringStream.from(readStream)
        .lines()
        .filter(x => !isNaN(+x) && +x % 2)
        .map(x => `${+x+10}\n`);

    out.pipe(writeStream);

    const fin = new Promise(res => writeStream.on("finish", res));

    await out.whenEnd();
    await fin;

    const contents = await promisify(readFile)(testFile, {encoding: "utf-8"});
    assert.strictEqual(contents, "11\n13\n15\n17\n19\n");

    console.log("contract test done");
};
