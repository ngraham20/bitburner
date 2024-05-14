const GROWTH_SECURITY = 0.004;
const WEAKEN_SECURITY = 0.05;
const HACK_SECURITY = 0.002;
const ACTION_COST = 1.75;

export async function main(ns: NS) {
    let target = String(ns.args[0]);
    let threads = Number(ns.args[1]);
    calc(ns, target, threads);
}

function calc(ns: NS, target: string, maxThreads: number) {
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

    let percent = 0; // half a percent

    // 9 grow threads is the largest a batch can be and still fit on a 16GB server
    let maxMoney = ns.getServerMaxMoney(target);
    while(percent < 1-0.005) {

        // bestWeight = newWeight; //equalize the weights
        
        // increase hack percent by a half a percent
        percent += 0.005;

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
            ns.tprint("Breached max threads");
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

        ns.tprint("percent: "+percent * 100);
        ns.tprint("job: "+JSON.stringify(completeJob));
        ns.tprint("weight: "+weight);
        ns.tprint("money/second: "+1000*hackMoney/weakenTime);
        ns.tprint("money/thread: "+1000*hackMoney/(hthreads + gthreads + wthreads));
        weights.push({percent: percent, job: JSON.stringify(completeJob), mps: 1000*hackMoney/weakenTime, mpt: 1000*hackMoney/(hthreads + gthreads + wthreads), weight: weight});
    }
    // when we break out of here, the final weight is the best (local minimum possible)
    weights.sort((a, b) => b.weight - a.weight);
    ns.tprint("Best weight: "+ JSON.stringify(weights[0]));
}