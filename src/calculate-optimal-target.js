/** @param {NS} ns */
export async function main(ns) {
  // As a rule of thumb, your hacking target should be the server 
  // with highest max money that's required hacking level is under
  // 1/2 of your hacking level.

  let maxLevel = 5;
  let hackingLevel = ns.getHackingLevel();
  let servers = [];
  let viableTargets = [];
  ns.rm("target-ranks.txt");
  // iterate all level(x)servers.txt files
  for(let i=0; i <= maxLevel; i++ ){
    let filename = "level"+i+"servers.txt";
    if (ns.fileExists(filename)) {
      servers = servers.concat(ns.read("level"+i+"servers.txt").split(/\n/));
      servers.pop();
    }
  }

  for(const server of servers) {
    // get hacking level
    // get max money
    if (ns.getServerRequiredHackingLevel(server) <= (hackingLevel/2) + 1) {
      viableTargets.push({server: server, maxMoney: ns.getServerMaxMoney(server)});
    }
  }

  let topx = ns.args[0] || 10;
  // sort ascending
  viableTargets.sort(function(a, b){return a.maxMoney - b.maxMoney});
  ns.tprint("Top "+topx+" targets are: ");
  if (topx > viableTargets.length) {
    topx = viableTargets.length;
    ns.tprint("There are not enough targets. Capping at "+topx+" instead");
  }
  for (let i = 0; i < topx; i++) {
    let target = viableTargets.pop().server;
    ns.tprint("Rank "+(i+1)+": "+target);
    ns.write("target-ranks.txt", target +"\n", "a");
  }
}