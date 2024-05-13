const GROWTH_SECURITY = 0.04;
const WEAKEN_SECURITY = 0.05;

/** @param {NS} ns */
export async function main(ns) {
    let target = ns.args[0];

    let maxMoney = ns.getServerMaxMoney(target);
    let currentMoney = ns.getServerMoneyAvailable(target);

    let maxRAM = ns.getServerMaxRam(target);

    let growthFactor = maxMoney / currentMoney;
    let gthreads = Math.ceil(ns.growthAnalyze(target, growthFactor));

    let gincrease = gthreads * GROWTH_SECURITY;
    let security = ns.getServerSecurityLevel(target);
    let minSec = ns.getServerMinSecurityLevel(target);
    let wthreads = Math.ceil((security - minSec + gincrease) / WEAKEN_SECURITY);

    ns.tprint("-----");
    ns.tprint("Target: "+target);
    ns.tprint("Max money: "+maxMoney);
    ns.tprint("Max RAM: "+maxRAM);
    ns.tprint("Grow threads needed to prep: "+gthreads);
    ns.tprint("Weaken threads needed to prep: "+wthreads);
  }