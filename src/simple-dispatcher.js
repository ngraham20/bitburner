const HACK_COST = 1.75;
const HACK = "hack";
const GROW = "grow";
const WEAKEN = "weaken";
const WEAKEN_STRENGTH = 0.05;

/** @param {NS} ns */
export async function main(ns) {
    let worker = "n00dles";
    let target = "joesguns";

    let threadpool = new_threadpool()

    threadpool.allocations[target] = {
        jobs: [],
        weaken: 0,
        grow: 0,
        hack: 0,
    };

    dispatch(ns, threadpool, HACK, worker, target, 1);
    dispatch(ns, threadpool, HACK, worker, target, 1);

    while (true) {
        monitor_jobs(ns, threadpool, target)
        await ns.sleep(1000);
    }
}

/** @param {NS} ns */
function monitor_jobs(ns, threadpool, target) {
    for (let i = 0; i < threadpool.allocations[target].jobs.length; i++) {
        let now = performance.now();
        let job = threadpool.allocations[target].jobs[i]
        let elapsed = now - job.startTime;
        let remaining = job.duration - elapsed;
        if (elapsed > job.duration) {
            ns.toast(job.action+" job completed on "+job.worker+" with target: "+target);
            remove_job(ns, threadpool, target, i);
        } else {
            ns.tprint("-----");
            ns.tprint(target);
            ns.tprint("Remaining: "+remaining);
            ns.tprint("Job: "+job.action);
            ns.tprint(job.action+" threads: "+threadpool.allocations[target][job.action]);
        }
    }
    if (threadpool.allocations[target].jobs.length == 0) {
        ns.toast("no more jobs. Exiting");
        ns.exit();
    }
}

/** @param {NS} ns */
function dispatch(ns, threadpool, action, worker, target, threads) {
    ns.exec(action+".js", worker, {threads: threads, temporary:true}, target);
    add_job(ns, threadpool, action, worker, target, threads);
}

/** @param {NS} ns */
function remove_job(ns, threadpool, target, index) {
    let job = threadpool.allocations[target].jobs[index];
    let action = job.action;
    let threads = job.threads;
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