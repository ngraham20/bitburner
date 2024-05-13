/** @param {NS} ns */
export async function main(ns) {
    // ns.toast("action started");
    // ns.disableLog("ALL");
    if (ns.args.length < 5) {
        ns.tprint("USAGE: run batch-hack.js <target> <action> <trigger-port> <action-time> <end-time> <report>");
        ns.exit();
    }
    let target = ns.args[0];
    let action = ns.args[1];
    let executionPort = ns.getPortHandle(ns.args[2])
    let actionTime = ns.args[3];
    let endTime = ns.args[4];
    let report = ns.args[5];
    
    let handle;
    switch (action) {
        case "hack":
            handle = ns.hack;
            break;
        case "grow":
            handle = ns.grow;
            break;
        case "weaken":
            handle = ns.weaken;
            break;
    }

    let startTime = performance.now();
    let delay = Math.max(endTime - actionTime - startTime, 0);
    // ns.toast("Starting "+action+"against target: "+target);
    await handle(target, {additionalMsec: delay});
    let completionTime = performance.now();
    let duration = completionTime - startTime;
    let result = JSON.stringify({succeed: true, action: action, completionTime: completionTime, duration: duration});
    // ns.toast(result, "success", 5000);
    ns.print(result);
    if (report) {
        ns.clearPort(25575);
        ns.writePort(25575, true);
    }
  }