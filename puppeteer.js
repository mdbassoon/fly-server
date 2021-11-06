const local = require('./.env.js');
const puppeteer = require('puppeteer');
const mysql = require('mysql2/promise');

async function searchForGene(gene) {
  console.log(gene);
  try{
    const pool = await mysql.createPool({
      host: local.dbhost,
      port:local.dbport,
      user: local.dbuser,
      password: local.dbpassword,
      database: local.database,
      waitForConnections: true,
      connectionLimit: 100,
      queueLimit: 0
    });
    let testQuery = "SELECT * FROM gene_info WHERE gene_info.name LIKE ?";
    let today = new Date();
    let testQueryResults = await pool.execute(testQuery,[
      gene
    ]);
    //console.log(testQueryResults[0]);
    if(testQueryResults[0].length>0){
      let lastScraped = testQueryResults[0][0].time;
      console.log(lastScraped);
      console.log(' '+(today.getTime() - 86400000))
      if(lastScraped>(today.getTime() - 86400000)){
        return testQueryResults[0][0];
      }
    }
    let browser = await puppeteer.launch({headless:false,args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process', // <- this one doesn't works in Windows
      '--disable-gpu'
    ]});
    
    let page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36');
    await page.goto('https://flybase.org');
    //console.log(gene);
    await page.type('#GeneSearch',gene);
    await Promise.all([page.$eval('#j2g_search_form',form=>form.submit()),page.waitForNavigation()]);
    let select = await page.select('#fasta select','gene_extended');
    //console.log(select);
    await page.$eval('#fasta button',button=>button.click());
    await page.waitForSelector('.fastaSeq');
    let geneSequence = await page.$eval('.fastaSeq',res=>res.textContent);
    await page.select('#seqtype--2','CDS');
    await page.evaluate(()=>{
    [...document.querySelectorAll('form button')].find(element => element.textContent === 'View Sequence').click();
    });
    await page.waitForSelector('.fastaSeq');
    let selected = await page.$eval("#seqSelector", res => res.value);
    let selectedText = await page.$eval("option[value='"+selected+"']", res => res.textContent);
    //console.log(selectedText);
    let isoForms = await page.$$eval('#seqSelector option',elements=> elements.map(item=>item.textContent));
    let isoFormSequence = await page.$eval('.fastaSeq',res=>res.textContent);
    //console.log(geneSequence);
    let url = await page.url();
    let info = {
      'res':true,
      'url':url,
      'isoForm':selectedText,
      'isoForms':isoForms,
      'sequence':geneSequence.replace(/\s/g,''),
      'isoFormSequence':isoFormSequence.replace(/\s/g,''),
    }
    browser.close();
    let insertQuery = "insert into gene_info (name,isoForm,isoFormSequence,isoForms,url,sequence,time) VALUES (?,?,?,?,?,?,?)";
    
    await pool.execute(insertQuery,[
      gene,
      selectedText,
      isoFormSequence.replace(/\s/g,''),
      isoForms,
      url,
      geneSequence.replace(/\s/g,''),
      today.getTime()
    ]); 
    //console.log(testQuery);
    return info;
    
  } catch(e){
    console.log(e);
  }
}
module.exports.searchForGene = searchForGene;



async function searchForTargets(targetArea) {
  // console.log('target area: ',targetArea)
    try {
      var xvfb = new Xvfb();
      xvfb.startSync();
      const url = 'http://targetfinder.flycrispr.neuro.brown.edu/';
      let nightmare = Nightmare({show: false});
      let error = false;
      let res = await nightmare.goto(url)
      .wait('select[name="genomeSelect"]')
      .select('select[name="genomeSelect"]', 'Dmelvc9')
      .insert('#gDNA-form', targetArea)
      .click('button[name="routingVar"]')
      .wait('#CRISPRinput')
      .evaluate(()=>{ 
        const input = document.getElementById('CRISPRinput');
        const targets = input.innerHTML.toString().split('\n');
        if(targets.length>99) {
          input.innerHTML = targets.slice(0,99).join('\n');
        }
      })
      .click('button[name="routingVar"]')
      .wait('.result')
      .end()
      .evaluate(()=>{
        const results = document.getElementsByClassName('result');
        let resultsArr = [];
        for(let i=0;i<results.length;i++){
          let resultObj = {};
          if(results[i].getElementsByClassName('label-important-custom').length===0){
            resultObj['offTarget'] = results[i].getElementsByClassName('label')[0].innerText[0];
            resultObj['distal'] = results[i].getElementsByClassName('distal')[0].innerText;
            resultObj['proximal'] = results[i].getElementsByClassName('proximal')[0].innerText;
            resultObj['pam'] = results[i].getElementsByClassName('pam')[0].innerText;
            resultObj['strand'] = results[i].getElementsByTagName('td')[1].innerText;
            resultObj['label'] = results[i].getElementsByClassName('target-label')[0].innerText;
            resultsArr.push(resultObj);
          } else {error = true;}
        }
        return resultsArr;
      });  
      // console.log('res: ',res);
      xvfb.stopSync();
      if(!Array.isArray(res) || !res.length || error) {
        return {'error':'No Targets Found'};
      } else {
        if(res.length>0) {
          return res;
        } else {
          return {'error':'No Targets Found'};
        }
      }
    } catch(error){
      return error;
    }
}
async function checkTargetEfficiency(targets) {
  const url = 'http://www.flyrnai.org/evaluateCrispr/'
  try {
    var xvfb = new Xvfb();
    xvfb.startSync();
    let nightmare = Nightmare({show:false});
    const fullSearchString = targets.map((target)=>{
      const proximal = target.proximal;
      const distal = target.distal;
      const pam = target.pam;
      return proximal+distal;
    }).join('\n');
    let scores = await nightmare.goto(url)
    .insert('#textAreaInput', fullSearchString)
    .click('input[value="Display Results"]')
    .wait('#dataTable')
    .end()
    .evaluate(()=>{
      const rows = document.getElementById('dataTable').children[1].children;
      let scores = [];
      for(let i=0;i<rows.length;i++){
        const score = rows[i].children[8].innerText;
        scores.push(score)
      }
      return scores;
    });
    xvfb.stopSync();
    if(!Array.isArray(scores) || !scores.length){
      return {'error':'scores not found'}
    } else {
      for(let i=0;i<targets.length;i++){
        targets[i]['score'] = scores[i];
      }
      return targets;
    }
  } catch(error) {
    return error;
  }
}
async function getOligos(target) {
  try {
    var xvfb = new Xvfb();
    xvfb.startSync();
    const thisTarget = target.toString();
    let nightmare = Nightmare({show: false});
    const url = 'http://targetfinder.flycrispr.neuro.brown.edu/';
    let res = await nightmare.goto(url)
    .wait('select[name="genomeSelect"]')
    .select('select[name="genomeSelect"]', 'Dmelvc9')
    .wait('#gDNA-form')
    .insert('#gDNA-form', thisTarget)
    .click('button[name="routingVar"]')
    .wait('#CRISPRinput')
    .evaluate((thisTarget)=>{ 
      document.getElementById('CRISPRinput').innerHTML = thisTarget;
    }, thisTarget)
    .click('button[name="routingVar"]')
    .wait('.target-checkbox')
    .click('.target-checkbox')
    .wait('button[name="routingVar"]')
    .click('button[name="routingVar"]')
    .wait('.oligo-order')
    .end()  
    .evaluate(()=>{
      const oligos = document.getElementsByClassName('oligo-order')[0].children;
      let oligoText = [];
      for(let i=0;i<oligos.length;i++) {
        oligoText.push(oligos[i].innerText);
      }
      return oligoText; 
    });  
    xvfb.stopSync();
    if(!Array.isArray(res) || !res.length) {
      return {error:'error'}
    } else {
      return res;
    }
  } catch(error) {
   return error;
  }
}
async function getPrimers(primerSections) {
  let primers = {};
  const url = 'http://bioinfo.ut.ee/primer3-0.4.0/';
  for(let i=0;i<4;i++){
    var xvfb = new Xvfb();
    xvfb.startSync();
    let currentPrimer = !primers['hom5']?"5' Homology":!primers['seq5']?"5' Sequence":!primers['seq3']?"3' Sequence":"3' Homology";
    let primerSection = primerSections[currentPrimer];
    let primerSide = currentPrimer==="3' Homology"?'input[name="MUST_XLATE_PICK_LEFT"]':currentPrimer==="3' Sequence"?'input[name="MUST_XLATE_PICK_LEFT"]':'input[name="MUST_XLATE_PICK_RIGHT"]';
    try {
      let nightmare = Nightmare({show: false});
      let res = await nightmare.goto(url)
      .wait('textarea[name="SEQUENCE"]')
      .insert('textarea[name="SEQUENCE"]', primerSection)
      .click(primerSide)
      .click('input[name="Pick Primers"]')
      .wait('a[href="/primer3-0.4.0/primer3_www_results_help.html#PRIMER_OLIGO_SEQ"]')
      .end()
      .evaluate(()=>{
        const primers = document.querySelector('a[href="/primer3-0.4.0/primer3_www_results_help.html#PRIMER_OLIGO_SEQ"]').parentElement.innerText;
        return primers;
      });  
      xvfb.stopSync();
      let primerStart = [];
      let stop = 0;
      let finalStop = 0;
      for(let i=0;i<res.length;i++) {
        if(res.slice(i,i+6)==='PRIMER'){
          primerStart.push(i);
        } else if(res.slice(i,i+13)==='SEQUENCE SIZE') {
          stop = i;
        } else if(res.slice(i,i+10)==='Statistics') {
          finalStop = i;
        }
      }

      const firstPrimer = res.slice(primerStart[0],stop).replace(/[\n\r]/g,'').split(' ').filter((el)=>{return el != ''});
      let allPrimers = [firstPrimer];
      for(let i=1;i<primerStart.length;i++){
        const primer = res.slice(primerStart[i],!primerStart[i+1]?finalStop:primerStart[i+1]).replace(/[\n\r]/g,'').split(' ').filter((el)=>{return el != ''});
        allPrimers.push(primer);
      }
      if(currentPrimer==="5' Homology"){
        primers['hom5'] = allPrimers;
      } else if(currentPrimer==="5' Sequence") {
        primers['seq5'] = allPrimers;
      } else if(currentPrimer==="3' Sequence") {
        primers['seq3'] = allPrimers;
      } else {
        primers['hom3'] = allPrimers; 
      }
    } catch(error) {
      // console.log(error);
      return error;
    }
  }
  return primers;
}