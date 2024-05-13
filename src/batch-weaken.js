/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    if (ns.args.length < 3) {
        ns.tprint("USAGE: run batch-weaken.js <target> <monitor-port> <expected-duration (ms)>");
        ns.exit();
    }
    let target = ns.args[0];
    let monitor = ns.args[1];
    let expectedDuration = ns.args[2];
    let startTime = performance.now();
    await ns.weaken(target);
    let completionTime = performance.now();
    let duration = completionTime - startTime;
    let result = JSON.stringify({succeed: true, action: "weaken", completionTime: completionTime, duration: duration, timeVariance: duration - expectedDuration});
    ns.writePort(monitor, result);
    ns.toast(result, "info", 5000);
    ns.print(result);
  }