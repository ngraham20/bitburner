const ACTION_COST = 1.75;
const HACK_SECURITY = 0.002;
const GROWTH_SECURITY = 0.004;
const WEAKEN_SECURITY = 0.05;
const HACK = "hack";
const GROW = "grow";
const WEAKEN = "weaken";

type hostThreads = {hostname: string, threads: number};
type batchJob = {weaken: hostThreads[], grow: hostThreads, hack: hostThreads, terminate: boolean};
type batch = {target: string, jobs: batchJob[]};
type network = {rootedServers: string[], networkServers: string[], purchasedServers: string[]};

// TODO: track current target and the next target. If they're not the same, run prep.js on home targeting the higher one
export async function main(ns: NS) {
    ns.disableLog("ALL");
    let loopPort = ns.getPortHandle(25575);
    let network = analyze_network(ns, 15);
    let batch = calculate_batch(ns, network);
    while(true) {
        for (const job of batch.jobs) {
            execute_job(ns, job, batch.target);
            // await ns.sleep(5);
        }

        network = analyze_network(ns, 15);
        batch = calculate_batch(ns, network);
        await loopPort.nextWrite();
        await ns.sleep(5);
    }
}

// analyze the network, pick the best server that's prepped, and use that target
function calculate_batch(ns: NS, network: network): batch {
    let pservers = network.purchasedServers;
    let rservers = network.rootedServers;
    let nservers = network.networkServers;
    let workers = pservers.concat(rservers);
    workers.sort((a, b) => (ns.getServerMaxRam(a) - ns.getServerMaxRam(b)));
    let batchers = workers.filter(a => ns.getServerMaxRam(a) > 0);

    let targets = nservers.filter(a => weight(ns, a) > 0);
    targets.sort((a, b) => weight(ns, b) - weight(ns, a));
    // ns.tprint("Targets: "+targets);
    let prepped = targets.filter(a => is_prepped(ns, a));
    // ns.tprint("Prepped: "+prepped);

    let target = prepped[0]; // best prepped one

    // if top target is not top prepped, prep top target
    if (targets[0] != prepped[0]) {
        batchers = batchers.filter(a => a != "pserv-0");
        if (!ns.isRunning("prep.js", "home", targets[0])) {
            ns.tprint("Prepping "+targets[0]);
            ns.toast("Prepping "+targets[0]);
            ns.exec("prep.js", "home", 1, targets[0]);
        }
    }

    for (const batcher of batchers) {
        if (!ns.fileExists("batch-action.js", batcher)) {
            ns.scp("batch-action.js", batcher, "home");
        }
    }

    return {target: target, jobs: assign_batch_jobs(ns, batchers, target)};
}

// Returns a weight that can be used to sort servers by hack desirability
function weight(ns: NS, server: string) {
	if (!server) return 0;

	// Don't ask, endgame stuff
	if (server.startsWith('hacknet-node')) return 0;

	// Get the player information
	let player = ns.getPlayer();

	// Get the server information
	let so = ns.getServer(server);

	// Set security to minimum on the server object (for Formula.exe functions)
	so.hackDifficulty = so.minDifficulty;

	// We cannot hack a server that has more than our hacking skill so these have no value
	if (so.requiredHackingSkill > player.skills.hacking) return 0;

	// Default pre-Formulas.exe weight. minDifficulty directly affects times, so it substitutes for min security times
	let weight = so.moneyMax / so.minDifficulty;

	// If we have formulas, we can refine the weight calculation
	if (ns.fileExists('Formulas.exe')) {
		// We use weakenTime instead of minDifficulty since we got access to it, 
		// and we add hackChance to the mix (pre-formulas.exe hack chance formula is based on current security, which is useless)
		weight = so.moneyMax / ns.formulas.hacking.weakenTime(so, player) * ns.formulas.hacking.hackChance(so, player);
	}
	else
		// If we do not have formulas, we can't properly factor in hackchance, so we lower the hacking level tolerance by half
		if (so.requiredHackingSkill >= player.skills.hacking / 2)
			return 0;

	return weight;
}

function is_prepped(ns: NS, target: string): boolean {
    let moneyAvailable = ns.getServerMoneyAvailable(target);
    let moneyMax = ns.getServerMaxMoney(target);
    let minSec = ns.getServerMinSecurityLevel(target);
    let sec = ns.getServerSecurityLevel(target);
    if (moneyAvailable == moneyMax && minSec == sec) {
        return true;
    }
    return false;
}

function calculate_batch_hack_job(ns: NS, target: string, maxThreads: number): {hack: number, grow: number, weaken: number} {
    let completeJob = {
        hack: 0,
        grow: 0,
        weaken: 0,
    };

    // let bestWeight = -1;
    // let newWeight = 0;

    let weights = [];
    
    const weakenTime = ns.getWeakenTime(target); // weaken takes the longest, so it is the length of a batch

    // grow and hack threads cannot be larger than the maxThreads. This prevents failure to start any batches at all

    let percent = 0.005; // half a percent

    // 9 grow threads is the largest a batch can be and still fit on a 16GB server
    let maxMoney = ns.getServerMaxMoney(target);
    while(percent < 1) {

        // bestWeight = newWeight; //equalize the weights

        // calculate a new weight
        let hackMoney = Math.ceil(maxMoney * percent);
        let remainder = maxMoney - hackMoney;
        let growthFactor = maxMoney / remainder;
        let hthreads = Math.max(Math.floor(ns.hackAnalyzeThreads(target, hackMoney)), 1);
        let gthreads = Math.ceil(ns.growthAnalyze(target, growthFactor)) + Math.ceil(hthreads * 0.1);
    
        let hincrease = hthreads * HACK_SECURITY;
        let gincrease = gthreads * GROWTH_SECURITY;
        let wthreads = Math.ceil((hincrease + gincrease) / WEAKEN_SECURITY);

        // if either of these exceeds the max threads, break out
        if (hthreads > maxThreads || gthreads > maxThreads) {
            // ns.tprint("Breached max threads");
            break;
        }
    
        completeJob = {
            hack: hthreads,
            grow: gthreads,
            weaken: wthreads,
        };

        // weight = money / (time * threads)
        // w = m / (s * t)
        let weight = hackMoney / (weakenTime * (hthreads + gthreads + wthreads));

        // ns.tprint("percent: "+percent * 100);
        // ns.tprint("job: "+JSON.stringify(completeJob));
        // ns.tprint("weight: "+weight);
        // ns.tprint("money/second: "+1000*hackMoney/weakenTime);
        // ns.tprint("money/thread: "+1000*hackMoney/(hthreads + gthreads + wthreads));
        weights.push({percent: percent, job: completeJob, mps: 1000*hackMoney/weakenTime, mpt: 1000*hackMoney/(hthreads + gthreads + wthreads), weight: weight});
        
        // increase hack percent by a half a percent
        percent += 0.005;
    }
    // when we break out of here, the final weight is the best (local minimum possible)
    weights.sort((a, b) => b.weight - a.weight);
    // ns.tprint("Best weight: "+ JSON.stringify(weights[0]));
    return weights[0].job;
}

function assign_batch_jobs(ns: NS, workers: string[], target: string): batchJob[] {
    // need to simulate worker threads here;
    let threadpool = {};
    let maxThreads = 0; // the largest that a grow or hack can be
    for (const worker of workers) {
        // using the max threads. This will break badly if workers are ever assigned to something else
        let threads = get_threads(ns, worker);
        maxThreads = Math.max(maxThreads, threads[0]);
        threadpool[worker] = threads[0];
    }
    const completeJob = calculate_batch_hack_job(ns, target, maxThreads);

    let jobs: batchJob[];
    jobs = [];
    let assignment = completeJob;
    while(assignment.hack == completeJob.hack && assignment.grow == completeJob.grow && assignment.weaken == completeJob.weaken) {
        assignment = {
            hack: 0,
            grow: 0,
            weaken: 0,
        };
        let weakenAssignments = [];
        let growAssignment: hostThreads;
        let hackAssignment: hostThreads;
        // loop through all workers
        for (const worker of workers) {
            if (threadpool[worker] == 0) {
                continue;
            }
            // assign all weaken threads as possible. Partial weakens are allowed.
            if (assignment.weaken != completeJob.weaken) {
                let assignedThreads = Math.min(completeJob.weaken - assignment.weaken, threadpool[worker]);
                assignment.weaken += assignedThreads;
                threadpool[worker] -= assignedThreads;
                weakenAssignments.push({hostname: worker, threads: assignedThreads});

                if (assignment.weaken != completeJob.weaken) {
                    // keep assigning weaken threads. Go to the next worker
                    continue;
                }
            }

            // assign all grow threads in bulk
            if (completeJob.grow != assignment.grow && threadpool[worker] >= completeJob.grow) {
                assignment.grow = completeJob.grow;
                threadpool[worker] -= completeJob.grow;
                growAssignment = {hostname: worker, threads: assignment.grow};
            }

            // assign all hack threads in bulk
            if (completeJob.hack != assignment.hack && threadpool[worker] >= completeJob.hack) {
                assignment.hack = completeJob.hack;
                threadpool[worker] -= completeJob.hack;
                hackAssignment = {hostname: worker, threads: assignment.hack}
            }

            if (assignment.hack == completeJob.hack && assignment.grow == completeJob.grow && assignment.weaken == completeJob.weaken) {
                jobs.push({weaken: weakenAssignments, grow: growAssignment, hack: hackAssignment, terminate: false});
                break;
            }
        }
        // if the assignment has not been completed, the loop will break, and the jobs are filled
    }

    if (jobs.length > 0) {
        jobs[jobs.length-1].terminate = true;
    }
    return jobs;
}

/** @param {NS} ns */
function execute_job(ns: NS, job: {weaken: hostThreads[], grow: hostThreads, hack: hostThreads, terminate: boolean}, target: string) {
    let now = performance.now();
    let weakenTime = ns.getWeakenTime(target);
    let hackTime = ns.getHackTime(target);
    let growTime = ns.getGrowTime(target);
    let weakenEndTime = now + weakenTime + 5;
    let growEndTime = weakenEndTime - 5;
    let hackEndTime = weakenEndTime - 10;

    let batchNumber = 1;
    for (const worker of job.weaken){
        ns.exec("batch-action.js", worker.hostname, {threads: worker.threads, ramOverride: ACTION_COST}, target, WEAKEN, batchNumber, weakenTime, weakenEndTime, job.terminate);
    }
    
    ns.exec("batch-action.js", job.grow.hostname, {threads: job.grow.threads, ramOverride: ACTION_COST}, target, GROW, batchNumber, growTime, growEndTime, false);
    ns.exec("batch-action.js", job.hack.hostname, {threads: job.hack.threads, ramOverride: ACTION_COST}, target, HACK, batchNumber, hackTime, hackEndTime, false);
}

function get_threads(ns: NS, hostname: string) {
    let maxRam = ns.getServerMaxRam(hostname);
    let maxThreads = Math.floor(maxRam / ACTION_COST);
    let usedRam = ns.getServerUsedRam(hostname);
    let availableRam = maxRam - usedRam;
    let availableThreads = Math.floor(availableRam / ACTION_COST);

    return [maxThreads, availableThreads];
}

function analyze_network(ns: NS, maxdepth: number) {
    let ctx = {
        visited: ["home"],
        path: [],
        maxdepth: maxdepth,
    };

    ctx.path.push({"home": "home"});

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