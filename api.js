const poolProxy = require("./poolProxy");
const Utils = require("./libs/Utils")

async function add(req, res) {
  if (req.query.proxy) {
    try {
      let newProxy = await poolProxy.createNewProxy(req.query.proxy);
      if (!newProxy) throw new Error("Cannot create proxy")
      res.end();
    } catch (err) {
        console.log(err)
      res.status(500);
      res.end();
    }
  } else {
      console.log("no proxy string")
    res.status(500);
    res.end();
  }
}

function stats(req, res){
    let result = {total: 0, error: 0, active: 0}
    for (const [k, v] of Object.entries(poolProxy.proxyList)) {
        result.total++
        if (v.isError) result.error++
        else result.active++
    }
    res.json(result)
}

function show(req, res){
  let result = []
  for (const [k, v] of Object.entries(poolProxy.proxyList)) {
      result.push({
          isError: v.isError,
          forwardProxy: `${v.host_ip}:${v.host_port}`,
          proxy: k
      })
  }
  res.json(result)
}

function get(req, res){
  let result = ""
  let v = poolProxy.getNextProxy(req.query.key || "")
  if (v){
    result = `${Utils.getIP()}:${v.host_port}`
  }
  res.end(result)
}

function remove(req, res){
  poolProxy.removeProxy(req.query.proxy || "")
  res.end()
}

module.exports = {add, show, stats, remove, get}