/** @param {NS} ns */
export async function main(ns) {
    let target = ns.args[0];
    while(ns.getServerMoneyAvailable(target) < ns.getServerMaxMoney(target)) {
        await ns.grow(target);
    }
    ns.toast(target+" is at maximum money");
  }