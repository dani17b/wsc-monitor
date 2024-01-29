const fs = require('fs-extra');

module.exports = function getPendingDeploys() {
    // 1. Get pending deployments
    const pendingDeploymentsPath = `/home/apps/.pending-deployments.json`;

    let pendingDeploymentsInfo = fs.existsSync(pendingDeploymentsPath) ? JSON.parse(fs.readFileSync(pendingDeploymentsPath, {
        encoding : 'UTF-8'
    })) : [];

    return pendingDeploymentsInfo;
};