/** @param {NS} ns */
export async function main(ns) {
    ns.exec("analyze-network.js", "home", 1, 15);
    let porthackfiles = ["BruteSSH.exe", "FTPCrack.exe", "relaySMTP.exe", "HTTPWorm.exe", "SQLInject.exe"];
    let portcracks = [ns.brutessh, ns.ftpcrack, ns.relaysmtp, ns.httpworm, ns.sqlinject];
    let maxlevel = 5;

    let i = 0;

    // skip portcracks for level 0 servers
    let lvlfile = ns.read("level"+i+"servers.txt");
    let lvlconnections = lvlfile.split(/\n/);
    for (const con of lvlconnections) {
        if (con) {
            ns.nuke(con);
            initialize(ns, con);
        }
    }
    
    for(let level = 1; level <= maxlevel; level++) {
        while(!ns.fileExists(porthackfiles[level-1])) {
            await ns.sleep(60000);
        }
        let lvlfile = ns.read("level"+level+"servers.txt");
        let lvlconnections = lvlfile.split(/\n/);
        for (const con of lvlconnections) {
            if (con) {

                // execute all cracks up to the current level
                for(let program = 0; program < level; program++) {
                    portcracks[program](con);
                }

                // finally, nuke and initialize
                ns.nuke(con);
                initialize(ns, con);
            }
        }
    }
}
/** @param {NS} ns */
function initialize(ns, con) {
    ns.print("Accessing: " + con);
        
    if (!ns.fileExists("batch-action.js")) {
        ns.scp("batch-action.js", con);
    }
    if (!ns.fileExists("grow.js")) {
        ns.scp("grow.js", con);
    }
    if (!ns.fileExists("weaken.js")) {
        ns.scp("weaken.js", con);
    }
}