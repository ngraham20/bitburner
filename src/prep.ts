const ACTION_COST = 1.75;
const HACK_SECURITY = 0.002;
const GROWTH_SECURITY = 0.004;
const WEAKEN_SECURITY = 0.05;
const HACK = "hack";
const GROW = "grow";
const WEAKEN = "weaken";
const INFO = "info";

function log(ns: NS, level: string, category: string, message: string) {
  ns.print(level+" : "+category+" : "+message);
}

/** @param {NS} ns */
export async function main(ns: NS) {
  ns.disableLog("ALL");
  // TODO: after a full weaken, each grow should be counter-acted with a mini-batch
  // max = 12.5w + w = 13.5w
  // w = max/13.5
  // max = w + g
  // w = 50/13.5 = 3.7
  // g = 50 - 3.7 = 46.3
  // 
    let target = String(ns.args[0]);

    let worker = "pserv-0";
    while (!ns.serverExists("pserv-0")) {
      log(ns, INFO, "serverExists", "waiting for pserv-0 to be purchased");
      await ns.sleep(1000);
    }

    while(!is_prepped(ns, target)) {
      log(ns, INFO, "serverIsPrepped", "waiting for previous prep cycle to finish");
      while(ns.getServerUsedRam(worker) > 0) {
        await ns.sleep(1000);
      }

      log(ns, INFO, "preppingServer", "previous prep cycle finished. Ordering next prep");
      
      let wmaxram = ns.getServerMaxRam(worker);
      let wmaxthreads = Math.floor(wmaxram / ACTION_COST);
      let wthreads = Math.ceil(wmaxthreads/13.5);
      let gthreads = Math.ceil(wmaxthreads - wthreads);

      if (ns.getServerSecurityLevel(target) > ns.getServerMinSecurityLevel(target)) {
        ns.exec("weaken.js", worker, {threads: wmaxthreads}, target);
      }
      else if (ns.getServerMoneyAvailable(target) < ns.getServerMaxMoney(target)) {

        let now = performance.now();
        let weakenTime = ns.getWeakenTime(target);
        let growTime = ns.getGrowTime(target);
        let weakenEndTime = now + weakenTime + 5;
        let growEndTime = weakenEndTime - 5;
        ns.exec("batch-action.js", worker, {threads: gthreads, ramOverride: ACTION_COST}, target, GROW, 1, growTime, growEndTime, false);
        ns.exec("batch-action.js", worker, {threads: wthreads, ramOverride: ACTION_COST}, target, WEAKEN, 1, weakenTime, weakenEndTime, false);
      }
    }

    ns.toast(target+" is prepped!");
    log(ns, INFO, "preppingServer", target+" has been prepped");
  }

  function is_prepped(ns: NS, target: string): boolean {
    let moneyAvailable = ns.getServerMoneyAvailable(target);
    let moneyMax = ns.getServerMaxMoney(target);
    let minSec = ns.getServerMinSecurityLevel(target);
    let sec = ns.getServerSecurityLevel(target);
    if (moneyAvailable == moneyMax && minSec == sec) {
        return true;
    }
    return false;
}