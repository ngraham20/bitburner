const ACTION_COST = 1.75;
const HACK = "hack";
const GROW = "grow";
const WEAKEN = "weaken";
const WEAKEN_STRENGTH = 0.05;

/** @param {NS} ns */
export async function main(ns) {
    let workers = ["n00dles", "joesguns", "foodnstuff"];
    let targets = ["n00dles", "foodnstuff"];

    let threadpool = new_threadpool()

    for (const worker of workers) {
        add_worker(ns, threadpool, worker);
    }

    for (const target of targets) {
        add_target(ns, threadpool, target);
    }

    while (true) {
        let network = analyze_network(ns, 15);
        let pservers = network.purchasedServers;
        let rservers = network.rootedServers;
        let nservers = network.networkServers;
        let workers = pservers.concat(rservers);
        for (const worker of workers) {
            add_worker(ns, threadpool, worker);
        }
        for (const target of nservers) {
            add_target(ns, threadpool, target);
        }
        monitor_jobs(ns, threadpool);
        determine_assignment(ns, threadpool);
        await ns.sleep(1000);
    }
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

/** @param {NS} ns */
function calculate_optimal_targets(ns, targets, topx) {
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
function determine_assignment(ns, threadpool) {
    // pick a target
    let optimalTargets = calculate_optimal_targets(ns, threadpool.targets, 5);
    // pick an action
    for (const target of optimalTargets) {
        // ns.tprint("Dispatching for target: "+target);
        let moneyThresh = ns.getServerMaxMoney(target) * 0.9;
        let securityThresh = ns.getServerMinSecurityLevel(target) + 5;
        let moneyAvailable = ns.getServerMoneyAvailable(target);
        let wthreads = Math.ceil((ns.getServerSecurityLevel(target) - securityThresh) / WEAKEN_STRENGTH); // weakens by 0.05 per thread. easy calc
        let gthreads = Math.ceil(ns.growthAnalyze(target, Math.ceil((moneyThresh+1)/(moneyAvailable+1))));
        let hthreads = Math.ceil(ns.hackAnalyzeThreads(target, Math.ceil(moneyThresh * 0.5)));
        let allocations = threadpool.allocations[target];

        // if not enough threads allocated
        // if above the security threshold
        if (allocations.weaken < wthreads && ns.getServerSecurityLevel(target) > securityThresh) {
            dispatch(ns, threadpool, WEAKEN, target, wthreads - allocations.weaken);
        }
        // if below the money threshold
        if (allocations.grow < gthreads && moneyAvailable < moneyThresh) {
            // determine grow threads needed
            dispatch(ns, threadpool, GROW, target, gthreads - allocations.grow);
        }
        // determine hack threads needed to hack half the money
        if (allocations.hack < hthreads) {
            dispatch(ns, threadpool, HACK, target, hthreads - allocations.hack);
        }
    }
}

/** @param {NS} ns */
function dispatch(ns, threadpool, action, target, threads) {
    // ns.tprint("Dispatching");
    // ns.tprint("requested threads: "+threads);
    // don't allocate more than 5% resources to a single dispatch
    let maxAllocation = Math.ceil(threadpool.totalThreads * 0.05);
    // ns.tprint("max allocation: "+maxAllocation);
    // the allocation is the smallest of the request, the max, and the available
    let allocation = Math.min(threads, maxAllocation, threadpool.availableThreads);
    // ns.tprint("actual allocation: "+allocation);
    // filter for workers with threads remaining
    let availableWorkers = [];
    for (const worker in threadpool.workers) {
        // ns.tprint(worker);
        if (threadpool.workers[worker] > 0) {
            availableWorkers.push(worker);
        }
    }
    // let availableWorkers = new Map([...threadpool.workers].filter(([k,v]) => v > 0));
    // ns.tprint(availableWorkers);

    let i = 0;
    while (allocation > 0 && i < availableWorkers.length) {
        let worker = availableWorkers[i];
        // if the allocation is smaller, then we're done. Exec and break out.
        if (allocation <= threadpool.workers[worker]) {
            assign_worker_threads(ns, threadpool, action, worker, target, allocation);
            allocation = 0;

        // if the available threads is smaller, use em all up and loop to the next worker
        } else {
            assign_worker_threads(ns, threadpool, action, worker, target, threadpool.workers[worker]);
            threadpool.workers[worker] = 0;
            i += 1;
        }
    }
}

function pick_action(ns, target) {
    let moneyThresh = ns.getServerMaxMoney(target) * 0.9;
    let securityThresh = ns.getServerMinSecurityLevel(target) + 5;
    let moneyAvailable = ns.getServerMoneyAvailable(target);
    let wthreads = (ns.getServerSecurityLevel(target) - securityThresh) / WEAKEN_STRENGTH; // weakens by 0.05 per thread. easy calc
    let gthreads = ns.growthAnalyze(target, Math.ceil((moneyThresh+1)/(moneyAvailable+1)));
    let hthreads = ns.hackAnalyzeThreads(target, Math.ceil(moneyThresh * 0.5));

    // if not enough threads allocated
    // if above the security threshold
    if (threadpool.allocations[target].weaken < wthreads && ns.getServerSecurityLevel(target) > securityThresh) {
        allocate_worker_threads(ns, threadpool, WEAKEN, target, Math.ceil(wthreads - threadpool.allocations[target].weaken));
    }
    // if below the money threshold
    if (threadpool.allocations[target].grow < gthreads && moneyAvailable < moneyThresh) {
        // determine grow threads needed
        allocate_worker_threads(ns, threadpool, GROW, target, Math.ceil(gthreads - threadpool.allocations[target].grow));
    }
    // determine hack threads needed to hack half the money
    if (threadpool.allocations[target].hack < hthreads) {
        allocate_worker_threads(ns, threadpool, HACK, target, Math.ceil(hthreads - threadpool.allocations[target].hack));
    }
}

/** @param {NS} ns */
function monitor_jobs(ns, threadpool) {
    for (const target of threadpool.targets) {
        let finishedJobs = [];
        for (let i = 0; i < threadpool.allocations[target].jobs.length; i++) {
            let now = performance.now();
            let job = threadpool.allocations[target].jobs[i]
            let elapsed = now - job.startTime;
            let remaining = job.duration - elapsed;
            if (elapsed > job.duration) {
                ns.toast(job.action+" job completed on "+job.worker+" with target: "+target);
                finishedJobs.push(job);
            }

            ns.tprint("-----");
            ns.tprint("i: "+i);
            ns.tprint("worker: "+job.worker);
            ns.tprint(target);
            ns.tprint("Remaining: "+remaining);
            ns.tprint("Job: "+job.action);
            ns.tprint(job.action+" threads: "+threadpool.allocations[target][job.action]);
        }
        for (let job of finishedJobs) {
            remove_job(threadpool, target, job);
        }
        // if (threadpool.allocations[target].jobs.length == 0) {
        //     ns.toast("no more jobs. Exiting");
        //     ns.exit();
        // }
    }
}

/** @param {NS} ns */
function add_worker(ns, threadpool, worker) {
    if (!(worker in threadpool.workers)) {
        let maxThreads = Math.floor(ns.getServerMaxRam(worker) / ACTION_COST);
        ns.tprint("Max threads for this worker: "+maxThreads);
        threadpool.workers[worker] = maxThreads;
        threadpool.totalThreads += maxThreads;
        threadpool.availableThreads += maxThreads;
    }
}

/** @param {NS} ns */
function add_target(ns, threadpool, target) {
    if (!threadpool.targets.includes(target)) {
        ns.tprint("Adding target: "+target);
        threadpool.targets.push(target);
        threadpool.allocations[target] = {
            jobs: [],
            weaken: 0,
            grow: 0,
            hack: 0,
        };
    }
}

/** @param {NS} ns */
function assign_worker_threads(ns, threadpool, action, worker, target, threads) {
    ns.exec(action+".js", worker, {threads: threads, temporary:true}, target);
    add_job(ns, threadpool, action, worker, target, threads);
}

function remove_job(threadpool, target, job) {
    let action = job.action;
    let threads = job.threads;
    let index = threadpool.allocations[target].jobs.indexOf(job);
    threadpool.allocations[target].jobs.splice(index, 1);
    threadpool.allocations[target][action] -= threads;
    threadpool.workers[job.worker] += threads;
    threadpool.availableThreads += threads;
}


/** @param {NS} ns */
function add_job(ns, threadpool, action, worker, target, threads) {
    let actionTime;
    switch (action) {
        case HACK:
            actionTime = ns.getHackTime(target);
            break;
        case GROW:
            actionTime = ns.getGrowTime(target);
            break;
        case WEAKEN:
            actionTime = ns.getWeakenTime(target);
            break;
    }
    let job = {action: action, worker:worker, threads: threads, startTime: performance.now(), duration: actionTime};
    threadpool.allocations[target].jobs.push(job);
    threadpool.allocations[target][action] += threads;
    threadpool.workers[worker] -= threads;
    threadpool.availableThreads -= threads;
}

function new_threadpool() {
    let threadpool = {
        workers: [],
        targets: [],
        allocations: {},
        totalThreads: 0,
        availableThreads: 0,
    }
    return threadpool;
}