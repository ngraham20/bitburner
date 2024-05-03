const ACTION_COST = 1.75;
const HACK = "hack";
const GROW = "grow";
const WEAKEN = "weaken";
const WEAKEN_STRENGTH = 0.05;

/** @param {NS} ns */
export async function main(ns) {
    let worker = "n00dles";
    let target = "joesguns";

    let threadpool = new_threadpool()

    add_worker(ns, threadpool, worker);
    add_target(threadpool, target);
    
    assign_worker_threads(ns, threadpool, HACK, worker, target, 1);
    assign_worker_threads(ns, threadpool, HACK, worker, target, 1);

    while (true) {
        monitor_jobs(ns, threadpool, target)
        await ns.sleep(1000);
    }
}

/** @param {NS} ns */
function monitor_jobs(ns, threadpool, target) {
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
        ns.tprint(target);
        ns.tprint("Remaining: "+remaining);
        ns.tprint("Job: "+job.action);
        ns.tprint(job.action+" threads: "+threadpool.allocations[target][job.action]);
    }
    for (let job in finishedJobs) {
        remove_job(threadpool, target, job);
    }
    if (threadpool.allocations[target].jobs.length == 0) {
        ns.toast("no more jobs. Exiting");
        ns.exit();
    }
}

/** @param {NS} ns */
function add_worker(ns, threadpool, worker) {
    let maxThreads = Math.floor(ns.getServerMaxRam(worker) / ACTION_COST);
    threadpool.workers.push({
        name: worker,
        availableThreads: maxThreads
    })
}

function add_target(threadpool, target) {
    threadpool.allocations[target] = {
        jobs: [],
        weaken: 0,
        grow: 0,
        hack: 0,
    };
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
}

function new_threadpool() {
    let threadpool = {
        workers: [],
        allocations: {},
        totalThreads: 0,
        availableThreads: 0,
    }
    return threadpool;
}