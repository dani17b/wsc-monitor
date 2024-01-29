const fs = require('fs-extra');

module.exports = function createDeploy(artifactName) {
    // 1. Get pending deployments
    const pendingDeploymentsPath = `/home/apps/.pending-deployments.json`;

    let pendingDeploymentsInfo = fs.existsSync(pendingDeploymentsPath) ? JSON.parse(fs.readFileSync(pendingDeploymentsPath, {
        encoding : 'UTF-8'
    })) : [];

    // 2. Add pending deployment
    const creationDate = new Date().getTime();
    const deploymentInfo = {
        key : `${artifactName}-${creationDate}`,
        artifactName,
        status : 'pending',
        creationDate : creationDate
    };

    console.log("deployment info");
    console.log(JSON.stringify(deploymentInfo));

    pendingDeploymentsInfo = pendingDeploymentsInfo.concat(deploymentInfo);

    // 3. Update pending deployments
    fs.writeFileSync(
        pendingDeploymentsPath,
        JSON.stringify(pendingDeploymentsInfo),
        'UTF-8'
    );

    return deploymentInfo;
};