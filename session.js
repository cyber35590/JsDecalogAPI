const fs = require("fs")
var querystring = require("querystring");
var util= require('util');
const request = require('sync-request');
const DecalogError = require("./errors")
//var htmlparser = require("htmlparser2");

const Exemplaire = require("./exemplaire")
var cheerio = require("cheerio");

function isArray(obj){
    return !!obj && obj.constructor === Array;
}

function isObject(obj){
    return !!obj && obj.constructor === Object;
}


function extractDecalogData(html)
{
  var $ = cheerio.load(html);
  var out={}
  out.lt=$("input[name='lt']").attr("value")
  out.url=$("form").attr("action")
  return out
}

function toString(x)
{
  if(x instanceof Object)
    return JSON.stringify(x)
  return x+"";
}

var config = JSON.parse(fs.readFileSync("user.json", "utf8"))


function _url(path="/", attr=null)
{
  var url= "";
  if(attr)
  {
    var keys=Object.keys(attr)
    url+="?"
    for (var i=0; i<keys.length; i++) {
      url +=encodeURIComponent(keys[i])+"="+encodeURIComponent(attr[keys[i]]);
      if(i<keys.length-1) url+="&"
    }
  }
  return url;
}

function _parseCookie(str, obj)
{
  var x = str.indexOf("=");
  var y = str.indexOf(";");
  var key = str.substring(0, x)
  var val = str.substring(x+1, y)
  obj[key]=val
}

function postData(attr)
{
  var keys=Object.keys(attr)
  var out=""
  for(var i=0; i<keys.length; i++)
  {
    out+=keys[i]+"="+encodeURIComponent(toString(attr[keys[i]]))
    if(i<keys.length-1) out+="&"
  }
  return out;
}

function parseCookies(req)
{
  var ret={}
  for(var i=0; i<req.headers["set-cookie"].length; i++)
  {
    _parseCookie(req.headers["set-cookie"][i], ret)
  }
  return ret
}

function cookieFormat(attr)
{
  var keys=Object.keys(attr)
  var out=""
  for(var i=0; i<keys.length; i++)
  {
    out+=keys[i]+"="+attr[keys[i]]
    if(i<keys.length-1) out+="; "
  }
  return out;
}


class DecalogSession
{

  constructor(cfg={})
  {
  var c = Object.assign({}, config);
  Object.assign(c, cfg)
    Object.assign(this,{
        cookies: {
          eppk: null,
          JSESSIONID: null,
          ticket: null
        },
        authUrl:null,
        config: c,
        state: DecalogSession.STATE_UNCONNECTED
    })
  }

  url(path="/", attr=null)
  {
    var url= this.config.url+path;
    if(attr)
    {
      var keys=Object.keys(attr)
      url+="?"
      for (var i=0; i<keys.length; i++) {
        url += encodeURIComponent(keys[i])+"="+encodeURIComponent(attr[keys[i]]);
        if(i<keys.length-1) url+="&"
      }
    }
    return url;
  }



  _connectInit()
  {
    var url =   this.url("/cas/login", {service: "https://sigb02.decalog.net/index.php?_action_=auth"})
    var res = request('GET',
      url,
      {
        headers:{
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:66.0) Gecko/20100101 Firefox/66.0",
          "Accept" : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          'content-type': 'application/x-www-form-urlencoded',
          "Connection": "close",
          'Upgrade-Insecure-Requests': '1',
          'Referer': 'https://sigb02.decalog.net/cas/login?service=https%3A%2F%2Fsigb02.decalog.net%2Findex.php%3F_action_%3Dauth',
          'Accept-Language': 'fr,fr-FR;q=0.8,en-US;q=0.5,en;q=0.3'
        },
        followRedirects: false
      })





    if(res.statusCode==200)
    {
      var cookie = parseCookies(res)
      if(!cookie.JSESSIONID)
      {
        return new DecalogError(DecalogError.ERROR_DATA, res, "Le cookie JSESSIONID n'est pas présent dans la réponse")
      }
      this.cookies.JSESSIONID=cookie.JSESSIONID

      return new DecalogError(DecalogError.SUCCESS, res)
    }
    else
    {
      return new DecalogError(DecalogError.ERROR_STATUS,  res, "Status: "+res.statusCode)
    }
  }

  _connectTicket(url, lt)
  {
    var data=postData({
      username: this.config.user,
      password: this.config.password,
      lt: lt,
      submit: "SE+CONNECTER",
      _eventId: "submit"
    });
    var u = this.config.url+url
    var res = request('POST',
      u,
      {
        headers:{
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:66.0) Gecko/20100101 Firefox/66.0",
          "Accept" : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          'content-type': 'application/x-www-form-urlencoded',
          "Connection": "close",
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Content-Length' : data.length,
          'DNT' : '1',
          'Accept-Language': 'fr,fr-FR;q=0.8,en-US;q=0.5,en;q=0.3' ,
          "Cookie": cookieFormat({JSESSIONID: this.cookies.JSESSIONID})
        },
        body: data,
        followRedirects: false
      })

    if(res.statusCode==302)
    {
      if(!res.headers.location)
      {
          return new DecalogError(DecalogError.ERROR_DATA, res, "La réponse ne donne pas de redirection")
      }
      this.authUrl=res.headers.location
      return new DecalogError(DecalogError.SUCCESS, res)
    }
    else
    {
      return new DecalogError(DecalogError.ERROR_STATUS,  res, "Status: "+res.statusCode+" must be 302")
    }

    return res
  }

  _connectAuth()
  {
    var res = request('GET',
      this.authUrl,
      {
        headers:{
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:66.0) Gecko/20100101 Firefox/66.0",
          "Accept" : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          'content-type': 'application/x-www-form-urlencoded',
          "Connection": "close",
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'DNT' : '1',
          'Accept-Language': 'fr,fr-FR;q=0.8,en-US;q=0.5,en;q=0.3' ,
          "Cookie": cookieFormat({JSESSIONID: this.cookies.JSESSIONID})
        },
        followRedirects: false
      })

    if(res.statusCode==302)
    {
      var cookie = parseCookies(res)
      if(!cookie.eppk)
      {
        return new DecalogError(DecalogError.ERROR_DATA, res, "Le cookie eppk n'est pas présent dans la réponse")
      }
      this.cookies.eppk=cookie.eppk

      return new DecalogError(DecalogError.SUCCESS, res)
    }
    else
    {
      return new DecalogError(DecalogError.ERROR_STATUS,  res, "Status: "+res.statusCode+" must be 302")
    }

    return res
  }



  _connectValid()
  {
    var res = request('GET',
      this.url('/index.php', {_action_: "change_workspace"}),
      {
        headers:{
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:66.0) Gecko/20100101 Firefox/66.0",
          "Accept" : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          'content-type': 'application/x-www-form-urlencoded',
          "Connection": "close",
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'DNT' : '1',
          'Accept-Language': 'fr,fr-FR;q=0.8,en-US;q=0.5,en;q=0.3' ,
          "Cookie": cookieFormat({eppk: this.cookies.eppk})
        }
      })

    return res
  }




  connect()
  {
    var res = this._connectInit().test()
    var obj =extractDecalogData(res.body.toString('utf-8'));
    res = this._connectTicket(obj.url, obj.lt).test();
    res = this._connectAuth().test();
    res = this._connectValid();
    this.state=DecalogSession.STATE_CONNECTED
  }

  _modifyInit(js)
  {
    var url =   this.url("/index.php", {_action_: "backend"})
    var rawdata = {
      path: "/networks/"+this.config.network+"/libraries/"+this.config.library+"/catalog/bibRecords/items/job/addOrUpdate",
      operation: "UPDATE",
      libraryId: "3746240580644341020",
      bibrecordId: "343263985620135564",
      addOrUpdateForm: JSON.stringify(js),
      jsonParams: "addOrUpdateForm"
    }
    var data = postData(rawdata)



    var res = request('POST', url,
      {
        headers: {'content-type' : 'application/x-www-form-urlencoded',
                  'Cookie': 'eppk='+this.cookies.eppk},
        body:  data
      });

    if(res.statusCode>=500)
    {
      this.state=DecalogSession.STATE_DISCONNECTED
      return null
    }

    return JSON.parse(res.body.toString("utf-8"))
  }

  _modifyProgress(id)
  {
    var url =   this.url("/index.php", {
      _action_: "backend",
      path: "/networks/"+this.config.network+"/libraries/"+this.config.library+"/catalog/bibRecords/items/job/addOrUpdate/"+id+"/progress"
    })

    var res = request('GET',url,
    {
      headers: {'content-type' : 'application/x-www-form-urlencoded',
                'Cookie': 'eppk='+this.cookies.eppk}
    });

    if(res.statusCode>=500)
    {
      this.state=DecalogSession.STATE_DISCONNECTED
      return null
    }

    return JSON.parse(res.body.toString("utf-8"))
  }

  _modifyData(id)
  {
    var url =   this.url("/index.php", {
      _action_: "backend",
      path: "/networks/"+this.config.network+"/libraries/"+this.config.library+"/catalog/bibRecords/items/job/addOrUpdate/"+id+"/result"
    })
    var res = request('GET', url,
    {
      headers: {'content-type' : 'application/x-www-form-urlencoded',
                'Cookie': 'eppk='+this.cookies.eppk}
    });

    if(res.statusCode>=500)
    {
      this.state=DecalogSession.STATE_DISCONNECTED
      return null
    }

    return JSON.parse(res.body.toString("utf-8"))
  }

  modify(data)
  {
    var ndata={}
    var fields = [
       "id", "code",    "depositaryLibraryId",   "cote",  "price", "discount",
       "discountedPrice",  "creationDate",   "publicAvailableDate", "note",
       "isNew", "isCreatedAsNew", "itemClassifications"
    ]
    for(var i=0; i<fields.length; i++)
    {
      if(!(fields[i] in data))
      {
        throw fields[i]+' not in data';
      }
      ndata[fields[i]]=data[fields[i]]
    }
    var fieldsId = ["localization", "subLocalization", "support", "targetAudience", "loanCategory",
            "status", "owner", "collectionPeriodical", "targetOwner", "budgetLine", "provider" ]
    for(var i =0; i<fieldsId.length; i++)
    {
      if(data[fieldsId[i]]!=null){
        ndata[fieldsId[i]+"Id"] = data[fieldsId[i]] ? data[fieldsId[i]].id : null;
      }
    }
    ndata.computeIsNewPeriodAgain=null;
    ndata.checkPeriodicalCoherency=true
    ndata.trap=data.bibRecord.trap



    var id=0
    var res = this._modifyInit(ndata)
    if(res==null)
    {
      return new DecalogError(DecalogError.ERROR_DISCONNECTED, res, "La session n'est plus valide")
    }else if(res.success!=true)
    {
      console.log("Error")
    }
    id=res.res.executionId
    while(true)
    {
      res = this._modifyProgress(id);
      if(res==null)
      {
        return new DecalogError(DecalogError.ERROR_DISCONNECTED, res, "La session n'est plus valide")
      }else if(res.success!=true)
      {
        console.log("Erreur de recherche: "+JSON.stringify(res))
      }
      if(res.res.execution.status=="COMPLETED" && !res.res.execution.running) break;
    }

    res=this._modifyData(id)
    if(res==null)
    {
      return new DecalogError(DecalogError.ERROR_DISCONNECTED, res, "La session n'est plus valide")
    }
    var ret = []
    var tmp = res.res;
    if (tmp.length==1 && res.success)
    {
      return new Exemplaire(tmp[0])
    }
    if(tmp.length>1)
    {
      console.log("Error code '"+code+"' is not unique")
      return new DecalogError(DecalogError.ERROR_NON_UNIQUE_CODE, res, "Le code barre n'est pas unique")
    }
    return null;
  }


   _searchInit(code)
  {
    var url =   this.url("/index.php", {_action_: "backend"})
    var rawdata = {
      path: "/networks/"+this.config.network+"/libraries/"+this.config.library+"/catalog/item/search/fulltext",
      criteria: {"code":code,"networkId":this.config.network,"sort":"code","dir":"ASC","start":0,"limit":20},
      jsonParams: "criteria"
    }
    var data = postData(rawdata)

    var res = request('POST', url,
      {
        headers: {'content-type' : 'application/x-www-form-urlencoded',
                  'Cookie': 'eppk='+this.cookies.eppk},
        body:  data
      });

    if(res.statusCode>=500)
    {
      this.state=DecalogSession.STATE_DISCONNECTED
      return null
    }

    return JSON.parse(res.body.toString("utf-8"))
  }

   _searchProgress(id)
  {
    var url =   this.url("/index.php", {
      _action_: "backend",
      path: "/networks/"+this.config.network+"/libraries/"+this.config.library+"/catalog/item/search/"+id+"/progress"
    })

    var res = request('GET',url,
    {
      headers: {'content-type' : 'application/x-www-form-urlencoded',
                'Cookie': 'eppk='+this.cookies.eppk}
    });

    if(res.statusCode>=500)
    {
      this.state=DecalogSession.STATE_DISCONNECTED
      return null
    }

    return JSON.parse(res.body.toString("utf-8"))
  }



  _searchData(id)
  {
    var url =   this.url("/index.php", {
      _action_: "backend",
      path: "/networks/"+this.config.network+"/libraries/"+this.config.library+"/catalog/item/search/"+id+"/result/data"
    })
    var res = request('GET', url,
    {
      headers: {'content-type' : 'application/x-www-form-urlencoded',
                'Cookie': 'eppk='+this.cookies.eppk}
    });

    if(res.statusCode>=500)
    {
      this.state=DecalogSession.STATE_DISCONNECTED
      return null
    }

    return JSON.parse(res.body.toString("utf-8"))
  }

  search(code)
  {
    var id=0
    var res = this._searchInit(code)
    if(res==null)
    {
      return new DecalogError(DecalogError.ERROR_DISCONNECTED, res, "La session n'est plus valide")
    }else if(res.success!=true)
    {
      console.log("Error")
    }
    while(true)
    {
      id=res.res.executionId
      res = this._searchProgress(id);
      if(res==null)
      {
        return new DecalogError(DecalogError.ERROR_DISCONNECTED, res, "La session n'est plus valide")
      }else if(res.success!=true)
      {
        console.log("Erreur de recherche: "+JSON.stringify(res))
      }
      if(res.res.execution.status=="COMPLETED" && !res.res.execution.running) break;
    }

    res=this._searchData(id)
    if(res==null)
    {
      return new DecalogError(DecalogError.ERROR_DISCONNECTED, res, "La session n'est plus valide")
    }
    var ret = []
    var tmp = res.res.list;
    if (tmp.length==1)
    {
      return new Exemplaire(tmp[0])
    }
    if(tmp.length>1)
    {
      console.log("Error code '"+code+"' is not unique")
      return new DecalogError(DecalogError.ERROR_NON_UNIQUE_CODE, res, "Le code barre n'est pas unique")
    }
    return null;
  }


}


DecalogSession.STATE_UNCONNECTED="STATE_UNCONNECTED"
DecalogSession.STATE_CONNECTED="STATE_CONNECTED"
DecalogSession.STATE_DISCONNECTED="STATE_DISCONNECTED"

module.exports=
{
  new: function(){
    var dk = new DecalogSession()
    dk.connect()
    return dk;
  }
}
