const Nightmare = require('nightmare');
async function searchForGene(gene) {
  try{
    const nightmare = Nightmare({ show: false });
    console.log('initiated');
    let res = await nightmare
    .goto('https://flybase.org')
    .wait('#GeneSearch')
    .insert('#GeneSearch', gene)
    .click('#GeneSearch_submit')
    .wait(4000, '#general_information','#genomic_location')
    .end()
    .evaluate(() => {
      const geneName = document.getElementById('general_information').nextElementSibling.nextElementSibling.nextElementSibling.nextElementSibling.nextElementSibling.nextElementSibling.nextElementSibling.children[0].children[1].innerText;
      const fastaButton = document.getElementById('genomic_location').nextElementSibling.nextElementSibling.nextElementSibling.children[0].children[1].children[0].children[1].children[0];
      const jbrowseButton = document.getElementById('genomic_location').nextElementSibling.nextElementSibling.nextElementSibling.nextElementSibling.children[0].children[0].children[0].children[1];
      const fastaUrl = fastaButton.href;
      const jbrowseUrl = jbrowseButton.href;
      const obj = {
        'fastaUrl':fastaUrl,
        'jbrowseUrl':jbrowseUrl,
        'geneName':geneName
      }
      return obj;
    });
    console.log('response',res);
    const fastaUrl = !res['fastaUrl']?'':res['fastaUrl'];
    const jbrowseUrl = !res['jbrowseUrl']?'':res['jbrowseUrl'];
    const geneName = !res['jbrowseUrl']?'':res['geneName'];
    return {fastaUrl:fastaUrl,jbrowseUrl:jbrowseUrl,geneTitle:geneName};
  }catch(error) {
    // console.log(error);
    return error;
  }
}
async function getMoreBases(url) {
  // console.log('getting bases');
  try {
    let nightmare = Nightmare({show: false}); 
    let geneInfo = await nightmare.goto(url).end().evaluate(()=>{
      const genes = document.getElementsByClassName('col-xs-12')[2].children[0].children;
      let geneArr = [];
      let geneColorArr = [];
      for(let i = 0;i<genes.length;i++){
        geneArr.push(genes[i].innerText.replace(/\s/g, ''));
        if(window.getComputedStyle(genes[i]).color) {
          geneColorArr.push(window.getComputedStyle(genes[i]).color);
        } else {
          geneColorArr.push(genes[i].style.color);
        }
      }
      return {'fullGene':document.getElementsByClassName('col-xs-12')[2].children[0].innerText.replace(/\s/g, ''),'geneSections':geneArr,'colorCode':geneColorArr};
    });
    const sections = geneInfo['geneSections'];
    let sectionStarts = [];
    let sectionStops = [];
    let geneSections = [];
    let geneColors = [];
    let sectionNames = [];
    let fullGene = geneInfo['fullGene'];

    for(let i=0;i<sections.length;i++){
      const start = geneInfo['fullGene'].search(sections[i]);
      const stop = start+sections[i].length;
      sectionStarts.push(start);
      sectionStops.push(stop);
    }
    const pre = fullGene.slice(0,sectionStarts[0]);
    for(let i=0;i<sectionStarts.length;i++){
      const start = sectionStarts[i];
      const stop = sectionStops[i];
      const nextStart = !sectionStarts[i+1]?fullGene.length:sectionStarts[i+1];
      const section = fullGene.slice(start,stop);
      const isPink = geneInfo['colorCode'][i].search(/rgb\(25/)>-1;
      const isBlue = geneInfo['colorCode'][i].search(/rgb\(0, 0, 2/)>-1;
      if(isPink){
        //Coding Region
        geneColors.push('rgb(55,114,255)')
        sectionNames.push('coding region');
        geneSections.push(section);
      } else if(isBlue) {

        if(fullGene[start] === fullGene[start].toUpperCase()){//If it's blue and first letters uppercase, it's a UTR
        // console.log('UTR: ');
        // console.log('multiple sections?: ',section.match(/[a-z]/g, "")?true:false);

          if(section.match(/[a-z]/g, "")){//if there is a lowercase section within this section, separate it out as a genespan. Multiple alternating sections possible.
            let lowerStarts = [0];
            let upperStarts = [section.search(/[a-z]/g, "")];
            for(let y=0;y<section.length;y++) {
              if(y>upperStarts[upperStarts.length-1]&&upperStarts[upperStarts.length-1]>lowerStarts[lowerStarts.length-1]&&section[y].match(/[A-Z]/g, "")){
                lowerStarts.push(y);
              } else if(y>lowerStarts[lowerStarts.length-1]&&lowerStarts[lowerStarts.length-1]>upperStarts[upperStarts.length-1]&&section[y].match(/[a-z]/g, "")) {
                upperStarts.push(y);
              }
            }
            // console.log(lowerStarts);
            // console.log(upperStarts);
            // console.log('total sections: ',lowerStarts.length>upperStarts.length?(lowerStarts.length*2)-1:lowerStarts.length*2);
            for(let y=0;y<lowerStarts.length;y++){
              if(!upperStarts[y]) {
                geneColors.push('rgb(19,111,99)');
                sectionNames.push('UTR');
                geneSections.push(section.split('').slice(lowerStarts[y],section.length).join(''));
                // console.log(y+': ', section.split('').slice(lowerStarts[y],section.length).join(''));
              } else {
                // console.log('lowerStart y: ', lowerStarts[y]);
                // console.log('upperStarts y: ', upperStarts[y]);
                geneColors.push('rgb(19,111,99)');
                sectionNames.push('UTR');
                geneSections.push(section.split('').slice( lowerStarts[y], upperStarts[y]).join(''));
                // console.log(y, section.split('').slice(lowerStarts[y], upperStarts[y]).join(''));

                // console.log('upperStarts y: ', upperStarts[y]);
                // console.log('lowerStarts y+1: ', lowerStarts[y+1]);
                
                geneColors.push('rgb(8,7,8)');
                sectionNames.push('geneSpan');
                geneSections.push(section.split('').slice(upperStarts[y], !lowerStarts[y+1]?section.length:lowerStarts[y+1]).join(''));
                // console.log(y+': ',section.split('').slice(upperStarts[y], !lowerStarts[y+1]?section.length:lowerStarts[y+1]).join(''))
              }
            }
          } else {
            geneColors.push('rgb(19,111,99)');
            sectionNames.push('UTR');
            geneSections.push(section);
          }
          /*geneColors.push('rgb(19,111,99)')
          sectionNames.push('UTR');
          geneSections.push(section);*/
        } else {   //genespan
          
          // console.log('gene span: ');
          // console.log('multiple sections?: ',section.match(/[A-Z]/g, "")?true:false);
          if(section.match(/[A-Z]/g, "")){//if there is an uppercase section within this section, separate it out as a UTR. Multiple alternating sections possible.
            let lowerStarts = [0];
            let upperStarts = [section.search(/[A-Z]/g, "")];
            for(let y=0;y<section.length;y++) {
              if(y>upperStarts[upperStarts.length-1]&&upperStarts[upperStarts.length-1]>lowerStarts[lowerStarts.length-1]&&section[y].match(/[a-z]/g, "")){
                lowerStarts.push(y);
               } else if(y>lowerStarts[lowerStarts.length-1]&&lowerStarts[lowerStarts.length-1]>upperStarts[upperStarts.length-1]&&section[y].match(/[A-Z]/g, "")) {
                upperStarts.push(y);
              }
            }
            // console.log(lowerStarts);
            // console.log(upperStarts);
            // console.log('total sections: ',lowerStarts.length>upperStarts.length?(lowerStarts.length*2)-1:lowerStarts.length*2);
            for(let y=0;y<lowerStarts.length;y++){
              if(!upperStarts[y]) {
                geneColors.push('rgb(8,7,8)');
                sectionNames.push('geneSpan');
                geneSections.push(section.split('').slice(lowerStarts[y],section.length).join(''));
                // console.log(y+': ', section.split('').slice(lowerStarts[y],section.length).join(''));
              } else {
                // console.log('lowerStart y: ', lowerStarts[y]);
                // console.log('upperStarts y: ', upperStarts[y]);
                geneColors.push('rgb(8,7,8)');
                sectionNames.push('geneSpan');
                geneSections.push(section.split('').slice( lowerStarts[y], upperStarts[y]).join(''));
                // console.log(y, section.split('').slice(lowerStarts[y], upperStarts[y]).join(''));

                // console.log('upperStarts y: ', upperStarts[y]);
                // console.log('lowerStarts y+1: ', lowerStarts[y+1]);
                geneColors.push('rgb(19,111,99)');
                sectionNames.push('UTR');
                geneSections.push(section.split('').slice(upperStarts[y], !lowerStarts[y+1]?section.length:lowerStarts[y+1]).join(''));
                // console.log(y+': ',section.split('').slice(upperStarts[y], !lowerStarts[y+1]?section.length:lowerStarts[y+1]).join(''))
              }
            }
          } else {
            geneColors.push('rgba(8,7,8)');
            sectionNames.push('geneSpan');
            geneSections.push(section);
          }
        }
      } else {
        geneColors.push('rgba(8,7,8,0.2)');
        sectionNames.push('unknown');
      }
      if(nextStart-1>stop&&i<sectionStarts.length-1){//If there is unwrapped space between the genetic information, it is the intergenic region
        geneSections.push(fullGene.slice(stop, nextStart));
        geneColors.push('rgba(8,7,8,0.4)');
        sectionNames.push('intergenic');
      }
    }
    return {
      geneSections:geneSections,
      fullGene:geneInfo['fullGene'].slice(pre.length,geneInfo['fullGene'].length),
      colorCode:geneColors,
      sectionNames:sectionNames,
      pre:pre,
    };
  } catch(error) {
    // console.log(error);
    return error;
  } 
}
async function getGeneInfo(url) {
  try {
    let nightmare = Nightmare({show: false}); 
    let geneInfo = await nightmare.goto(url).end().evaluate(()=>{
      const genes = document.getElementsByClassName('col-xs-12')[2].children[0].children;
      let geneArr = [];
      let geneColorArr = [];
      for(let i = 0;i<genes.length;i++){
        geneArr.push(genes[i].innerText.replace(/\s/g, ''));
        if(window.getComputedStyle(genes[i]).color) {
          geneColorArr.push(window.getComputedStyle(genes[i]).color);
        } else {
          geneColorArr.push(genes[i].style.color);
        }
      }
      return {'fullGene':document.getElementsByClassName('col-xs-12')[2].children[0].innerText.replace(/\s/g, ''),'geneSections':geneArr,'colorCode':geneColorArr};
    });
    const sections = geneInfo['geneSections'];
    let sectionStarts = [];
    let sectionStops = [];
    let geneSections = [];
    let geneColors = [];
    let sectionNames = [];
    let fullGene = geneInfo['fullGene'];

    for(let i=0;i<sections.length;i++){
      const start = geneInfo['fullGene'].search(sections[i]);
      const stop = start+sections[i].length;
      sectionStarts.push(start);
      sectionStops.push(stop);
    }
    const pre = fullGene.slice(0,sectionStarts[0]);
    for(let i=0;i<sectionStarts.length;i++){
      const start = sectionStarts[i];
      const stop = sectionStops[i];
      const nextStart = !sectionStarts[i+1]?fullGene.length:sectionStarts[i+1];
      const section = fullGene.slice(start,stop);
      const isPink = geneInfo['colorCode'][i].search(/rgb\(25/)>-1;
      const isBlue = geneInfo['colorCode'][i].search(/rgb\(0, 0, 2/)>-1;
      if(isPink){
        //Coding Region
        geneColors.push('rgb(55,114,255)')
        sectionNames.push('coding region');
        geneSections.push(section);
      } else if(isBlue) {

        if(fullGene[start] === fullGene[start].toUpperCase()){//If it's blue and first letters uppercase, it's a UTR
        // console.log('UTR: ');
        // console.log('multiple sections?: ',section.match(/[a-z]/g, "")?true:false);

          if(section.match(/[a-z]/g, "")){//if there is a lowercase section within this section, separate it out as a genespan. Multiple alternating sections possible.
            let lowerStarts = [0];
            let upperStarts = [section.search(/[a-z]/g, "")];
            for(let y=0;y<section.length;y++) {
              if(y>upperStarts[upperStarts.length-1]&&upperStarts[upperStarts.length-1]>lowerStarts[lowerStarts.length-1]&&section[y].match(/[A-Z]/g, "")){
                lowerStarts.push(y);
              } else if(y>lowerStarts[lowerStarts.length-1]&&lowerStarts[lowerStarts.length-1]>upperStarts[upperStarts.length-1]&&section[y].match(/[a-z]/g, "")) {
                upperStarts.push(y);
              }
            }
            // console.log(lowerStarts);
            // console.log(upperStarts);
            // console.log('total sections: ',lowerStarts.length>upperStarts.length?(lowerStarts.length*2)-1:lowerStarts.length*2);
            for(let y=0;y<lowerStarts.length;y++){
              if(!upperStarts[y]) {
                geneColors.push('rgb(19,111,99)');
                sectionNames.push('UTR');
                geneSections.push(section.split('').slice(lowerStarts[y],section.length).join(''));
                // console.log(y+': ', section.split('').slice(lowerStarts[y],section.length).join(''));
              } else {
                // console.log('lowerStart y: ', lowerStarts[y]);
                // console.log('upperStarts y: ', upperStarts[y]);
                geneColors.push('rgb(19,111,99)');
                sectionNames.push('UTR');
                geneSections.push(section.split('').slice( lowerStarts[y], upperStarts[y]).join(''));
                // console.log(y, section.split('').slice(lowerStarts[y], upperStarts[y]).join(''));

                // console.log('upperStarts y: ', upperStarts[y]);
                // console.log('lowerStarts y+1: ', lowerStarts[y+1]);
                
                geneColors.push('rgb(8,7,8)');
                sectionNames.push('geneSpan');
                geneSections.push(section.split('').slice(upperStarts[y], !lowerStarts[y+1]?section.length:lowerStarts[y+1]).join(''));
                // console.log(y+': ',section.split('').slice(upperStarts[y], !lowerStarts[y+1]?section.length:lowerStarts[y+1]).join(''))
              }
            }
          } else {
            geneColors.push('rgb(19,111,99)');
            sectionNames.push('UTR');
            geneSections.push(section);
          }
          /*geneColors.push('rgb(19,111,99)')
          sectionNames.push('UTR');
          geneSections.push(section);*/
        } else {   //genespan
          
          // console.log('gene span: ');
          // console.log('multiple sections?: ',section.match(/[A-Z]/g, "")?true:false);
          if(section.match(/[A-Z]/g, "")){//if there is an uppercase section within this section, separate it out as a UTR. Multiple alternating sections possible.
            let lowerStarts = [0];
            let upperStarts = [section.search(/[A-Z]/g, "")];
            for(let y=0;y<section.length;y++) {
              if(y>upperStarts[upperStarts.length-1]&&upperStarts[upperStarts.length-1]>lowerStarts[lowerStarts.length-1]&&section[y].match(/[a-z]/g, "")){
                lowerStarts.push(y);
               } else if(y>lowerStarts[lowerStarts.length-1]&&lowerStarts[lowerStarts.length-1]>upperStarts[upperStarts.length-1]&&section[y].match(/[A-Z]/g, "")) {
                upperStarts.push(y);
              }
            }
            // console.log(lowerStarts);
            // console.log(upperStarts);
            // console.log('total sections: ',lowerStarts.length>upperStarts.length?(lowerStarts.length*2)-1:lowerStarts.length*2);
            for(let y=0;y<lowerStarts.length;y++){
              if(!upperStarts[y]) {
                geneColors.push('rgb(8,7,8)');
                sectionNames.push('geneSpan');
                geneSections.push(section.split('').slice(lowerStarts[y],section.length).join(''));
                // console.log(y+': ', section.split('').slice(lowerStarts[y],section.length).join(''));
              } else {
                // console.log('lowerStart y: ', lowerStarts[y]);
                // console.log('upperStarts y: ', upperStarts[y]);
                geneColors.push('rgb(8,7,8)');
                sectionNames.push('geneSpan');
                geneSections.push(section.split('').slice( lowerStarts[y], upperStarts[y]).join(''));
                // console.log(y, section.split('').slice(lowerStarts[y], upperStarts[y]).join(''));

                // console.log('upperStarts y: ', upperStarts[y]);
                // console.log('lowerStarts y+1: ', lowerStarts[y+1]);
                geneColors.push('rgb(19,111,99)');
                sectionNames.push('UTR');
                geneSections.push(section.split('').slice(upperStarts[y], !lowerStarts[y+1]?section.length:lowerStarts[y+1]).join(''));
                // console.log(y+': ',section.split('').slice(upperStarts[y], !lowerStarts[y+1]?section.length:lowerStarts[y+1]).join(''))
              }
            }
          } else {
            geneColors.push('rgba(8,7,8)');
            sectionNames.push('geneSpan');
            geneSections.push(section);
          }
        }
      } else {
        geneColors.push('rgba(8,7,8,0.2)');
        sectionNames.push('unknown');
      }
      if(nextStart-1>stop&&i<sectionStarts.length-1){//If there is unwrapped space between the genetic information, it is the intergenic region
        geneSections.push(fullGene.slice(stop, nextStart));
        geneColors.push('rgba(8,7,8,0.4)');
        sectionNames.push('intergenic');
      }
    }
    return {
      geneSections:geneSections,
      fullGene:geneInfo['fullGene'].slice(pre.length,geneInfo['fullGene'].length),
      colorCode:geneColors,
      sectionNames:sectionNames,
      pre:pre,
    };
  } catch(error) {
    // console.log(error);
    return error;
  }   
}
async function searchForTargets(targetArea) {
  // console.log('target area: ',targetArea)
    try {
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
module.exports.searchForGene = searchForGene;
module.exports.getMoreBases = getMoreBases;
module.exports.getGeneInfo = getGeneInfo;
module.exports.searchForTargets = searchForTargets;
module.exports.checkTargetEfficiency = checkTargetEfficiency;
module.exports.getOligos = getOligos;
module.exports.getPrimers = getPrimers;

