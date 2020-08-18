const fs = require("fs")
const { exec } = require('child_process');
const DecalogSession = require("./session")
var decalog = DecalogSession.new();
console.log("Nouvelle session")


var filelist = fs.readFileSync("modify", "utf-8").split("\n")


function dump(code, dir){
  var data = decalog.search(code)
  if(data==null){
    console.log("Supprimé....")
  }else{
    fs.writeFileSync(dir+code+".json", JSON.stringify(data.data, null, 2))
  }
}

function backup(){
  for(var i = 0; i<filelist.length-1; i++)
  {
    var code=filelist[i]
    console.log(code)
    dump(code, "before/")
  }
}


function remove_tiret(cote)
{
  var out=""
  for(var i=0; i<cote.length; i++){
    var c=cote[i]
    var last=out.length>0?out[out.length-1]:""
    if(c=="-" || c==" "){
      if(last!=" ") out+=" "
    }else{
      out+=c
    }
  }
  return out
}


function replace_tiret(cote)
{
  var out=""
  for(var i=0; i<cote.length; i++){
    var c=cote[i]
    var last=out.length>0?out[out.length-1]:""
    if(c=="-" || c==" "){
      if(last!="-") out+="-"
    }else{
      out+=c
    }
  }
  return out
}

function modify_from_file(file, fct=remove_tiret){
  var codelist = fs.readFileSync(file, "utf-8").split("\n")
  for(var i = 0; i<codelist.length-1; i++)
  {
    var code=codelist[i]
    var out=""
    for(var j=0; j<code.length; j++)
    {
      if("0123456789".search(code[j])<0 ){
        break;
      }
      out+=code[j]
    }
    modify(code, fct)
  }
}

function modify(code, fct=remove_tiret){
  console.log("\nModification de "+code)
  var data = decalog.search(code)
  fs.writeFileSync("before/"+code+".json", JSON.stringify(data.data, null, 2))
  if(data==null){
    console.log("Introuvbale dans la base de données ....")
  }else{
    console.log("Cote: "+data.data.cote)
    var cote=fct(data.data.cote)
    data.data.cote=cote
    var ndata = decalog.modify(data.data)
    dump(code, "after/")
    if(check(code)>1)
    {
      console.log("Erreur pour: "+code+" ("+data.data.cote+") : trop de modification pa rrapport à ce qui est prévu")
      console.log("Arrêt")
      throw "Erreur"
    }else{
      fs.unlinkSync("before/"+code+".json")
      fs.unlinkSync("after/"+code+".json")
      console.log("Document "+code+" ("+data.data.cote+"'), modification effectuée")
    }
  }
}


function check(code){
  var before =  fs.readFileSync("before/"+code+".json", "utf-8").split("\n")
  var after =  fs.readFileSync("after/"+code+".json", "utf-8").split("\n")
  var min = (before.length<after.length)?before.length:after.length;
  var n = before.length-after.length
  if(n<0) n=-n

  for(var i=0; i<min; i++)
  {
    if(before[i]!=after[i]){
      console.log("'"+before[i]+"' -> '"+after[i]+"'")
      n++
    }
  }
  return n
}

modify_from_file("modify")
