var ProxyForwarder = require("./libs/ProxyForwarder");
var exec = require("child_process").exec;
var sem = require("semaphore")(1);

class Proxy {
  constructor(host_ip, host_port, proxy_ip, proxy_port, username, password) {
    this.host_ip = host_ip;
    this.host_port = host_port;
    this.proxy_ip = proxy_ip;
    this.proxy_port = proxy_port;
    this.username = username;
    this.password = password;
    this.closeNet = null;
    this.isError = true;
    this.checkStatusInterval = null;
    this.errorTime = 0
  }

  async init() {
    var self = this;
    let isReturn = false;

    new Promise(resolve => {
      ProxyForwarder(
        this.host_ip,
        this.host_port,
        this.proxy_ip,
        this.proxy_port,
        this.user,
        this.pass,
        async netServer => {
          if (isReturn) return; // already return (timeout)
          isReturn = true;
          this.closeNet = netServer;
          this.checkStatusInterval = setInterval(() => {
            this._checkStatus();
          }, 60 * 1000);
          resolve();
        }
      );
    });
  }

  isConnected() {
    if (this.closeNet) return true;
    else return false;
  }

  close() {
    if (this.closeNet) {
      this.closeNet();
      this.closeNet = null;
      clearInterval(this.checkStatusInterval);
    }
  }

  _checkStatus() {
    exec(
      `curl -sf -x ${this.host_ip}:${this.host_port} http://localhost`,
      err => {
        if (err) {
          this.errorTime = 0
          this.isError = true;
        } else {
          this.isError = false;
          this.errorTime++
        }
      }
    );
  }
}

class PoolProxy {
  constructor() {
    this.proxyList = {};
    this.startPort = 10000;
    this.portCounter = 0;

    setInterval(()=>{
      for (const [k, v] of Object.entries(self.proxyList)) {
        if (v.errorTime > 3*24*60) {
          this.removeProxy(k)
        }
      }
    },60*60*1000)
  }

  async _getAvailablePort() {
    return new Promise(resolve => {
      sem.take(async () => {
        this.portCounter = this.portCounter % 50000
        while (true) {
          let c = await this._checkPortExist(this.startPort + this.portCounter);
          this.portCounter++;
          if (c) {
            continue;
          }
          break;
        }
        resolve(this.startPort + this.portCounter - 1);
        sem.leave();
      });
    });
  }

  async createNewProxy(proxyStr) {
    if (this.proxyList[proxyStr]) return this.proxyList[proxyStr]

    let nextPort = await this._getAvailablePort();
    var proxyInfo = proxyStr.split(":");
    if (!proxyInfo[0]) throw new Error("proxy string not valid")
    if (!proxyInfo[1] || isNaN(proxyInfo[1])) throw new Error("proxy string not valid")

    var proxy = new Proxy(
      "0.0.0.0",
      nextPort,
      proxyInfo[0],
      proxyInfo[1],
      proxyInfo[2],
      proxyInfo[3]
    );
    
    this.proxyList[proxyStr] = proxy;
    await proxy.init();
    return proxy
  }

  async removeProxy(proxyStr){
    let proxy = this.proxyList[proxyStr]
    if (proxy){
      proxy.close()
      delete this.proxyList[proxyStr]
    }
  }

  printProxy() {
    console.log(this.proxyList);
  }

  async _checkPortExist(port) {
    return new Promise(resolve => {
      exec(`netstat -tulpn | grep ":${port}" > /dev/null && echo $?`, function(
        err,
        stdout
      ) {
        if (err) resolve(0);
        else resolve(1);
      });
    });
  }

  getNextProxy(key) {
    var self = this;
    var generatorObject = {};
    if (!generatorObject[key]) {
      function* generators() {
        let cnt = 0;
        while (true) {
          let allError = true;
          for (const [k, v] of Object.entries(self.proxyList)) {
            if (!v.isError) {
              allError = false;
              break;
            }
          }
          if (allError) {
            yield null;
          } else {
            let proxyArray = Object.entries(self.proxyList);
            cnt = cnt % proxyArray.length 
            if (!proxyArray[cnt].isError) {
              yield `${proxyArray[cnt][1].host_ip}:${proxyArray[cnt][1].host_port}`;
            }
          }
          cnt++;
        }
      }
      generatorObject[key] = generators();
    }
    return generatorObject[key].next().value;
  }
}

var poolProxy  = new PoolProxy()

module.exports = poolProxy