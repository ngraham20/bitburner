/** @param {NS} ns */
export async function main(ns) {
    ns.clearPort(25565);
    if (ns.args.length == 0) {
        ns.tprint("Must send at least one order.");
        ns.exit();
    }
    ns.writePort(25565, ns.args.join(","));
}