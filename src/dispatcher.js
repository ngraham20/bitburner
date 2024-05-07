const ACTION_COST = 1.75;
const HACK = "hack";
const GROW = "grow";
const WEAKEN = "weaken";
const WEAKEN_STRENGTH = 0.05;
var flags = {
    debug: false,
    targets: [],
}

/** @param {NS} ns */
export async function main(ns) {
    let threadpool = new_threadpool()
    while (true) {
        get_flags(ns);
        if (flags.debug) {
            ns.tprint(flags);
        }
        let network = analyze_network(ns, 15);
        let pservers = network.purchasedServers;
        let rservers = network.rootedServers;
        let nservers = network.networkServers;
        let workers = pservers.concat(rservers);

        // clear threadcount for rebuild
        threadpool.availableThreads = 0;
        for (const worker of workers) {
            update_worker(ns, threadpool, worker);
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
function get_flags(ns) {
    let debugmode = Boolean(ns.peek(25575));
    let targets = ns.peek(25565).split(/,/);
    flags = {
        debug: debugmode,
        targets: targets,
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
    if (topx > viableTargets.length) {
        topx = viableTargets.length;
    }
    // strip out the maxMoney parameter and return just the servers
    return viableTargets.slice(0,topx).map(e => e.server);
}

/** @param {NS} ns */
function parse_orders(ns, threadTargets) {
    // possible inputs
    // n00dles,joesguns,foodnstuff
    // n00dles
    // top 10
    let topx = 0;
    let targets = flags.targets;
    if (targets[0] == "NULL PORT DATA") {
        return calculate_optimal_targets(ns, threadTargets, 5);
    }
    if (targets[0] == "top") {
        topx = targets[1];
        return calculate_optimal_targets(ns, threadTargets, topx);
    }
    return calculate_optimal_targets(ns, targets, targets.length);
}

/** @param {NS} ns */
function determine_assignment(ns, threadpool) {
    // pick a target
    let targets = parse_orders(ns, threadpool.targets);

    // pick an action
    for (const target of targets) {
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

    let allocation = threads;
    // filter for workers with threads remaining
    let availableWorkers = [];
    for (const worker in threadpool.workers) {
        if (threadpool.workers[worker].available > 0) {
            availableWorkers.push(worker);
        }
    }

    let i = 0;
    while (allocation > 0 && i < availableWorkers.length) {
        let worker = availableWorkers[i];
        let availableThreads = threadpool.workers[worker].available

        // if the allocation is smaller, then we're done. Exec and break out.
        if (allocation <= availableThreads) {
            assign_worker_threads(ns, threadpool, action, worker, target, allocation);
            allocation = 0;

        // if the available threads is smaller, use em all up and loop to the next worker
        } else {
            assign_worker_threads(ns, threadpool, action, worker, target, availableThreads);
            allocation -= availableThreads;
            i += 1;
        }
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
            if (elapsed > job.duration) {
                finishedJobs.push(job);
            }
        }
        for (let job of finishedJobs) {
            remove_job(ns, threadpool, target, job);
        }
    }
}

/** @param {NS} ns */
function update_worker(ns, threadpool, worker) {
    let maxRam = ns.getServerMaxRam(worker);
    let totalThreads = Math.floor(maxRam / ACTION_COST);

    let usedRam = ns.getServerUsedRam(worker);
    let availableRam = maxRam - usedRam;
    let availableThreads = Math.floor(availableRam / ACTION_COST);

    threadpool.workers[worker] = {max: totalThreads, available: availableThreads};
    threadpool.availableThreads += availableThreads;
}

/** @param {NS} ns */
function add_target(ns, threadpool, target) {
    if (!threadpool.targets.includes(target)) {
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

function remove_job(ns, threadpool, target, job) {
    let worker = job.worker;
    let action = job.action;
    let threads = job.threads;
    let index = threadpool.allocations[target].jobs.indexOf(job);

    threadpool.allocations[target].jobs.splice(index, 1);
    threadpool.allocations[target][action] -= threads;
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
    if (flags.debug) {
        ns.toast("Dispatched: "+action+" job on target: "+target);
    }
}

function new_threadpool() {
    let threadpool = {
        workers: {},
        targets: [],
        allocations: {},
        availableThreads: 0,
    }
    return threadpool;
}