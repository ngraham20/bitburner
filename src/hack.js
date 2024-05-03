/** @param {NS} ns */
export async function main(ns) {
    let target = ns.args[0];
    await ns.hack(target);
    ns.writePort(25565, {name: target, action: hack});
  }