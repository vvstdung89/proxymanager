
var ip
const execSync = require("child_process").execSync
exports = module.exports = {
	getIP: function(){
		if (!ip){
			ip = execSync('curl -s "ipv4.google.com/sorry/index" | grep -oE "([0-9]{1,3}\\.){3}[0-9]{1,3}"').toString().trim();
			return ip;
		} else {
			return ip;
		}
	}
}
