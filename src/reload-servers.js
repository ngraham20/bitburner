/** @param {NS} ns */
export async function main(ns) {

    let maxLevel = 5;
    let servers = [];
    // iterate all level(x)servers.txt files
    for(let i=0; i <= maxLevel; i++ ){
      servers = servers.concat(ns.read("level"+i+"servers.txt").split(/\n/));
      servers.pop();
    }
  
    for(const server of servers ){
      ns.killall(server);
    }
    let servercount = ns.getPurchasedServers().length - 1;
    for (let i = servercount; i >= 0; i--) {
      let hostname = "pserv-" + i;
      ns.killall(hostname);
    }
  }