const ACTION_COST = 1.75;
const HACK_SECURITY = 0.002;
const GROWTH_SECURITY = 0.04;
const WEAKEN_SECURITY = 0.05;
const HACK = "hack";
const GROW = "grow";
const WEAKEN = "weaken";

type hostThreads = {hostname: string, threads: number};
type batchJob = {weaken: hostThreads[], grow: hostThreads, hack: hostThreads, terminate: boolean};
type batch = {target: string, jobs: batchJob[]};
type network = {rootedServers: string[], networkServers: string[], purchasedServers: string[]};
export async function main(ns: NS) {
    let loopPort = ns.getPortHandle(25575);
    let network = analyze_network(ns, 15);
    let batch = calculate_batch(ns, network);
    while(true) {
        for (const job of batch.jobs) {
            execute_job(ns, job, batch.target);
            await ns.sleep(5);
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

    let targets = nservers.filter(a => weight(ns, a) > 0 && is_prepped(ns, a));

    targets.sort((a, b) => weight(ns, b) - weight(ns, a));

    let target = targets[0];

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

function calculate_batch_hack_job(ns: NS, target: string): {hack: number, grow: number, weaken: number} {
    let completeJob = {
        hack: 0,
        grow: 0,
        weaken: 0,
    };

    let percent = 0.01;

    // 9 grow threads is the largest a batch can be and still fit on a 16GB server
    // while(completeJob.hack > 1) {
        let maxMoney = ns.getServerMaxMoney(target);
        let hackMoney = Math.ceil(maxMoney * percent);
        let remainder = maxMoney - hackMoney;
        let growthFactor = maxMoney / remainder;
        // let hthreads = Math.max(Math.floor(ns.hackAnalyzeThreads(target, hackMoney)), 1);
        let hthreads = 1;
        let gthreads = Math.ceil(ns.growthAnalyze(target, growthFactor)) + Math.ceil(hthreads * 0.1);
    
        let hincrease = hthreads * HACK_SECURITY;
        let gincrease = gthreads * GROWTH_SECURITY;
        let wthreads = Math.ceil((hincrease + gincrease) / WEAKEN_SECURITY);
    
        completeJob = {
            hack: hthreads,
            grow: gthreads,
            weaken: wthreads,
        };

        ns.tprint(completeJob);

        // percent -= 0.001;
    // }
    
    return completeJob;
}

function assign_batch_jobs(ns: NS, workers: string[], target: string): batchJob[] {
    const completeJob = calculate_batch_hack_job(ns, target);

    // need to simulate worker threads here;
    let threadpool = {};
    for (const worker of workers) {
        // using the max threads. This will break badly if workers are ever assigned to something else
        let threads = get_threads(ns, worker);
        threadpool[worker] = threads[0];
    }

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