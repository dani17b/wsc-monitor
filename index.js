const fs = require('fs-extra');
var util = require('util');
var bodyParser = require('body-parser');
var cors = require('cors');
var cron = require('node-cron');

var log_file = fs.createWriteStream(__dirname + '/debug.log', {flags : 'w'});
var log_stdout = process.stdout;

console.log = function(d) { //
  log_file.write('[LOG] ' + util.format(d) + '\n');
  log_stdout.write('[LOG] ' + util.format(d) + '\n');
};

console.error = function(d) { //
  log_file.write('[ERROR] ' + util.format(d) + '\n');
  log_stdout.write('[ERROR] ' + util.format(d) + '\n');
};

const createArtifact = require('./utils/create-artifact');
const deploy = require('./utils/deploy');


/* createArtifact({
    artifactName : 'web-docurag',
    domain : 'docurag.altiacamp.com',
    type : 'node', // OR maven
    deployType : 'static',
    deployTarget : 'build',
    repository : 'https://github.com/altia-itx/web-docurag.git',
    launchCommand : 'node index.js'
}); */

//deploy('web-docurag', {});

const express = require('express');
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
  deploy(body.artifactName, {});
  res.status(200);
  res.end();
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
  console.log('CHECK DEPLOYS PENDING running a task 1 minute');
});