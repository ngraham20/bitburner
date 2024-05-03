const HACK_COST = 1.75;
const HACK = "hack";
const GROW = "grow";
const WEAKEN = "weaken";
const WEAKEN_STRENGTH = 0.05;

/** @param {NS} ns */
export async function main(ns) {
    // grab all servers
    let network = analyze_network(ns, 15);
    let pservers = network.purchasedServers;
    let nservers = network.networkServers;
    let workers = pservers.concat(nservers);

    let threadpool = calculate_threadpool(ns, workers);
    await ns.sleep(1000);
    while (true) {
        // grab all servers
        let network = analyze_network(ns, 15);
        let pservers = network.purchasedServers;
        let nservers = network.networkServers;
        let workers = pservers.concat(nservers);

        threadpool = calculate_threadpool(ns, workers, threadpool);

        // determine top 5 ideal targets
        let optimalTargets = calculate_optimal_target(ns, nservers, 20);

        for (let i = 0; i < 20; i++) {
            // for each ideal target
            for (const target of optimalTargets) {
                let moneyThresh = ns.getServerMaxMoney(target) * 0.9;
                let securityThresh = ns.getServerMinSecurityLevel(target) + 5;
                let moneyAvailable = ns.getServerMoneyAvailable(target);
                let wthreads = (ns.getServerSecurityLevel(target) - securityThresh) / WEAKEN_STRENGTH; // weakens by 0.05 per thread. easy calc
                let gthreads = ns.growthAnalyze(target, Math.ceil((moneyThresh+1)/(moneyAvailable+1)));
                let hthreads = ns.hackAnalyzeThreads(target, Math.ceil(moneyThresh * 0.5));
                // if (!target in threadpool.allocations) {
                //     threadpool.allocations[target] = {};
                // }

                // if not enough threads allocated
                // if above the security threshold
                if (ns.getServerSecurityLevel(target) > securityThresh) {
                    allocate_worker_threads(ns, threadpool, WEAKEN, target, Math.ceil(wthreads));
                    continue;
                }
                // if below the money threshold
                if (gthreads && moneyAvailable < moneyThresh) {
                    // determine grow threads needed
                    allocate_worker_threads(ns, threadpool, GROW, target, Math.ceil(gthreads));
                    continue;
                }
                // determine hack threads needed to hack half the money
                allocate_worker_threads(ns, threadpool, HACK, target, Math.ceil(hthreads));
            }
            await ns.sleep(1000);
        }
    }
}

/** @param {NS} ns */
function allocate_worker_threads(ns, threadpool, action, target, threadcount) {
    let actionTime;
    switch (action) {
        case HACK: {
            actionTime = ns.getHackTime(target);
        }
        case GROW: {
            actionTime = ns.getGrowTime(target);
        }
        case WEAKEN: {
            actionTime = ns.getWeakenTime(target);
        }
    }
    // don't allocate more than 5% resources to a single dispatch
    let maxAllocation = Math.floor(threadpool.totalThreads * 0.05);

    // the allocation is the smallest of the request, the max, and the available
    let allocation = Math.min(threadcount, maxAllocation, threadpool.availableThreads);

    // filter for workers with threads remaining
    let availableWorkers = threadpool.workers.filter(w => w.availableThreads > 0);


    let i = 0;
    while (allocation > 0 && i < availableWorkers.length) {
        let worker = availableWorkers[i];
        // if the allocation is smaller, then we're done. Exec and break out.
        if (allocation <= worker.availableThreads) {
            worker.availableThreads -= allocation;
            ns.exec(action+".js", worker.name, allocation, target);
            allocation = 0;

        // if the available threads is smaller, use em all up and loop to the next worker
        } else {
            allocation -= worker.availableThreads;
            ns.exec(action+".js", worker.name, worker.availableThreads, target);
            worker.availableThreads = 0;
            i += 1;
        }
    }
}

/** @param {NS} ns */
function calculate_threadpool(ns, workers, threadpool={workers: [],allocations: {},totalThreads: 0,availableThreads: 0,}) {

    // each batch should add a job to this list.
    // each loop should check for completed jobs and remove the threadcounts from their proper places
    // the allocation should only happen in the first place if there aren't enough jobs with threads still occurring
    let allocations = {
        "n00dles": {
            "jobs": [{
                    "action": "weaken",
                    "threads": 35,
                    "duration": 35000,
                },
                {
                    "action": "grow",
                    "threads": 10,
                    "duration": 15000,
                }

            ],
            "threads": 45,
        }
    };

    // build thread pool
    for (const worker of workers) {
        let maxRam = ns.getServerMaxRam(worker)
        let availableRam = maxRam - ns.getServerUsedRam(worker);
        let maxThreads = Math.floor(maxRam / HACK_COST);
        let availableThreads = Math.floor(availableRam / HACK_COST);
        threadpool.workers.push({name: worker, availableThreads: availableThreads});
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
    if (ns.hasRootAccess(server)) {
        // get hacking level
        // get max money
        if (ns.getServerRequiredHackingLevel(server) <= (hackingLevel/2) + 1) {
            viableTargets.push({server: server, maxMoney: ns.getServerMaxMoney(server)});
        }
    }
}

// sort descending
viableTargets.sort(function(a, b){return b.maxMoney - a.maxMoney});
ns.tprint("Top "+topx+" targets are: "+viableTargets.slice(0,topx).map(e => e.server));
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