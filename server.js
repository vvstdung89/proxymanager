var express    = require('express');        
var app        = express();                 
var http = require('http');
var router = express.Router(); 
const poolProxy = require("./poolProxy")
app.use("/", router);

router.get("/proxy/add", require("./api").add)
router.get("/proxy/show", require("./api").show)
router.get("/proxy/stats", require("./api").stats)
router.get("/proxy/get", require("./api").get)
router.get("/proxy/remove", require("./api").remove)

// Create http server
function createServerHTTP(port){
	var httpServer = http.createServer(app);
	httpServer.listen(port)
	.once('error', function (err) {
		if (err.code == 'EADDRINUSE') {
			console.log("Cannot use this port:" +port + ":"+ err.code)
			process.exit(-1)
		}
	})
	.once('listening', function() {
		console.log("Start http listening " + port + " ... ");
	});
}

createServerHTTP((16000));

//read file
const fs = require("fs")
const path = require("path")
const proxyFile = path.join(__dirname, "files","proxy.txt")
console.log(proxyFile)
if (fs.existsSync(proxyFile)){
	let content = fs.readFileSync(proxyFile).toString()
	for (let line of content.split("\n")){
		try {
			poolProxy.createNewProxy(line.trim())
		} catch(err){
			console.log(err)
		}
	}
}




