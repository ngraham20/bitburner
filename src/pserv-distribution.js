/** @param {NS} ns */
export async function main(ns) {
    let serverLimit = ns.getPurchasedServerLimit();

    for(let i = 0; i < serverLimit; i++) {

        // wait until the script is purchased
        while(!ns.serverExists("pserv-"+i)) {
            ns.sleep(60000);
        }
        ns.tprint("Accessing: " + con);
        initialize(ns, con);
    }
}
/** @param {NS} ns */
function initialize(ns, con) {
    let botnet = "dynamic-hack.js";
    let maxRam = ns.getServerMaxRam(con);
    let requiredRam = ns.getScriptRam(botnet, "home");
    let numThreads = 0;
    if (requiredRam) {
        numThreads = Math.trunc(maxRam / requiredRam);
    }
    if (numThreads) {
        ns.scp(botnet, con);
        ns.killall(con);
        ns.exec(botnet, con, numThreads);
    }
}