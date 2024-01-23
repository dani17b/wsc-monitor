const fs = require('fs-extra');
const { execSync } = require("child_process");
const createVirtualHost = require('./create-virtual-host');

const GH_TOKEN = fs.readFileSync('/etc/nginx/.user_sec', {
    encoding : 'UTF-8'
});

module.exports = async function createArtifact(options) {
    // 1. Clone repository
    const artifactFolder = `/home/apps/${options.artifactName}`;

    if(!fs.existsSync(artifactFolder)){
        const repository = `https://${GH_TOKEN}@${options.repository.split('https://')[1]}`;
        execSync(`git clone ${repository} ${artifactFolder}`, {
            stdio: 'inherit'
        });
    }
    
    // 2. Create descriptor for artifact
    const deploymentsInfoPath = `/home/apps/.deployments-info.json`;
    const deploymentsInfo = fs.existsSync(deploymentsInfoPath) ? JSON.parse(fs.readFileSync(deploymentsInfoPath, {
        encoding : 'UTF-8'
    })) : {};

    deploymentsInfo[options.artifactName] = options;

    fs.writeFileSync(
        deploymentsInfoPath,
        JSON.stringify(deploymentsInfo),
        'UTF-8'
    );

    // 3. Create virtual host
    createVirtualHost(options.domain, {
        type : options.deployType,
        name : options.artifactName,
        target : options.deployTarget
    });
};