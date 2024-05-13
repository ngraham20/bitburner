/** @param {NS} ns */
export async function main(ns) {
    ns.toast("action started");
    // ns.disableLog("ALL");
    if (ns.args.length < 4) {
        ns.tprint("USAGE: run batch-hack.js <target> <action> <trigger-port> <monitor-port> <expected-endtime>");
        ns.exit();
    }
    let target = ns.args[0];
    let action = ns.args[1];
    let executionPort = ns.getPortHandle(ns.args[2])
    let monitor = ns.getPortHandle(ns.args[3]);
    let expectedEndtime = ns.args[4];

    ns.tprint("waiting for trigger on port: "+ns.args[2]);
    
    let handle;
    let actionTime;
    switch (action) {
        case "hack":
            handle = ns.hack;
            actionTime = ns.getHackTime;
            break;
        case "grow":
            handle = ns.grow;
            actionTime = ns.getGrowTime;
            break;
        case "weaken":
            handle = ns.weaken;
            actionTime = ns.getWeakenTime;
            break;
    }

    await executionPort.nextWrite();
    let startTime = performance.now();
    ns.toast("Starting "+action+"against target: "+target);
    await handle(target);
    let completionTime = performance.now();
    let duration = completionTime - startTime;
    let result = JSON.stringify({succeed: true, action: action, completionTime: completionTime, duration: duration});
    monitor.write(result);
    ns.toast(result, "success", 5000);
    ns.print(result);
  }