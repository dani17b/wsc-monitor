const fs = require('fs-extra');

module.exports = function getDeployLog(deployKey) {
    // 1. Get pending deployments
    const deployLogPath = `/home/apps/.deploy-${deployKey}.log`;

    let deployLog = fs.existsSync(deployLogPath) ? fs.readFileSync(deployLogPath, {
        encoding : 'UTF-8'
    }) : [];

    return deployLog;
};