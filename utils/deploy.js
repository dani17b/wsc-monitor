const fs = require('fs-extra');
const { execSync,spawn } = require("child_process");


module.exports = async function deploy(artifactName, options) {
    const artifactFolder = `/home/apps/${artifactName}`;

    // 1. Get artifact descriptor
    const deploymentsInfoPath = `/home/apps/.deployments-info.json`;
    const deploymentsInfo = JSON.parse(fs.readFileSync(deploymentsInfoPath, {
        encoding : 'UTF-8'
    }));
    const artifactDescriptor = deploymentsInfo[artifactName];

    // 2. If artifact is running, stop it
    if(artifactDescriptor.instance && artifactDescriptor.instance.status == 'running'){
        try{
            execSync(`kill -9 ${artifactDescriptor.instance.pid}`, {
                stdio: 'inherit'
            });
        } catch(e){
            console.log("Error executing ", `kill -9 ${artifactDescriptor.instance.pid}`, e);
        }
    }

    artifactDescriptor.instance = {
        lastUpdate : new Date().getTime(),
        status : 'deploying'
    }

    fs.writeFileSync(
        deploymentsInfoPath,
        JSON.stringify(deploymentsInfo),
        'UTF-8'
    );

    // 2. Update artifact
    execSync('git reset --hard', {
        cwd: artifactFolder,
        stdio: 'inherit'
    });

    execSync('git pull', {
        cwd: artifactFolder,
        stdio: 'inherit'
    });

    // 3. Install dependencies and build artifact
    let artifactProcessPID = undefined;

    let artifactServerPort = null;
    if(artifactDescriptor.deployType == 'server'){
        fs.chmodSync(`./scripts/getFreePort.sh`, 755);
        artifactServerPort = execSync(`./scripts/getFreePort.sh 3000 1`);
        artifactServerPort = parseInt(artifactServerPort);
    }

    switch(artifactDescriptor.type){
        case 'node':
            execSync('npm install', {
                cwd: artifactFolder,
                stdio: 'inherit'
            });

            if(artifactDescriptor.deployType == 'static'){
                execSync('npm run build', {
                    cwd: artifactFolder,
                    stdio: 'inherit'
                });
            }

            if(artifactDescriptor.deployType == 'server'){
                fs.chmodSync(artifactFolder, '0777');

                const spawnResult = spawn(artifactDescriptor.launchCommand.split(' ')[0], artifactDescriptor.launchCommand.split(' ').slice(1), {
                    cwd: artifactFolder,
                    detached : true,
                    stdio: 'ignore',
                    env : {
                        PORT : artifactServerPort
                    }
                });

                artifactProcessPID = spawnResult.pid;
                
                spawnResult.unref();
            }
            
            break;
        case 'maven':
            execSync('mvn clean install', {
                cwd: artifactFolder,
                stdio: 'inherit'
            });
            break;
    }

    if(artifactDescriptor.deployType == 'server'){
        console.log('Hay que tocar el fichero del virtual host para poner el puerto ' + artifactServerPort);
    }

    artifactDescriptor.instance = {
        lastUpdate : new Date().getTime(),
        status : 'running',
        pid : artifactProcessPID
    }

    fs.writeFileSync(
        deploymentsInfoPath,
        JSON.stringify(deploymentsInfo),
        'UTF-8'
    );
};