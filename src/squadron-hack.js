/** @param {NS} ns */
export async function main(ns) {
    let target = "NULL PORT DATA";
    let squadron = ns.args[0]; // defaults to 0
    if (squadron > 9) {
        ns.tprint("Maximum squadron is 9");
        ns.exit();
    }
    let squadports = [25505, 25515, 25525, 25535, 25545, 25555, 25565, 25575, 25585, 25595]
    while (true) {
      var orders = ns.peek(squadports[squadron]);
      if (orders != target) { // if new orders, set moneyThresh and securityThresh
        target = orders;
        if (target != "NULL PORT DATA") { // make sure the orders are valid. Empty orders are allowed
          var moneyThresh = ns.getServerMaxMoney(target) * 0.9;
          var securityThresh = ns.getServerMinSecurityLevel(target) + 5;
        }
      }
      else if (target != "NULL PORT DATA") { // if the orders haven't changed and aren't blank, do the thing
        if (ns.getServerSecurityLevel(target) > securityThresh) {
          await ns.weaken(target);
        } else if (ns.getServerMoneyAvailable(target) < moneyThresh) {
          await ns.grow(target);
        } else {
          await ns.hack(target);
        }
      } else { // if there are no orders at all, wait 1 second and try again
        await ns.sleep(1000)
      }
    }
  }