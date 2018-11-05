/* eslint-disable node/no-unpublished-require */
const {StringStream} = require("scramjet");
const rw = require("../");

(async () => {
    const {readStream, writeStream} = await rw(`${__dirname}/grow.txt`);

    const out = StringStream.from(readStream)
        .lines()
        .map(x => +x + 1)
        .endWith("1")
        .map(x => `${3*x}\n${x+10}\n`);

    out.pipe(writeStream);

    await out.whenEnd();
    console.log("read all");

})();
