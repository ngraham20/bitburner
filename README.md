# Process
1. `run analyze-network.js 10`: Basically does a network deepscan for free
2. `run grow-botnet.js`: Distribute `dynamic-hack.js` to all crackable servers
3. `run calculate-optimal-target.js`:calculates the optimal hacking target
>   As a rule of thumb, your hacking target should be the server 
>   with highest max money that's required hacking level is under
>   1/2 of your hacking level.
4. `run send-orders.js <optimal-target>`: tell all servers with `dynamic-hack.js` which server to hack.
5. `run purchase-server-8gb.js`. This will run for a while. Any other scripts should be run on one of the `pservs`. You won't need to run `pserv-distribution.js` unless something goes wrong. This script will wipe all `pservs` and overwrite which script is running.

- remember, there's a `kill all running scripts` button on your `Overview`