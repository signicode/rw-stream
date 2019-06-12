/* eslint-disable node/no-unpublished-require */
const {promisify} = require("util");
const {StringStream} = require("scramjet");
const rw = require("../../");
const {copyFile, readFile} = require("fs");

module.exports = async (assert) => {
    const testFile = `${__dirname}/test.grow.tmp`;
    await promisify(copyFile)(`${__dirname}/test.txt`, testFile);
    const {readStream, writeStream} = await rw(testFile);

    const out = StringStream.from(readStream)
        .lines()
        .map(x => +x + 1)
        .endWith("1")
        .map(x => `${x+10}\n`);

    out.pipe(writeStream);

    const fin = new Promise(res => writeStream.on("finish", res));

    await out.whenEnd();
    
    await fin;
    
    const contents = await promisify(readFile)(testFile, {encoding: "utf-8"});
    assert.strictEqual(contents, "12\n13\n14\n15\n16\n17\n18\n19\n20\n21\n11\n");
    
    console.log("grow test done");
};
