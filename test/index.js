/* eslint-disable node/no-unpublished-require */
const assert = require("assert");

(async () => {
    console.log("Testing");
    await require("./case/grow")(assert);
    await require("./case/contract")(assert);
    console.log("Tests done");
})().catch(e => {
    console.error(e.stack);
    process.exit(e.exitCode || 31);
});
