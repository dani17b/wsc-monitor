const fs = require('fs-extra');
const { execSync,spawn } = require("child_process");
const createVirtualHost = require('./create-virtual-host');
const updatePendingDeploy = require('./update-pending-deploy');
const deletePendingDeploy = require('./delete-pending-deploy');
const getPendingDeploys = require('./get-pending-deploys');

const deploymentsInfoPath = `/home/apps/.deployments-info.json`;

const pad = (num) => {
    return num > 9 ? `${num}` : `0${num}`;
}
const log = (file, level, content) => {
    let logContents = fs.existsSync(file) ? fs.readFileSync(file, {
        encoding : 'UTF-8'
    }) : '';

    const now = new Date();
    let logDate = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    fs.writeFileSync(
        file,
        logContents + `[${level}][${logDate}] ` + content + '\n',
        'UTF-8'
    );
}

const getArtifactDescriptor = (artifactName) => {
    // 1. Get artifact descriptor
    const deploymentsInfo = JSON.parse(fs.readFileSync(deploymentsInfoPath, {
        encoding : 'UTF-8'
    }));
    const artifactDescriptor = deploymentsInfo[artifactName];

    return artifactDescriptor;
}

const updateArtifactDescriptor = (artifactName, descriptorUpdated) => {
    let deploymentsInfo = JSON.parse(fs.readFileSync(deploymentsInfoPath, {
        encoding : 'UTF-8'
    }));
    
    const artifactDescriptor = deploymentsInfo[artifactName];

    deploymentsInfo[artifactName] = {
        ...artifactDescriptor,
        ...descriptorUpdated
    }

    fs.writeFileSync(
        deploymentsInfoPath,
        JSON.stringify(deploymentsInfo),
        'UTF-8'
    );
}


module.exports = async function deploy(pendingDeploy) {

    const logFile = `/home/apps/.deploy-${pendingDeploy.key}.log`;

    try{
        // 1. Update deploy status
        updatePendingDeploy({
            ...pendingDeploy,
            status : 'running'
        });

        log(logFile, 'INFO', 'Start deploy');
        log(logFile, 'INFO', `Deploy info : ${JSON.stringify(pendingDeploy, null, 2)}`);
        const artifactFolder = `/home/apps/${pendingDeploy.artifactName}`;

        // 1. Get artifact descriptor
        const artifactDescriptor = getArtifactDescriptor(pendingDeploy.artifactName);

        log(logFile, 'INFO', `Artifact descriptor found with ${JSON.stringify(artifactDescriptor, null, 2)}`);

        
        // 2. If artifact is running, stop it
        if(artifactDescriptor.instance && artifactDescriptor.instance.status == 'running'){
            log(logFile, 'INFO', `Artifact is running with PID ${artifactDescriptor.instance.pid}, stopping it`);
            try{
                execSync(`kill -9 ${artifactDescriptor.instance.pid}`, {
                    stdio: 'inherit'
                });
            } catch(e){
                console.log("Error executing ", `kill -9 ${artifactDescriptor.instance.pid}`, e);
            }
        }

        log(logFile, 'INFO', `Updating artifact status to deploying`);
        updateArtifactDescriptor(pendingDeploy.artifactName, {
            instance : {
                lastUpdate : new Date().getTime(),
                status : 'deploying'
            }
        });

        
        // 2. Update artifact
        const gitResetResult = execSync('git reset --hard', {
            cwd: artifactFolder
        });

        log(logFile, 'INFO', gitResetResult);

        const gitPullResult = execSync('git pull', {
            cwd: artifactFolder
        });

        log(logFile, 'INFO', gitPullResult.toString());

        // 3. Install dependencies and build artifact
        let artifactProcessPID = undefined;

        let artifactServerPort = null;
        if(artifactDescriptor.deployType == 'server'){
            fs.chmodSync(`./scripts/getFreePort.sh`, 755);
            artifactServerPort = execSync(`./scripts/getFreePort.sh 3000 1`);
            artifactServerPort = parseInt(artifactServerPort);

            log(logFile, 'INFO', `Detected free TCP port on ${artifactServerPort}`);
        }

        switch(artifactDescriptor.type){
            case 'node':
                log(logFile, 'INFO', `Install dependencies`);
                const npmInstallResult = execSync('npm install', {
                    cwd: artifactFolder
                });

                log(logFile, 'INFO',  npmInstallResult.toString());

                if(artifactDescriptor.deployType == 'static'){
                    try{
                        const npmRunBuildResult = execSync('npm run build', {
                            cwd: artifactFolder
                        });

                        console.log("Build result", npmRunBuildResult.toString());
                    } catch (e){
                        log(logFile, 'ERROR',  e + e.stdout.toString());
                        throw "Error building artifact";
                    }
                }
 
                if(artifactDescriptor.deployType == 'server'){
                    fs.chmodSync(artifactFolder, '0777');

                    const spawnResult = spawn(artifactDescriptor.launchCommand.split(' ')[0], artifactDescriptor.launchCommand.split(' ').slice(1), {
                        cwd: artifactFolder,
                        detached : true,
                        stdio: 'ignore',
                        env : {
                            ...process.env,
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
            createVirtualHost(artifactDescriptor.domain, {
                type : artifactDescriptor.deployType,
                name : artifactDescriptor.artifactName,
                port : artifactServerPort
            });
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
    }catch(e){
        log(logFile, 'ERROR', e);

        updateArtifactDescriptor(pendingDeploy.artifactName, {
            instance : {
                lastUpdate : new Date().getTime(),
                status : 'fail',
                lastDeployKey : pendingDeploy.key
            }
        });
        
        deletePendingDeploy(pendingDeploy.key);

        log(logFile, 'INFO', 'Deploy ends');
    }
};