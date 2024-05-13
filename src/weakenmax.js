/** @param {NS} ns */
export async function main(ns) {
    let target = ns.args[0];
    while(ns.getServerSecurityLevel(target) > ns.getServerMinSecurityLevel(target)) {
        await ns.weaken(target);
    }
    ns.toast(target+" is at minimum security");
  }