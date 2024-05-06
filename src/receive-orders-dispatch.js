/** @param {NS} ns */
export async function main(ns) {
    ns.clearPort(25565);
    ns.writePort(25565, ns.args[0]);

    parse_orders(ns);
}

/** @param {NS} ns */
function parse_orders(ns) {
    // possible inputs
    // n00dles,joesguns,foodnstuff
    // n00dles
    // top 10
    let targets = ns.peek(25565).split(/,/);

    ns.tprint(targets);
}