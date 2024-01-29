const fs = require('fs-extra');

module.exports = function deleteDeploy(deployKey) {
    // 1. Get pending deployments
    const pendingDeploymentsPath = `/home/apps/.pending-deployments.json`;

    let pendingDeploymentsInfo = fs.existsSync(pendingDeploymentsPath) ? JSON.parse(fs.readFileSync(pendingDeploymentsPath, {
        encoding : 'UTF-8'
    })) : [];

    // 2. Remove deploy
    pendingDeploymentsInfo = pendingDeploymentsInfo.filter(pendingDeploymentInfoItem => pendingDeploymentInfoItem.key != deployKey);

    // 3. Update pending deployments
    fs.writeFileSync(
        pendingDeploymentsPath,
        JSON.stringify(pendingDeploymentsInfo),
        'UTF-8'
    );

    return pendingDeploymentsInfo;
};