const GROWTH_SECURITY = 0.04;
const WEAKEN_SECURITY = 0.05;
const HACK_SECURITY = 0.002;
const ACTION_COST = 1.75;

/** @param {NS} ns */
export async function main(ns) {
    let target = ns.args[0];

    let maxMoney = ns.getServerMaxMoney(target);
    let currentMoney = ns.getServerMoneyAvailable(target);

    let growthFactor = maxMoney / currentMoney;
    let gthreads = Math.ceil(ns.growthAnalyze(target, growthFactor));

    let gincrease = gthreads * GROWTH_SECURITY;
    let security = ns.getServerSecurityLevel(target);
    let minSec = ns.getServerMinSecurityLevel(target);
    let wthreads = Math.ceil((security - minSec + gincrease) / WEAKEN_SECURITY);

    let maxRam = ns.getServerMaxRam(target);
    let maxThreads = Math.floor(maxRam / ACTION_COST);
    let usedRam = ns.getServerUsedRam(target);
    let availableRam = maxRam - usedRam;
    let availableThreads = Math.floor(availableRam / ACTION_COST);

    ns.tprint("-----");
    ns.tprint("Target: "+target);
    ns.tprint("available threads: "+availableThreads);
    ns.tprint("Max money: "+maxMoney);
    ns.tprint("Max RAM: "+maxRam);
    ns.tprint("Max threads: "+maxThreads);
    ns.tprint("Grow threads needed to prep: "+gthreads);
    ns.tprint("Weaken threads needed to prep: "+wthreads);

    // let target = ns.args[0];
    // let percent = ns.args[1];
    // let maxMoney = ns.getServerMaxMoney(target);
    // let hackMoney = Math.ceil(maxMoney * percent);
    // let remainder = maxMoney - hackMoney;
    // let growthFactor = maxMoney / remainder;
    // let hthreads = Math.max(Math.floor(ns.hackAnalyzeThreads(target, hackMoney)), 1);
    // let gthreads = Math.ceil(ns.growthAnalyze(target, growthFactor)) + Math.ceil(hthreads * 0.1);

    // let hincrease = hthreads * HACK_SECURITY;
    // let gincrease = gthreads * GROWTH_SECURITY;
    // let wthreads = Math.ceil((hincrease + gincrease) / WEAKEN_SECURITY);

    // const completeJob = {
    //     hack: hthreads,
    //     grow: gthreads,
    //     weaken: wthreads,
    // };

    // ns.tprint("-----");
    // ns.tprint(completeJob);
  }