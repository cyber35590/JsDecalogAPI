var util= require('util');
const request = require('sync-request');
var cheerio = require("cheerio");
const fs = require("fs")

const IMAGES_PATH_LOCAL="./"
const IMAGES_PATH_URL="/"

function getFilesizeInBytes(filename) {
  try{
    const stats = fs.statSync(filename);
    const fileSizeInBytes = stats.size;
    return fileSizeInBytes;
  }catch(e)
  {
    return -1
  }
}


class Exemplaire
{
  constructor(data)
  {
    Object.assign(this,{
      record: {
        titre: data.bibRecord.title,
        auteur: data.bibRecord.responsibles,
        editeur: data.bibRecord.editor,
        periodique: data.bibRecord.periodical,
        isbn: data.bibRecord.commercialCode,
        disponible: data.loanStatus=="AVAILABLE",
        cote: data.cote,
        support: data.support.name,
        public: data.targetAudience.name,
        localisation: data.localization.name,
        images: null,
      },
      id: data.bibRecord.id,
      images: {
        large: null,
        medium: null,
        small: null,
        best: null
      },
      isValid: false,
      data: data
    })
    this.findCover()
    this._check()
  }

  _check()
  {
    if(!this.record.titre || !this.record.isbn || !this.images.best || !this.record.disponible) return;
    this.isValid=true
  }

  findCover()
  {
    var ret = request('GET', 'http://mediatheque.lhermitage.opac3d.fr/search.php?action=Record&id='+this.id)
    var $ = cheerio.load(ret.body.toString('utf-8'));
    var fs = require("fs")
    this.images.large = $("#bbimages-"+this.id).find("div[class='large']").html()
    if(this.images.large) this.images.best=this.images.large

    this.images.medium = $("#bbimages-"+this.id).find("div[class='medium']").html()
    if(!this.images.best && this.images.medium) this.images.best=this.images.medium

    this.images.small = $("#bbimages-"+this.id).find("div[class='small']").html()
    if(!this.images.best && this.images.small) this.images.best=this.images.small

  }


  downloadCover()
  {
    if(!this.images.best)
    {
      console.log("Unable to find cover for ISBN="+this.record.isbn)
      return;
    }
    var path = IMAGES_PATH_LOCAL+this.record.isbn+".jpg"
    this.record.image=IMAGES_PATH_URL+this.record.isbn+".jpg"


    if(getFilesizeInBytes(path)>0) return;
    var ret = request('GET', this.images.best);
    if(ret.statusCode==200 &&
        (ret.headers["content-type"]=="image/jpeg" || ret.headers["Content-Type"]=="image/jpeg"))
    {
      fs.writeFileSync(path, ret.body)
    }else{
      console.log("Error getting '"+this.images.best+"' code:"+ret.statusCode)
    }

  }
}

module.exports=Exemplaire
