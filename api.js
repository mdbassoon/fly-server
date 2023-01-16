const fs = require('fs');
const mysql = require('mysql2/promise');
const local = require('./.env.js');
const fetch =  require("node-fetch");

async function getIdFromSearch(searchTerm){
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
    let data = await fs.readFileSync('./fb_synonyms.tsv', 'utf8');
    let lines = data.split('\n');
    let relevantData = [];
    lines.map((row,i)=>{
        if(i>5){
            let cells = row.split('\t');
            if(cells[1]=='Dmel'&&cells[4]!=''&&cells[5]!=''){
                let obj = {
                    primary_FBid:cells[0],
                    organism_abbreviation:cells[1],
                    current_symbol:cells[2],
                    current_fullname:cells[3],
                    fullname_synonyms:cells[4],
                    symbol_synonyms:cells[5],
                }
                relevantData.push(obj);
            }
        }
    });
    let result = relevantData.filter(obj => {
        return obj.current_symbol.toLowerCase()==searchTerm.toLowerCase();
    });
    let response = {results:{isoforms:null}};
    if(!result.length){
        return response;
    }

    let idQuery = "SELECT * FROM isoforms WHERE id = ?";
    let idQueryResults = await pool.execute(idQuery,[
        result[0].primary_FBid
    ]);
    console.log('in database ',idQueryResults[0]);

    if(idQueryResults[0].length!=0){
        response = {results:{name:searchTerm,id:result[0].primary_FBid,isoforms:idQueryResults[0][0].isoforms}};
    } else {
        let geneInfo = await getGeneticInfoFromId(result[0].primary_FBid);
        if(geneInfo){
            response = {results:{name:searchTerm,id:result[0].primary_FBid,isoforms:geneInfo}};
        }
    }

    return response;
}
async function getGeneticInfoFromId(id){
    let url = 'https://api.flybase.org/api/1.0/sequence/id/'+id+'/CDS';
    console.log(url);
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
    let response = await fetch(url);
    let data = await response.json();
    
    console.log(data);
    let results = data.resultset.result;
    let isoForms = results.map((result)=>{
        let name = result.description.split('name=')[1].split(';')[0];
        return name;
    });
    console.log(isoForms);
    let isoFormQuery = "INSERT INTO isoforms(id,isoforms) values(?,?)";
    await pool.execute(isoFormQuery,[
    id,JSON.stringify(isoForms)
    ]);
    results.map(async (result)=>{
        let name = result.description.split('name=')[1].split(';')[0];
        let locSplit = result.description.split('loc=')[1];
        let locStrand = locSplit.includes('complement')?'-':'+';
        let locInfo = locSplit.split(')')[0];
        let locDes = locInfo.split(':')[0];
        let locStart = locInfo.split('join(')[1].split('..')[0];
        let locEnd = locInfo.split('..').slice(-1)[0];
        console.log(name,'\n',locStrand,'\n',locDes,'\n',locStart,'\n',locEnd);
        let geneQuery = "INSERT INTO gene_info(isoForm,sequence,geneId,strand,locStart,locEnd,locDesc,upstream,downstream) values(?,?,?,?,?,?,?,'','')";
        await pool.execute(geneQuery,[
        name,result.sequence,result.id,locStrand,locStart,locEnd,locDes
        ]);
    });
    return JSON.stringify(isoForms);
}
async function getIsoFormSequence(isoForm){
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
    let isoformQuery = "SELECT * FROM gene_info WHERE isoForm = ?";
    let geneInfoQuery = await pool.execute(isoformQuery,[
    isoForm
    ]);
    //console.log(geneInfoQuery[0]);
    let geneInfo = geneInfoQuery[0][0];
    let upstream = geneInfo.upstream;
    let downstream = geneInfo.downstream;
    if(upstream!=''&&downstream!=''){
        return geneInfo;
    } else {
        let location = geneInfo.locDesc+':'+geneInfo.locStart+'..'+geneInfo.locEnd;
        let strand = geneInfo.strand=="-"?'minus':'plus';
        let url = "https://api.flybase.org/api/v1.0/sequence/region/dmel/"+location+"?strand="+strand+"&padding=2000";
        //console.log(url);
        let response = await fetch(url)
        let data = await response.json();
        //console.log(data.resultset.result);
        let sequence = data.resultset.result[0].sequence;
        let upstream = sequence.substring(0,2000);
        let downstream = sequence.substring(sequence.length-2000);
        let paddingQueryStr = "UPDATE gene_info SET upstream = ?, downstream = ? WHERE isoForm = ?";
        await pool.query(paddingQueryStr,[
            upstream.toString(),downstream.toString(),isoForm.toString()
        ]);
        let mainQueryStr = "SELECT * FROM gene_info WHERE isoForm = ?";
        let mainQuery = await pool.query(mainQueryStr,[
            isoForm
        ]);
        return mainQuery[0][0];
    }
}

module.exports.getIdFromSearch = getIdFromSearch;
module.exports.getIsoFormSequence = getIsoFormSequence;
