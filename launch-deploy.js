const deploy = require('./utils/deploy');

const args = process.argv.slice(2);
const deployKey = args[0];

deploy(deployKey);