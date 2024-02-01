const fs = require('fs-extra');
var util = require('util');
var bodyParser = require('body-parser');
var cors = require('cors');
const schedule = require('node-schedule');
const { spawn } = require("child_process");

const createArtifact = require('./utils/create-artifact');


const express = require('express');
const createDeploy = require('./utils/create-deploy');
const getPendingDeploys = require('./utils/get-pending-deploys');
const getDeployLog = require('./utils/get-deploy-log');
const app = express();
app.use(bodyParser.json());
app.use(cors());

const port = process.env.PORT || 3000;

console.log("Going to launch server on port " + port);

app.get('/info', (req, res) => {
  const deploymentsInfoPath = `/home/apps/.deployments-info.json`;
  const deploymentsInfo = JSON.parse(fs.readFileSync(deploymentsInfoPath, {
      encoding : 'UTF-8'
  }));

  const orderedDeploymentsInfo = Object.keys(deploymentsInfo).sort((deploymentInfoItemKey1, deploymentInfoItemKey2) => {
    return deploymentsInfo[deploymentInfoItemKey1].instance?.lastUpdate > deploymentsInfo[deploymentInfoItemKey2].instance?.lastUpdate ? -1 : 1;
  }).reduce(
    (obj, key) => { 
      obj[key] = deploymentsInfo[key]; 
      return obj;
    }, 
    {}
  );
  
  res.header("Content-Type",'application/json');
  res.status(200);
  res.end(JSON.stringify(orderedDeploymentsInfo));
});

app.post('/deploy', (req, res) => {
  const body = req.body;
  const deployInfo = createDeploy(body.artifactName);
  
  res.header("Content-Type",'application/json');
  res.status(200);
  res.end(JSON.stringify(deployInfo));
});

app.get('/pending_deployments', (req, res) => {
  const pendingDeployments = getPendingDeploys();

  res.status(200);
  res.end(JSON.stringify(pendingDeployments));
});

app.get('/deploy_log', (req, res) => {
  const deployKey = req.query.deploy_key;
  const deployLog = getDeployLog(deployKey);

  res.status(200);
  res.end(deployLog);
});


app.post('/artifact', (req, res) => {
  const artifactDefinition = req.body;
  const createdArtifact = createArtifact(artifactDefinition);
  res.status(200);
  res.end(JSON.stringify(createdArtifact));
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

schedule.scheduleJob('*/1 * * * *', () => {
  let pendingDeploys = getPendingDeploys();
  
  if(pendingDeploys.length > 0 && pendingDeploys.filter(pendingDeploy => pendingDeploy.status == 'running') == 0){
    //deploy(pendingDeploys[0].key);
    const spawnResult = spawn('node', ['launch-deploy.js', pendingDeploys[0].key], {
      detached : true,
      stdio: 'inherit'
    });
  
    artifactProcessPID = spawnResult.pid;
  
    spawnResult.unref();
  }
});