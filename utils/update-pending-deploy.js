const fs = require('fs-extra');

module.exports = function updatePendingDeploy(pendingDeploy) {
    // 1. Get pending deployments
    const pendingDeploymentsPath = `/home/apps/.pending-deployments.json`;

    let pendingDeploymentsInfo = fs.existsSync(pendingDeploymentsPath) ? JSON.parse(fs.readFileSync(pendingDeploymentsPath, {
        encoding : 'UTF-8'
    })) : [];

    // 2. Update pending deployment
    pendingDeploymentsInfo = pendingDeploymentsInfo.filter(pendingDeployment => pendingDeployment.key != pendingDeploy.key);
    pendingDeploymentsInfo = [pendingDeploy].concat(pendingDeploymentsInfo);

    // 3. Update pending deployments
    fs.writeFileSync(
        pendingDeploymentsPath,
        JSON.stringify(pendingDeploymentsInfo),
        'UTF-8'
    );

    return pendingDeploymentsInfo;
};