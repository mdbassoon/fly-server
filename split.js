let string = 'pins-PA type=CDS; loc=3R:join(27583088..27584374,27584633..27585322); name=pins-RA; dbxref=FlyBase:FBpp0084559,FlyBase_Annotation_IDs:CG5692-PA,REFSEQ:NP_524999,GB_protein:AAF56721,UniProt/TrEMBL:Q9VB22,FlyMine:FBpp0084559,modMine:FBpp0084559; MD5=44c9b90c39b289e0c51f1725d2bd902a; length=1977; parent=FBgn0040080,FBtr0085189; release=r6.49; species=Dmel; ';
let locSplit = string.split('loc=')[1];
console.log(locSplit);
let locStrand = locSplit.includes('complement')?'-':'+';
let locInfo = locSplit.split(')')[0];
let locDes = locInfo.split(':')[0];
let locStart = locInfo.split('join(')[1].split('..')[0];
let locEnd = locInfo.split('..').slice(-1)[0];
console.log(locInfo,'\n',locStrand,'\n',locDes,'\n',locStart,'\n',locEnd);
