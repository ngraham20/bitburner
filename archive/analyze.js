const WEAKEN_STRENGTH = 0.05;

/** @param {NS} ns */
export async function main(ns) {
    let target = ns.args[0];
    let moneyThresh = ns.getServerMaxMoney(target) * 0.9;
    let securityThresh = ns.getServerMinSecurityLevel(target) + 5;
    let moneyAvailable = ns.getServerMoneyAvailable(target);
    let wthreads = Math.ceil((ns.getServerSecurityLevel(target) - securityThresh) / WEAKEN_STRENGTH); // weakens by 0.05 per thread. easy calc
    let gthreads = Math.ceil(ns.growthAnalyze(target, Math.ceil((moneyThresh+1)/(moneyAvailable+1))));
    let hthreads = Math.ceil(ns.hackAnalyzeThreads(target, Math.ceil(moneyThresh * 0.5)));
    
    ns.tprint("Target: "+target);
    ns.tprint("Threads needed to weaken: "+wthreads);
    ns.tprint("Threads needed to grow: "+gthreads);
    ns.tprint("Threads needed to hack: "+hthreads);
}