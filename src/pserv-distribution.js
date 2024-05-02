/** @param {NS} ns */
export async function main(ns) {
    let squadports = [25505, 25515, 25525, 25535, 25545, 25555, 25565, 25575, 25585, 25595]
    let squadron = 0;
    let serverLimit = ns.getPurchasedServerLimit();

    for(let i = 0; i < serverLimit; i++) {

        // wait until the script is purchased
        let con = "pserv-"+i;
        while(!ns.serverExists(con)) {
            await ns.sleep(60000);
        }
        ns.tprint("Accessing: " + con);
        initialize(ns, con, squadron);
        squadron = (squadron + 1) % 10;
    }
}
/** @param {NS} ns */
function initialize(ns, con, squad) {
    let botnet = "squadron-hack.js";
    let maxRam = ns.getServerMaxRam(con);
    let requiredRam = ns.getScriptRam(botnet, "home");
    let numThreads = 0;
    if (requiredRam) {
        numThreads = Math.trunc(maxRam / requiredRam);
    }
    if (numThreads) {
        ns.scp(botnet, con);
        ns.killall(con);
        ns.exec(botnet, con, numThreads, squad);
    }
}