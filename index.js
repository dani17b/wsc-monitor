const fs = require('fs-extra');
var util = require('util');
var bodyParser = require('body-parser');
var cors = require('cors');
var cron = require('node-cron');

//var log_file = fs.createWriteStream(__dirname + '/debug.log', {flags : 'w'});
//var log_stdout = process.stdout;

/* console.log = function(d) { //
  log_file.write('[LOG] ' + util.format(d) + '\n');
  log_stdout.write('[LOG] ' + util.format(d) + '\n');
};

console.error = function(d) { //
  log_file.write('[ERROR] ' + util.format(d) + '\n');
  log_stdout.write('[ERROR] ' + util.format(d) + '\n');
}; */

const createArtifact = require('./utils/create-artifact');
const deploy = require('./utils/deploy');

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

  res.header("Content-Type",'application/json');
  res.status(200);
  res.end(JSON.stringify(deploymentsInfo));
});

app.post('/deploy', (req, res) => {
  const body = req.body;
  console.log("body : " + JSON.stringify(body));
  //deploy(body.artifactName, {});
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
  createArtifact(artifactDefinition);
  res.status(200);
  res.end();
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

cron.schedule('*/1 * * * *', () => {
  let pendingDeploys = getPendingDeploys();
  
  if(pendingDeploys.length > 0 && pendingDeploys.filter(pendingDeploy => pendingDeploy.status == 'running') == 0){
    deploy(pendingDeploys[0]);
  }
});