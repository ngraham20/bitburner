//TODO: This script is borked now. My guess is that it won't create new jobs due to a thread leak
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
    // let workers = pservers.concat(nservers);
    let workers = ["n00dles"];

    let threadpool = calculate_threadpool(ns, workers);
    await ns.sleep(1000);
    while (true) {
        // grab all servers
        let network = analyze_network(ns, 15);
        let pservers = network.purchasedServers;
        let nservers = network.networkServers;
        // let workers = pservers.concat(nservers);
        let workers = ["n00dles"];
        threadpool = calculate_threadpool(ns, workers, threadpool);

        // determine top 5 ideal targets
        // let optimalTargets = calculate_optimal_target(ns, nservers, 5);
        let optimalTargets = ["n00dles"];
        // for (let i = 0; i < 20; i++) {
            // for each ideal target
            for (const target of optimalTargets) {
                let moneyThresh = ns.getServerMaxMoney(target) * 0.9;
                let securityThresh = ns.getServerMinSecurityLevel(target) + 5;
                let moneyAvailable = ns.getServerMoneyAvailable(target);
                let wthreads = (ns.getServerSecurityLevel(target) - securityThresh) / WEAKEN_STRENGTH; // weakens by 0.05 per thread. easy calc
                let gthreads = ns.growthAnalyze(target, Math.ceil((moneyThresh+1)/(moneyAvailable+1)));
                let hthreads = ns.hackAnalyzeThreads(target, Math.ceil(moneyThresh * 0.5));

                // add the viable allocation if necessary
                if (!(target in threadpool.allocations)) {
                    threadpool.allocations[target] = {
                        jobs: [],
                        weaken: 0,
                        grow: 0,
                        hack: 0,
                    };
                }

                ns.tprint(target);
                ns.tprint(threadpool.allocations[target].jobs);

                // if not enough threads allocated
                // if above the security threshold
                if (threadpool.allocations[target].weaken < wthreads && ns.getServerSecurityLevel(target) > securityThresh) {
                    allocate_worker_threads(ns, threadpool, WEAKEN, target, Math.ceil(wthreads - threadpool.allocations[target].weaken));
                    continue;
                }
                // if below the money threshold
                if (threadpool.allocations[target].grow < gthreads && moneyAvailable < moneyThresh) {
                    // determine grow threads needed
                    allocate_worker_threads(ns, threadpool, GROW, target, Math.ceil(gthreads - threadpool.allocations[target].grow));
                    continue;
                }
                // determine hack threads needed to hack half the money
                if (threadpool.allocations[target].hack < hthreads) {
                    allocate_worker_threads(ns, threadpool, HACK, target, Math.ceil(hthreads));
                }
            }
            await ns.sleep(1000);
        // }
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
            threadpool.allocations[target][action] += allocation;
            threadpool.allocations[target].jobs.push({action: action, threads: allocation, startTime: performance.now(), duration: actionTime});
            ns.exec(action+".js", worker.name, allocation, target);
            allocation = 0;

        // if the available threads is smaller, use em all up and loop to the next worker
        } else {
            allocation -= worker.availableThreads;
            threadpool.allocations[target][action] += worker.availableThreads;
            threadpool.allocations[target].jobs.push({action: action, threads: worker.availableThreads, startTime: performance.now(), duration: actionTime});
            ns.exec(action+".js", worker.name, worker.availableThreads, target);
            worker.availableThreads = 0;
            i += 1;
        }
    }
}

/** @param {NS} ns */
function calculate_threadpool(ns, workers, threadpool={workers: [],allocations: {},totalThreads: 0,availableThreads: 0,}) {

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

    // remove any jobs that are completed
    for(const target in threadpool.allocations) {
        // iterate through the jobs
        let finishedJobs = [];
        for (let i = 0; i < threadpool.allocations[target].jobs.length; i++) {
            let job = threadpool.allocations[target].jobs[i];
            let startTime = job.startTime;
            let duration = job.duration;
            let now = performance.now();
            let elapsed = now - startTime;
            if (elapsed > duration) {
                finishedJobs.push(i);
                threadpool.allocations[target][job.action] -= job.threads;
            }
        }
        for (const job of finishedJobs) {
            threadpool.allocations[target].jobs = threadpool.allocations[target].jobs.splice(job, 1);
        }
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
// ns.tprint("Top "+topx+" targets are: "+viableTargets.slice(0,topx).map(e => e.server));
if (topx > viableTargets.length) {
    topx = viableTargets.length;
    // ns.tprint("There are not enough targets. Capping at "+topx+" instead");
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