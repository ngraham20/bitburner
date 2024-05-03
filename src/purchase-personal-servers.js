const startingRam = 8;

/** @param {NS} ns */
export async function main(ns) {
    // How much RAM each purchased server will have. In this case, it'll
    // be 8GB.
    let botnet = "squadron-hack.js";
    let serverLimit = ns.getPurchasedServerLimit();
    await purchase_starting_set(ns, serverLimit, startingRam, botnet);

    // one by one, upgrade each server until each is 256GB
    
    let startingserver = 0;
    let largestram = 8;
    let smallestram = 8;
    let maximumram = 256;

    let currentram = startingRam * 2;
    // determine where in the process we are for resuming purposes
    while (currentram < maximumram+1) {
        // iterate all servers, upgrading each a single time
        let server = startingserver;
        while (server < serverLimit) {
            let hostname = "pserv-" + server;

            // only use 1/6 of the total available money to upgrade servers
            if (ns.getServerMoneyAvailable("home") / 6 > ns.getPurchasedServerUpgradeCost(hostname, currentram)) {
                ns.upgradePurchasedServer(hostname, currentram);
                initialize(ns, hostname, server % 10);
                server++;
            }
            //Make the script wait for a second before looping again.
            //Removing this line will cause an infinite loop and crash the game.
            await ns.sleep(1000);
        }
        currentram *= 2;
    }
  }
/** @param {NS} ns */
async function purchase_starting_set(ns, limit, ram, botnet) {
    let i = ns.getPurchasedServers().length; // resume if halted during purchasing
    while (i < limit) {
        if (ns.getServerMoneyAvailable("home") > ns.getPurchasedServerCost(ram)) {
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
        
    ns.scp("weaken.js", con);
    ns.scp("grow.js", con);
    ns.scp("hack.js", con);
    ns.killall(con);
}