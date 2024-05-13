/** @param {NS} ns */
export async function main(ns) {
    let target = ns.args[0];
    while(ns.getServerMoneyAvailable(target) < ns.getServerMaxMoney(target)) {
        await ns.grow(target);
    }
    while(ns.getServerSecurityLevel(target) > ns.getServerMinSecurityLevel(target)) {
        await ns.weaken(target);
    }
    ns.toast(target+" is prepped");
  }