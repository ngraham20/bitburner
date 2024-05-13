/** @param {NS} ns */
export async function main(ns) {
    // How much RAM each purchased server will have. In this case, it'll
    // be 8GB.
    let serverLimit = ns.getPurchasedServerLimit();
    let numServers = ns.getPurchasedServers().length;

    if (numServers < serverLimit) {
        await purchase_starting_set(ns, serverLimit);
    }

    // one by one, upgrade each server until each is 2048GB
    // set currentRam to the largest RAM found among servers
    let desiredRam = 16;
    for(let i = 0; i < serverLimit; i++) {
        let hostname = "pserv-"+i;
        let maxram = ns.getServerMaxRam(hostname);
        if (maxram > desiredRam) {
            desiredRam = maxram;
        }
    }
    let startingserver = 0;
    let maximumram = 1048576;
    // determine where in the process we are for resuming purposes
    while (desiredRam <= maximumram) {
        // iterate all servers, upgrading each a single time
        let server = startingserver;
        while (server < serverLimit) {
            let hostname = "pserv-" + server;
            let serverMaxRam = ns.getServerMaxRam(hostname);
            while (serverMaxRam < desiredRam) {
                // only use 1/6 of the total available money to upgrade servers
                if ((ns.getServerMoneyAvailable("home") * 0.1) > ns.getPurchasedServerUpgradeCost(hostname, desiredRam) && ns.getServerMaxRam(hostname) < desiredRam) {
                        ns.upgradePurchasedServer(hostname, desiredRam);
                        ns.toast("Personal Server "+hostname+" upgraded to "+desiredRam+"GB");
                }
                //Make the script wait for a second before looping again.
                //Removing this line will cause an infinite loop and crash the game.
                serverMaxRam = ns.getServerMaxRam(hostname);
                await ns.sleep(1000);
            }
            server += 1;
        }
        desiredRam *= 2;
    }
  }
/** @param {NS} ns */
async function purchase_starting_set(ns, limit) {
    let startingRam = 8;
    let i = ns.getPurchasedServers().length; // resume if halted during purchasing
    while (i < limit) {
        if (ns.getServerMoneyAvailable("home") > ns.getPurchasedServerCost(startingRam)) {
            // If we have enough money, then:
            //  1. Purchase the server
            //  2. Copy our hacking script onto the newly-purchased server
            //  3. Run our hacking script on the newly-purchased server with 3 threads
            //  4. Increment our iterator to indicate that we've bought a new server
            let hostname = ns.purchaseServer("pserv-" + i, startingRam);
            initialize(ns, hostname);
            ++i;
          }

        //Make the script wait for a second before looping again.
        //Removing this line will cause an infinite loop and crash the game.
        await ns.sleep(1000);
    }
}

/** @param {NS} ns */
function initialize(ns, con) {
    ns.print("Accessing: " + con);
        
    ns.scp("batch-action.js", con);
}