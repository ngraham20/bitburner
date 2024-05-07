/** @param {NS} ns */
export async function main(ns) {
    if (ns.args.length == 0) {
        ns.tprint("Must send at least one order.");
        ns.exit();
    }
    if (ns.args[0] == "debug") {
        ns.clearPort(25575);
        ns.writePort(25575, ns.args[1]);
    } else {
        ns.clearPort(25565);
        ns.writePort(25565, ns.args.join(","));
    }
}