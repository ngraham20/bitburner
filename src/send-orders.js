/** @param {NS} ns */
export async function main(ns) {
    let orders = ns.args[0];
    let squadports = [25505, 25515, 25525, 25535, 25545, 25555, 25565, 25575, 25585, 25595]

    if (!orders) {
      ns.tprint("Clearing all orders");
      for (let i = 0; i < squadports.length; i++) {
        let port = squadports[i];
        ns.clearPort(port);
      }
      ns.exit();
    }
    let squadrons = ns.args[1].toString();
    let bookends = squadrons.split(/-/);
    if (bookends.length > 2 || bookends.length < 1) {
      ns.tprint("Squadron must be specified as either a single number ([0-9]), or a range ([0-9]-[0-9])");
      ns.tprint("Exmples: ");
      ns.tprint("run send-orders n00dles 5");
      ns.tprint("run send-orders n00dles 1-4");
      ns.exit();
    }

    if (bookends.length == 1) {
      if (bookends[0] > 9) {
        ns.tprint("Maximum squadron is 9");
        ns.exit();
      }
      let port = squadports[bookends[0]];
      ns.clearPort(port);
      ns.writePort(port, orders);
      ns.exit();
    }

    if (bookends.length == 2) {
      bookends.sort(function(a, b){return a - b});
      if (bookends[1] > 9) {
        ns.tprint("Maximum squadron is 9");
        ns.exit();
      }

      for(let squad = bookends[0]; squad <= bookends[1]; squad++) {
        let port = squadports[squad]
        ns.clearPort(port);
        ns.writePort(port, orders);
      }
    }
}