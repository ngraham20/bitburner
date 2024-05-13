/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    if (ns.args.length < 4) {
        ns.tprint("USAGE: run batch-hack.js <target> <monitor-port> <execution-port> <expected-duration (ms)>");
        ns.exit();
    }
    let target = ns.args[0];
    let monitor = ns.getPortHandle(ns.args[1]);
    let executionPort = ns.getPortHandle(ns.args[2]);
    let expectedDuration = ns.args[3];

    executionPort.nextWrite();
    let startTime = performance.now();
    await ns.hack(target);
    let completionTime = performance.now();
    let duration = completionTime - startTime;
    let result = JSON.stringify({succeed: true, action: "hack", completionTime: completionTime, duration: duration, timeVariance: duration - expectedDuration});
    ns.writePort(monitor, result);
    ns.toast(result, "info", 5000);
    ns.print(result);
  }