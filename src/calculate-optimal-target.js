/** @param {NS} ns */
export async function main(ns) {
  // As a rule of thumb, your hacking target should be the server 
  // with highest max money that's required hacking level is under
  // 1/2 of your hacking level.

  let maxLevel = 5;
  let hackingLevel = ns.getHackingLevel();
  let servers = [];
  let viableTargets = [];
  // iterate all level(x)servers.txt files
  for(let i=0; i <= maxLevel; i++ ){
    servers = servers.concat(ns.read("level"+i+"servers.txt").split(/\n/));
    servers.pop();
  }

  for(const server of servers) {
    // get hacking level
    // get max money
    if (ns.getServerRequiredHackingLevel(server) <= (hackingLevel/2)) {
      viableTargets.push({server: server, maxMoney: ns.getServerMaxMoney(server)});
    }
  }

  // sort ascending
  viableTargets.sort(function(a, b){return a.maxMoney - b.maxMoney});

  let target = viableTargets.pop();
  ns.tprint("Ideal target: "+target.server);
}