/** @param {NS} ns */
export async function main(ns) {
    let home = "home";
    let visited = [];
    let depth = 0
    spread(ns, home, visited, depth);
  }
  
  /** @param {NS} ns */
  function spread(ns, home, visited, depth) {
    if (depth > 3) {
      return;
    }
    let botnet = "dynamic-hack.js"
    let connections = ns.scan(home);
    let requiredRam = ns.getScriptRam(botnet, home);
    for (const con of connections) {
      let reqPorts = ns.getServerNumPortsRequired(con);
      let hackRequired = ns.getServerRequiredHackingLevel(con);
      let haveRoot = ns.hasRootAccess(con);
      let maxRam = ns.getServerMaxRam(con);
      let numThreads = Math.trunc(maxRam / requiredRam);
  
      if (!haveRoot) {
        if (reqPorts > 0) {
          ns.brutessh(con);
        }
        if (reqPorts > 1) {
          ns.ftpcrack(con);
        }
        if (reqPorts > 2) {
          // skip connections entirely that are too hard
          continue;
        }
        ns.nuke(con);
      }
  
      ns.scp(botnet, con);
      ns.killall(con);
      ns.exec(botnet, con, numThreads);
      if (!visited.includes(con)) {
        visited.push(con);
        depth += 1;
        spread(ns, con, visited, depth);
      }
    }
  }