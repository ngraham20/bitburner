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

    dispatch(ns, threadpool, GROW, worker, target, 1);
    dispatch(ns, threadpool, WEAKEN, worker, target, 1);
    
    while (true) {
        for (let i = 0; i < threadpool.allocations[target].jobs.length; i++) {
            let now = performance.now();
            let job = threadpool.allocations[target].jobs[i]
            let elapsed = now - job.startTime;
            let remaining = job.duration - elapsed;
            if (elapsed > job.duration) {
                ns.toast("job completed");
                threadpool.allocations[target].jobs.splice(i, 1);
            } else {
                ns.tprint(target);
                ns.tprint("Remaining: "+remaining);
            }
        }
        if (threadpool.allocations[target].jobs.length == 0) {
            ns.toast("no more jobs. Exiting");
            ns.exit();
        }
        await ns.sleep(1000);
    }
}

/** @param {NS} ns */
function dispatch(ns, threadpool, action, worker, target, threads) {
    ns.exec(action+".js", worker, {threads: threads, temporary:true}, target);
    add_job(ns, threadpool, action, target, threads);
}


/** @param {NS} ns */
function add_job(ns, threadpool, action, target, threads) {
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
    let job = {action: action, threads: threads, startTime: performance.now(), duration: actionTime};
    threadpool.allocations[target].jobs.push(job);
}

function new_threadpool() {
    let threadpool = {
        workers: [],
        allocations: {},
        totalThreads: 0,
        availableThreads: 0,
    }

    let example_job = {
        action: "grow",
        threads: 5,
        startTime: 5000,
        duration: 5000
    }

    return threadpool;
}