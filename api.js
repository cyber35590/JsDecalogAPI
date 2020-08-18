const DecalogSession = require("./session")

var y = DecalogSession.new();
var ret = y.search("0013119503")
ret.data.cote="AZERTY"
y.modify(ret.data)


console.log(ret)
