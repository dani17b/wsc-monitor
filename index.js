//const createArtifact = require('./utils/create-artifact');
//const deploy = require('./utils/deploy');


/* createArtifact({
    artifactName : 'web-docurag',
    domain : 'docurag.altiacamp.com',
    type : 'node', // OR maven
    deployType : 'static',
    deployTarget : 'build',
    repository : 'https://github.com/altia-itx/web-docurag.git'
}); */

//deploy('web-docurag', {});

const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('Hello World!')
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
});