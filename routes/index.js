
var express = require('express');
var router = express.Router();
var path = require('path');
var app = express();
var nightmare = require('../nightmareTools.js');
var puppet = require('../puppeteer.js');
/* GET home page. */
router.get('/', (req, res)=>{
  res.sendFile(path.join(__dirname, '../public/build', 'index.html'));
})
.get('/api', async (req,res)=>{
  req.socket.setTimeout(3600e3);
  if(req.query&&req.query.type==='new'){
    res.json(['you did it']);
    res.end();
    return null;
  }
  res.header("Access-Control-Allow-Origin", "*");
  let response = {'error':'no valid query'}
  if(req.query){/*console.log(req.query);*/}
  if(req.query.type === 'search'){
    //Get Name 
    response = await puppet.searchForGene(req.query.gene,req.query.isoform);
  } else if(req.query.type === 'isoform'){
    response = await puppet.getIsoForm(req.query.isoform);
  } else if(req.query.type === 'moreBases') {
    //Get Gene Info with Padding
    // console.log('base url: ',Buffer.from(req.query.url, 'base64').toString('ascii'));
    response = await nightmare.getMoreBases(Buffer.from(req.query.url, 'base64').toString('ascii'));
  } else if(req.query.type === 'geneInfo') {
    //Get Gene Info
    // console.log('base url: ',Buffer.from(req.query.url, 'base64').toString('ascii'));
    response = await nightmare.getGeneInfo(Buffer.from(req.query.url, 'base64').toString('ascii'));
  } else if(req.query.type === 'targetSearch') {
    //Get Possible Target List
    response = await puppet.searchForTargets(req.query.targetArea);
  } else if(req.query.type === 'targetEfficiency') {
    //Get Efficiency Score for Targets
    response = await puppet.checkTargetEfficiency(req.query.targets);
  } else if(req.query.type === 'oligos') {
    response = await puppet.getOligos(req.query.target);
  } else if(req.query.type === 'primers') {
    console.log('primer input: ',JSON.parse(Buffer.from(req.query.primerSections, 'base64').toString('ascii')));
    response = await puppet.getPrimers(JSON.parse(Buffer.from(req.query.primerSections, 'base64').toString('ascii')));
  }
  // console.log(response)
  res.json(response);
  res.end();
  const used = process.memoryUsage().heapUsed / 1024 / 1024;
  console.log(`The script uses approximately ${Math.round(used * 100) / 100} MB`);
  return;
}).get('/docs', (req, res)=>{
  res.sendFile(path.join(__dirname, '../', 'public/api-docs/index.html'));
});

module.exports = router;
