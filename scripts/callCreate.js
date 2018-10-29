const fs = require("fs")
const path = require("path")
const proxyFile = path.join(__dirname, "../files","proxy.txt")
const url = "http://localhost:16000/proxy/add?proxy="
const exec = require("child_process").exec

if (fs.existsSync(proxyFile)){
    let content = fs.readFileSync(proxyFile).toString()
	for (let line of content.split("\n")){
		try {
			exec(`curl "${url}${line}"`, function(err, status){
                console.log(err || status)
                if (err) console.log(err)
            })
		} catch(err){
			console.log(err)
		}
	}
} else {
    console.log("file not exists")
}
