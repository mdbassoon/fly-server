const local = require('./.env.js');
const puppeteer = require('puppeteer');
const mysql = require('mysql2/promise');

async function searchForGene(gene,isoFormSearch) {
  console.log(gene);
  console.log(isoFormSearch);
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
    let testQuery,testQueryResults;
    testQuery = "SELECT * FROM gene_info WHERE gene_info.name LIKE ? ";
    testQueryResults = await pool.execute(testQuery,[
      gene
    ]);
    let today = new Date();
    if(testQueryResults[0].length>0){
      let lastScraped = testQueryResults[0][0].time;
      console.log(testQueryResults[0][0]);
      console.log(lastScraped); 
      console.log(' '+(today.getTime() - (7*86400000)))
      if(lastScraped>(today.getTime() - (7*86400000))){
        return testQueryResults[0][0];
      }
    }
   
    let browser = await puppeteer.launch({headless:true,args: [
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
    let isoForms = await page.$$eval('#seqSelector option',elements=> elements.map(item=>item.value));
    let isoFormNames = await page.$$eval('#seqSelector option',elements=> elements.map(item=>item.textContent));
    let isoFormInfo = {};
   
    for(let i=0;i<isoForms.length;i++){
      await page.select('#seqSelector',isoForms[i]);
      let isoFormName = isoFormNames[i];
      let isoFormGene = await page.$eval('.fastaSeq',res=>res.textContent);
      isoFormInfo[isoFormNames[i]] = isoFormGene;
    }
    let isoFormSequence = await page.$eval('.fastaSeq',res=>res.textContent);
    let geneID = await page.$eval('input[name="ids"]', res => res.value);
    //console.log(geneSymbol);
    let url = await page.url();
    let info = {
      'res':true,
      'url':url,
      'isoForm':selectedText,
      'isoForms':JSON.stringify(isoFormNames),
      'sequence':geneSequence.replace(/\s/g,''),
      'isoFormSequence':isoFormSequence.replace(/\s/g,''),
      'geneId':geneID,
      'name':gene
    }
    browser.close();
    let insertQuery = "insert into gene_info (name,isoForm,isoFormSequence,isoForms,url,sequence,time,geneId) VALUES (?,?,?,?,?,?,?,?)";
    let isoKeys = Object.keys(isoFormInfo);
    for(let i=0;i<isoKeys.length;i++){
      await pool.execute(insertQuery,[
        gene,
        isoKeys[i],
        isoFormInfo[isoKeys[i]].replace(/\s/g,''),
        JSON.stringify(isoFormNames),
        url,
        geneSequence.replace(/\s/g,''),
        today.getTime(),
        geneID
      ]); 
    }

    return info;
    
  } catch(e){
    console.log(e);
    return 'error';
  }
}
module.exports.searchForGene = searchForGene;

async function getIsoForm(isoForm) {
  console.log(isoForm);
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
    let testQuery,testQueryResults;
    
    testQuery = "SELECT * FROM gene_info WHERE gene_info.isoForm LIKE ? ";
    testQueryResults = await pool.execute(testQuery,[
      isoForm
    ]);
    console.log(testQueryResults[0][0]);
    return testQueryResults[0][0];
    
  } catch(e){
    console.log(e);
  }
}
module.exports.getIsoForm = getIsoForm;


async function searchForTargets(targetArea) {
   console.log('target area: ',targetArea)
    try {
      let browser = await puppeteer.launch({headless:true,args: [
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
      await page.setDefaultTimeout(0); 
      await page.goto('http://targetfinder.flycrispr.neuro.brown.edu/');
      
      await page.select('select[name="genomeSelect"]', 'Dmelvc9');
      await page.type('#gDNA-form',targetArea);
      await page.click('button[name="routingVar"]');
      await page.waitForSelector('button[name="routingVar"]');
      await page.click('button[name="routingVar"]');
      await page.waitForSelector('.result',{timout:0});

      let isoForms = await page.$$eval('.result',elements=> elements.map(item=>item.textContent));
      
      let offTargets = await page.$$eval('.result > span:nth-of-type(2)',elements=> elements.map(item=>{
        if(!item.innerText.includes('Exact')){
          return item.innerText;
        }}));
      console.log('offtargets',offTargets);
      let distals = await page.$$eval('.result tbody tr:nth-of-type(1) .distal',elements=> elements.map(item=>item.innerText));
      let proximals = await page.$$eval('.result tbody tr:nth-of-type(1) .proximal',elements=> elements.map(item=>item.innerText));
      let pams = await page.$$eval('.result tbody tr:nth-of-type(1) .pam',elements=> elements.map(item=>item.innerText));
      let strands = await page.$$eval('.result tbody tr:nth-of-type(1) td:nth-of-type(2)',elements=> elements.map(item=>item.innerText));
      let labels = await page.$$eval('.result .target-label',elements=> elements.map(item=>item.innerText));
      browser.close();
      let results = [];
      let targets = [];
      for(let i=0;i< isoForms.length;i++){
        if(offTargets[i]==null){
          offTargets.splice(i,1);
          console.log(offTargets);
        }
        console.log(offTargets[i]);
        let offTarget = !offTargets[i]?null:offTargets[i].split(' ')[0];
        results.push({
          'offtarget':offTarget,
          'distal':distals[i],
          'proximal':proximals[i],
          'pam':pams[i],
          'strand':strands[i],
          'label':labels[i]
        });
        targets.push(proximals[i]+distals[i]);
      }
      console.log(results);
      return {
        'results':results,
        'targets':encodeURIComponent(targets.join('\n'))
      }
  }catch(e){
    console.log(e);
  }
}
module.exports.searchForTargets = searchForTargets;

async function checkTargetEfficiency(targets) {
  console.log('targets',targets);
  try {
    let browser = await puppeteer.launch({headless:true,args: [
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
    await page.goto('http://www.flyrnai.org/evaluateCrispr/');
    await page.type('#textAreaInput',targets);
    await page.click('input[value="Display Results"]');
    await page.waitForSelector('#dataTable');
    let targetList = await page.$$eval('#dataTable tr td:nth-of-type(2)',elements=> elements.map(item=>item.innerText));
    let scores = await page.$$eval('#dataTable tr td:nth-of-type(9)',elements=> elements.map(item=>item.innerText));
    let results = {};
    browser.close();
    for(let i=0;i<targetList.length;i++){
      results[targetList[i]] = scores[i];
    }
    console.log(results);
    return results;
  } catch(error) {
    return error;
  }
}
module.exports.checkTargetEfficiency = checkTargetEfficiency;

async function getOligos(target) {
  console.log(target);
  try {
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
    await page.goto('http://targetfinder.flycrispr.neuro.brown.edu/');
    await page.select('select[name="genomeSelect"]', 'Dmelvc9');
    await page.type('#gDNA-form',target);
    await page.click('button[name="routingVar"]');
    await page.waitForSelector('button[name="routingVar"]');
    await page.click('button[name="routingVar"]');
    await page.waitForSelector('.target-checkbox');
    await page.click('.target-checkbox');
    await page.click('button[name="routingVar"]');
    await page.waitForSelector('.oligo-order');
    let oligos = await page.$eval('.oligo-order',res=>res.innerText);
    let senseText = oligos.split('\n')[0].split('Sense oligo: ')[1];
    let antisenseText = oligos.split('\n')[1].split('Antisense oligo: ')[1];
    browser.close();
    return {
      'sense':senseText,
      'antisense':antisenseText
    };
  } catch(error) {
   return error;
  }
}
module.exports.getOligos = getOligos;

async function getPrimers(primerSections) {
  let primers = {};
  const url = 'http://bioinfo.ut.ee/primer3-0.4.0/';
  console.log(primerSections);
  let browser = await puppeteer.launch({headless:true,args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--single-process', // <- this one doesn't works in Windows
    '--disable-gpu'
  ]});
  for(let i=0;i<4;i++){
    let currentPrimer = !primers['hom5']?"5' Homology":!primers['seq5']?"5' Sequence":!primers['seq3']?"3' Sequence":"3' Homology";
    let primerSection = primerSections[currentPrimer];
    let primerSide = currentPrimer==="3' Homology"?'input[name="MUST_XLATE_PICK_LEFT"]':currentPrimer==="3' Sequence"?'input[name="MUST_XLATE_PICK_LEFT"]':'input[name="MUST_XLATE_PICK_RIGHT"]';
    console.log(primerSection);
    try {
     
      
      let page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36');
      await page.goto(url);
      
      /*await page.select('select[name="genomeSelect"]', 'Dmelvc9');
      await page.type('#gDNA-form',target);
      await page.click('button[name="routingVar"]');
      await page.waitForSelector('button[name="routingVar"]');
      await page.click('button[name="routingVar"]');
      await page.waitForSelector('.target-checkbox');
      await page.click('.target-checkbox');
      await page.click('button[name="routingVar"]');
      await page.waitForSelector('.oligo-order');*/
      await page.waitForSelector('textarea[name="SEQUENCE"]')
      await page.type('textarea[name="SEQUENCE"]', primerSection);
      await page.click(primerSide);
      await page.click('input[name="Pick Primers"]')
      await page.waitForSelector('a[href="/primer3-0.4.0/primer3_www_results_help.html#PRIMER_OLIGO_SEQ"]');
      let primersText = await page.$eval('pre:first-of-type',res=>res.innerText);
      console.log(primersText);
      let primerStart = [];
      let stop = 0;
      let finalStop = 0;
      for(let i=0;i<primersText.length;i++) {
        if(primersText.slice(i,i+6)==='PRIMER'){
          primerStart.push(i);
        } else if(primersText.slice(i,i+13)==='SEQUENCE SIZE') {
          stop = i;
        } else if(primersText.slice(i,i+10)==='Statistics') {
          finalStop = i;
        }
      }

      const firstPrimer = primersText.slice(primerStart[0],stop).replace(/[\n\r]/g,'').split(' ').filter((el)=>{return el != ''});
      let allPrimers = [firstPrimer];
      for(let i=1;i<primerStart.length;i++){
        const primer = primersText.slice(primerStart[i],!primerStart[i+1]?finalStop:primerStart[i+1]).replace(/[\n\r]/g,'').split(' ').filter((el)=>{return el != ''});
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
  browser.close();
  return primers;
}
module.exports.getPrimers = getPrimers;