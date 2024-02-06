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

module.exports = async function deploy(pendingDeployKey) {
    const pendingDeploy = getPendingDeploys().filter(deployItem => deployItem.key == pendingDeployKey)[0];

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

        // Get last commit message
        const gitLogResult = execSync('git log --pretty=format:"%ad//%aN//%al//%s" -1', {
            cwd: artifactFolder
        });

        const gitLogResultParts = gitLogResult.toString().split('//');

        let authorEmail = gitLogResultParts[2];
        authorEmail = authorEmail.indexOf('+') != -1 ? authorEmail.split('+')[1] : authorEmail;

        const lastCommitInfo = {
            date : gitLogResultParts[0],
            author : {
                name : gitLogResultParts[1],
                email: authorEmail
            },
            message : gitLogResultParts[3]
        };

        // 3. Install dependencies and build artifact
        let artifactProcessPID = undefined;

        let artifactServerPort = null;
        if(artifactDescriptor.deployType == 'server'){
            fs.chmodSync(`./scripts/getFreePort.sh`, 755);
            artifactServerPort = execSync(`./scripts/getFreePort.sh 3000 1`);
            artifactServerPort = parseInt(artifactServerPort);

            log(logFile, 'INFO', `Detected free TCP port on ${artifactServerPort}`);
        }

        let launchArgs = [];
        switch(artifactDescriptor.type){
            case 'node':
                log(logFile, 'INFO', `Install dependencies`);
                const npmInstallResult = execSync('npm install', {
                    cwd: artifactFolder
                });

                log(logFile, 'INFO',  npmInstallResult.toString());

                if(artifactDescriptor.deployType == 'static'){

                    fs.writeFileSync(
                        `${artifactFolder}/.env`,
                        `REACT_APP_ENV=DES`,
                        'UTF-8'
                    );

                    try{
                        const npmRunBuildResult = execSync('npm run build', {
                            cwd: artifactFolder,
                            env : {
                                ...process.env
                            }
                        });

                        console.log("Build result", npmRunBuildResult.toString());
                    } catch (e){
                        log(logFile, 'ERROR',  e + e.stdout.toString());
                        throw "Error building artifact";
                    }
                }
                
                break;
            case 'maven':
                const mvnCleanInstallResult = execSync('mvn clean install', {
                    cwd: artifactFolder
                });
        
                log(logFile, 'INFO', mvnCleanInstallResult.toString());

                launchArgs = [
                    `-Dspring-boot.run.arguments=--server.port=${artifactServerPort}`
                ]
                break;
            case 'python':
                console.log("Antes de instalar las dependencias");
                const pythonInstallResult = execSync('pip install -r requirements.txt', {
                    cwd: artifactFolder
                });
        
                log(logFile, 'INFO', pythonInstallResult.toString());

                break;
        }

        if(artifactDescriptor.deployType == 'server'){
            fs.chmodSync(artifactFolder, '0777');

            const spawnResult = spawn('nohup', artifactDescriptor.launchCommand.split(' ').concat(launchArgs), {
                cwd: artifactFolder,
                detached : true,
                env : {
                    ...process.env,
                    PORT : artifactServerPort,
                    ENV : 'DES'
                }
            });

            artifactProcessPID = spawnResult.pid;
            
            spawnResult.unref();

            createVirtualHost(artifactDescriptor.domain, {
                type : artifactDescriptor.deployType,
                name : artifactDescriptor.artifactName,
                port : artifactServerPort
            });
        }

        updateArtifactDescriptor(pendingDeploy.artifactName, {
            instance : {
                lastUpdate : new Date().getTime(),
                status : 'running',
                pid : artifactProcessPID,
                lastDeployKey : pendingDeploy.key,
            },
            lastCommitInfo
        });
        
        deletePendingDeploy(pendingDeploy.key);

        log(logFile, 'INFO', 'Deploy ends OK');
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

        log(logFile, 'INFO', 'Deploy ends with ERROR');
    }
};