/** @param {NS} ns */
export async function main(ns) {
    let context = {
        visited: ["home"],
        path: [{ "home": "home" }],
        maxdepth: ns.args[0] || 4,
        maxlevel: 5,
    };
    // delete old level files
    for (let i = 0; i <= 5; i++) {
        ns.rm("level" + i + "servers.txt");
    }
    ns.rm("purchased-servers.txt");
    ns.rm("available-servers.txt");

    analyze(ns, context);
    ns.write("paths.txt", JSON.stringify(context.path), "w");
}

/** @param {NS} ns */
function analyze(ns, ctx) {
    // for each depth asked for
    for (let depth = 0; depth < ctx.maxdepth; depth++) {
        ctx.path.push({});

        // iterate all connections at this depth for sub-connections
        // put those sub-connections in the next-highest depth
        let homes = ctx.path[depth];
        for (const [home, _] of Object.entries(homes)) {
            let connections = ns.scan(home);
            for (const con of connections) {
                if (con.substring(0,5) == "pserv") {
                    ns.tprint("Discovered: " + con);
                    ns.write("purchased-servers.txt", con + "\n", "a");
                    continue;
                }
                let lvl = ns.getServerNumPortsRequired(con);
                if (!ctx.visited.includes(con)) {
                    ns.tprint("Discovered: " + con);
                    ns.tprint("Depth: " + (depth + 1));
                    
                    if (ns.hasRootAccess(con)) {
                        ns.write("available-servers.txt", con+"\n", "a");
                    }

                    ctx.visited.push(con);
                    ctx.path[depth + 1][con] = ctx.path[depth][home] + ">" + con;
                    ns.write("level" + lvl + "servers.txt", con + "\n", "a");
                }
            }
        }
    }
}