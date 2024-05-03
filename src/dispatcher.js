const HACK_COST = 1.75;
const HACK = "hack.js";
const GROW = "grow.js";
const WEAKEN = "weaken.js";
const WEAKEN_STRENGTH = 0.05;

/** @param {NS} ns */
export async function main(ns) {

    // grab all servers
    let network = analyze_network(ns, 15);
    let pservers = network.purchasedServers;
    let nservers = network.networkServers;
    let workers = pservers.concat(nservers);

    let threadpool = calculate_threadpool(ns, workers);

    // determine top 5 ideal targets
    let optimalTargets = calculate_optimal_target(ns, pservers, 5);

    // for each ideal target
    for (const target of optimalTargets) {
        let moneyThresh = ns.getServerMaxMoney(target) * 0.9;
        let securityThresh = ns.getServerMinSecurityLevel(target) + 5;
        // if above the security threshold
        if (ns.getServerSecurityLevel(target) > securityThresh) {
            let threadcount = 1; // weakens by 0.05 per thread. easy calc
            allocate_worker_threads(ns, threadpool, threadcount);
            ns.exec(WEAKEN, target, threadcount);
        }
        // if below the money threshold
        if (ns.getServerMoneyAvailable(target) < moneyThresh) {
            // determine grow threads needed
            // ns.weakenAnalyze
        }
        // determine hack threads needed
        let hthreads = ns.hackAnalyzeThreads(target, moneyThresh * 0.5);

    }
  }

  function allocate_worker_threads(ns, threadpool, threadcount) {
    let workerthreads = {
        worker: "",
        threads: 0,
    };

    return workerthreads;
  }

  /** @param {NS} ns */
  function calculate_threadpool(ns, workers) {
    // create a threadpool object
    let threadpool = {
        workers: [],
        totalThreads: 0,
        availableThreads: 0,
    };

    // build thread pool
    for (const worker of workers) {
        let maxThreads = Math.floor(ns.getServerMaxRam(worker) / HACK_COST);
        threadpool.workers.push({worker: worker, maxThreads: maxThreads, availableThreads: maxThreads});
        threadpool.totalThreads += maxThreads;
        threadpool.availableThreads += maxThreads;
    }

    return threadpool;
  }

  /** @param {NS} ns */
  function calculate_optimal_target(ns, targets, topx) {
    // As a rule of thumb, your hacking target should be the server 
    // with highest max money that's required hacking level is under
    // 1/2 of your hacking level.

    let hackingLevel = ns.getHackingLevel();
    let viableTargets = [];

    for(const server of targets) {
        // get hacking level
        // get max money
        if (ns.getServerRequiredHackingLevel(server) <= (hackingLevel/2) + 1) {
        viableTargets.push({server: server, maxMoney: ns.getServerMaxMoney(server)});
        }
    }

    // sort descending
    viableTargets.sort(function(a, b){return b.maxMoney - a.maxMoney});
    ns.tprint("Top "+topx+" targets are: ");
    if (topx > viableTargets.length) {
        topx = viableTargets.length;
        ns.tprint("There are not enough targets. Capping at "+topx+" instead");
    }
    // strip out the maxMoney parameter and return just the servers
    return viableTargets.slice(0,topx).map(e => e.server);
  }

  /** @param {NS} ns */
function analyze_network(ns, maxdepth) {
    let ctx = {
        visited: ["home"],
        path: [{ "home": "home" }],
        maxdepth: maxdepth,
    };

    let network = {
        rootedServers: [],
        networkServers: [],
        purchasedServers: [],
    };
    
    // for each depth asked for
    for (let depth = 0; depth < ctx.maxdepth; depth++) {
        ctx.path.push({});

        // iterate all connections at this depth for sub-connections
        // put those sub-connections in the next-highest depth
        let homes = ctx.path[depth];
        for (const [home, _] of Object.entries(homes)) {
            let connections = ns.scan(home);
            for (const con of connections) {
                if (con.substring(0,5) == "pserv") {
                    network.purchasedServers.push(con);

                    continue;
                }
                if (!ctx.visited.includes(con)) {
                    network.networkServers.push(con);
                    if (ns.hasRootAccess(con)) {
                        network.rootedServers.push(con);
                    }

                    ctx.visited.push(con);
                    ctx.path[depth + 1][con] = ctx.path[depth][home] + ">" + con;
                }
            }
        }
    }
    return network;
}