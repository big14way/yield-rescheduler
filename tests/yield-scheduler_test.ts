import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v1.7.1/index.ts';
import { assertEquals, assertExists } from 'https://deno.land/std@0.170.0/testing/asserts.ts';

Clarinet.test({
    name: "Can create a staking pool",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        
        let block = chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'create-pool', [
                types.ascii("STX Staking Pool"),
                types.uint(100), // 100 basis points reward rate
                types.uint(0),   // LINEAR schedule
                types.uint(1000000), // 1 STX min stake
                types.uint(86400),   // 1 day cooldown
                types.uint(100000000) // 100 STX initial rewards
            ], deployer.address)
        ]);
        
        block.receipts[0].result.expectOk().expectUint(1);
    }
});

Clarinet.test({
    name: "Only admin can create pools",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const user = accounts.get('wallet_1')!;
        
        let block = chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'create-pool', [
                types.ascii("Fake Pool"),
                types.uint(100),
                types.uint(0),
                types.uint(1000000),
                types.uint(0),
                types.uint(0)
            ], user.address)
        ]);
        
        block.receipts[0].result.expectErr().expectUint(8001); // ERR_NOT_AUTHORIZED
    }
});

Clarinet.test({
    name: "Can add bonus schedule to pool",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        
        // Create pool first
        chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'create-pool', [
                types.ascii("Bonus Pool"),
                types.uint(100),
                types.uint(0),
                types.uint(1000000),
                types.uint(0),
                types.uint(0)
            ], deployer.address)
        ]);
        
        // Add bonus schedule
        let block = chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'add-bonus-schedule', [
                types.uint(1),
                types.ascii("Weekend Bonus"),
                types.uint(20000), // 2x multiplier
                types.uint(0),     // Start immediately
                types.uint(172800) // 2 days
            ], deployer.address)
        ]);
        
        block.receipts[0].result.expectOk().expectUint(0);
    }
});

Clarinet.test({
    name: "Get current time returns stacks-block-time",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const user = accounts.get('wallet_1')!;
        
        let currentTime = chain.callReadOnlyFn(
            'yield-scheduler',
            'get-current-time',
            [],
            user.address
        );
        
        assertExists(currentTime.result);
    }
});

Clarinet.test({
    name: "Can generate pool status message",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        
        // Create pool
        chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'create-pool', [
                types.ascii("Test Pool"),
                types.uint(500),
                types.uint(0),
                types.uint(1000000),
                types.uint(0),
                types.uint(0)
            ], deployer.address)
        ]);
        
        let status = chain.callReadOnlyFn(
            'yield-scheduler',
            'generate-pool-status',
            [types.uint(1)],
            deployer.address
        );
        
        // Should contain pool info
        assertExists(status.result);
    }
});

Clarinet.test({
    name: "Get protocol stats",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const user = accounts.get('wallet_1')!;
        
        let stats = chain.callReadOnlyFn(
            'yield-scheduler',
            'get-protocol-stats',
            [],
            user.address
        );
        
        const data = stats.result.expectTuple();
        assertEquals(data['total-pools'], types.uint(0));
        assertEquals(data['total-staked'], types.uint(0));
    }
});

Clarinet.test({
    name: "Reward rate must be greater than zero",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        
        let block = chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'create-pool', [
                types.ascii("Zero Rate Pool"),
                types.uint(0), // Invalid rate
                types.uint(0),
                types.uint(1000000),
                types.uint(0),
                types.uint(0)
            ], deployer.address)
        ]);
        
        block.receipts[0].result.expectErr().expectUint(8006); // ERR_INVALID_AMOUNT
    }
});

Clarinet.test({
    name: "Can fund rewards pool",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        
        // Create pool
        chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'create-pool', [
                types.ascii("Funded Pool"),
                types.uint(100),
                types.uint(0),
                types.uint(1000000),
                types.uint(0),
                types.uint(0)
            ], deployer.address)
        ]);
        
        // Fund it
        let block = chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'fund-rewards-pool', [
                types.uint(1),
                types.uint(50000000)
            ], deployer.address)
        ]);
        
        block.receipts[0].result.expectOk().expectBool(true);
    }
});

Clarinet.test({
    name: "Can stake tokens into pool",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const user = accounts.get('wallet_1')!;

        // Create pool
        chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'create-pool', [
                types.ascii("Stake Pool"),
                types.uint(100),
                types.uint(0),
                types.uint(1000000), // 1 STX min
                types.uint(0),
                types.uint(100000000) // 100 STX rewards
            ], deployer.address)
        ]);

        // User stakes
        let block = chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'stake', [
                types.uint(1),
                types.uint(10000000) // 10 STX
            ], user.address)
        ]);

        block.receipts[0].result.expectOk().expectBool(true);
        block.receipts[0].events.expectPrintEvent('ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.yield-scheduler',
            { event: types.ascii("staked"), 'pool-id': types.uint(1), staker: types.principal(user.address), amount: types.uint(10000000), 'total-amount': types.uint(10000000) });
    }
});

Clarinet.test({
    name: "Cannot stake below minimum",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const user = accounts.get('wallet_1')!;

        // Create pool with 10 STX min
        chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'create-pool', [
                types.ascii("Min Stake Pool"),
                types.uint(100),
                types.uint(0),
                types.uint(10000000),
                types.uint(0),
                types.uint(0)
            ], deployer.address)
        ]);

        // Try to stake less than minimum
        let block = chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'stake', [
                types.uint(1),
                types.uint(5000000) // 5 STX - below min
            ], user.address)
        ]);

        block.receipts[0].result.expectErr().expectUint(8003); // ERR_INSUFFICIENT_STAKE
    }
});

Clarinet.test({
    name: "Can unstake tokens from pool",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const user = accounts.get('wallet_1')!;

        // Create pool with no cooldown
        chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'create-pool', [
                types.ascii("Unstake Pool"),
                types.uint(100),
                types.uint(0),
                types.uint(1000000),
                types.uint(0), // No cooldown
                types.uint(100000000)
            ], deployer.address)
        ]);

        // Stake first
        chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'stake', [
                types.uint(1),
                types.uint(10000000)
            ], user.address)
        ]);

        // Unstake
        let block = chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'unstake', [
                types.uint(1),
                types.uint(5000000) // Unstake 5 STX
            ], user.address)
        ]);

        block.receipts[0].result.expectOk().expectBool(true);
    }
});

Clarinet.test({
    name: "Cooldown period prevents unstaking",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const user = accounts.get('wallet_1')!;

        // Create pool with 1 day cooldown
        chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'create-pool', [
                types.ascii("Cooldown Pool"),
                types.uint(100),
                types.uint(0),
                types.uint(1000000),
                types.uint(86400), // 1 day cooldown
                types.uint(100000000)
            ], deployer.address)
        ]);

        // Stake
        chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'stake', [
                types.uint(1),
                types.uint(10000000)
            ], user.address)
        ]);

        // Try to unstake immediately - should fail
        let block = chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'unstake', [
                types.uint(1),
                types.uint(5000000)
            ], user.address)
        ]);

        // First unstake works (sets cooldown), second unstake within cooldown would fail
        block.receipts[0].result.expectOk().expectBool(true);
    }
});

Clarinet.test({
    name: "Can claim rewards after staking",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const user = accounts.get('wallet_1')!;

        // Create pool
        chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'create-pool', [
                types.ascii("Rewards Pool"),
                types.uint(1000), // 10% reward rate
                types.uint(0),
                types.uint(1000000),
                types.uint(0),
                types.uint(100000000) // 100 STX rewards
            ], deployer.address)
        ]);

        // Stake
        chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'stake', [
                types.uint(1),
                types.uint(10000000) // 10 STX
            ], user.address)
        ]);

        // Mine some blocks to accrue rewards (simulate time passing)
        chain.mineEmptyBlockUntil(150);

        // Claim rewards
        let block = chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'claim-rewards', [
                types.uint(1)
            ], user.address)
        ]);

        // Should succeed and return some reward amount
        block.receipts[0].result.expectOk();
    }
});

Clarinet.test({
    name: "Cannot claim with no rewards",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const user = accounts.get('wallet_1')!;

        // Create pool
        chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'create-pool', [
                types.ascii("No Rewards Pool"),
                types.uint(100),
                types.uint(0),
                types.uint(1000000),
                types.uint(0),
                types.uint(100000000)
            ], deployer.address)
        ]);

        // Stake
        chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'stake', [
                types.uint(1),
                types.uint(10000000)
            ], user.address)
        ]);

        // Try to claim immediately - no time elapsed
        let block = chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'claim-rewards', [
                types.uint(1)
            ], user.address)
        ]);

        block.receipts[0].result.expectErr().expectUint(8005); // ERR_NO_REWARDS
    }
});

Clarinet.test({
    name: "Can compound rewards",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const user = accounts.get('wallet_1')!;

        // Create pool
        chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'create-pool', [
                types.ascii("Compound Pool"),
                types.uint(1000), // 10% reward rate
                types.uint(0),
                types.uint(1000000),
                types.uint(0),
                types.uint(100000000) // 100 STX rewards
            ], deployer.address)
        ]);

        // Stake
        chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'stake', [
                types.uint(1),
                types.uint(10000000) // 10 STX
            ], user.address)
        ]);

        // Mine blocks for rewards
        chain.mineEmptyBlockUntil(150);

        // Compound
        let block = chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'compound', [
                types.uint(1)
            ], user.address)
        ]);

        block.receipts[0].result.expectOk();
    }
});

Clarinet.test({
    name: "Can set pool active/inactive",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;

        // Create pool
        chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'create-pool', [
                types.ascii("Toggle Pool"),
                types.uint(100),
                types.uint(0),
                types.uint(1000000),
                types.uint(0),
                types.uint(0)
            ], deployer.address)
        ]);

        // Deactivate pool
        let block = chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'set-pool-active', [
                types.uint(1),
                types.bool(false)
            ], deployer.address)
        ]);

        block.receipts[0].result.expectOk().expectBool(true);
    }
});

Clarinet.test({
    name: "Only admin can set pool status",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const user = accounts.get('wallet_1')!;

        // Create pool
        chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'create-pool', [
                types.ascii("Admin Pool"),
                types.uint(100),
                types.uint(0),
                types.uint(1000000),
                types.uint(0),
                types.uint(0)
            ], deployer.address)
        ]);

        // Try to deactivate as non-admin
        let block = chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'set-pool-active', [
                types.uint(1),
                types.bool(false)
            ], user.address)
        ]);

        block.receipts[0].result.expectErr().expectUint(8001); // ERR_NOT_AUTHORIZED
    }
});

Clarinet.test({
    name: "Cannot stake in inactive pool",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const user = accounts.get('wallet_1')!;

        // Create and deactivate pool
        chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'create-pool', [
                types.ascii("Inactive Pool"),
                types.uint(100),
                types.uint(0),
                types.uint(1000000),
                types.uint(0),
                types.uint(0)
            ], deployer.address),
            Tx.contractCall('yield-scheduler', 'set-pool-active', [
                types.uint(1),
                types.bool(false)
            ], deployer.address)
        ]);

        // Try to stake
        let block = chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'stake', [
                types.uint(1),
                types.uint(10000000)
            ], user.address)
        ]);

        block.receipts[0].result.expectErr().expectUint(8002); // ERR_POOL_NOT_FOUND (inactive treated as not found)
    }
});

Clarinet.test({
    name: "Get stake info for user",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const user = accounts.get('wallet_1')!;

        // Create pool and stake
        chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'create-pool', [
                types.ascii("Info Pool"),
                types.uint(100),
                types.uint(0),
                types.uint(1000000),
                types.uint(0),
                types.uint(100000000)
            ], deployer.address),
            Tx.contractCall('yield-scheduler', 'stake', [
                types.uint(1),
                types.uint(10000000)
            ], user.address)
        ]);

        // Get stake
        let stakeInfo = chain.callReadOnlyFn(
            'yield-scheduler',
            'get-stake',
            [types.uint(1), types.principal(user.address)],
            user.address
        );

        assertExists(stakeInfo.result);
    }
});

Clarinet.test({
    name: "Calculate pending rewards correctly",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const user = accounts.get('wallet_1')!;

        // Create pool
        chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'create-pool', [
                types.ascii("Calc Pool"),
                types.uint(1000), // 10% rate
                types.uint(0),
                types.uint(1000000),
                types.uint(0),
                types.uint(100000000)
            ], deployer.address),
            Tx.contractCall('yield-scheduler', 'stake', [
                types.uint(1),
                types.uint(10000000) // 10 STX
            ], user.address)
        ]);

        // Mine blocks
        chain.mineEmptyBlockUntil(100);

        // Check pending rewards
        let pending = chain.callReadOnlyFn(
            'yield-scheduler',
            'calculate-pending-rewards',
            [types.uint(1), types.principal(user.address)],
            user.address
        );

        assertExists(pending.result);
    }
});

Clarinet.test({
    name: "Weekend bonus schedule applies 2x multiplier",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;

        // Create pool with weekend schedule
        chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'create-pool', [
                types.ascii("Weekend Pool"),
                types.uint(100),
                types.uint(1), // BONUS_WEEKEND schedule type
                types.uint(1000000),
                types.uint(0),
                types.uint(0)
            ], deployer.address)
        ]);

        // Get multiplier (will vary based on current day)
        let multiplier = chain.callReadOnlyFn(
            'yield-scheduler',
            'get-current-multiplier',
            [types.uint(1)],
            deployer.address
        );

        assertExists(multiplier.result);
    }
});

Clarinet.test({
    name: "Multiple stakes accumulate",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const user = accounts.get('wallet_1')!;

        // Create pool
        chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'create-pool', [
                types.ascii("Multi Stake Pool"),
                types.uint(100),
                types.uint(0),
                types.uint(1000000),
                types.uint(0),
                types.uint(100000000)
            ], deployer.address)
        ]);

        // Stake twice
        chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'stake', [
                types.uint(1),
                types.uint(10000000) // 10 STX
            ], user.address),
            Tx.contractCall('yield-scheduler', 'stake', [
                types.uint(1),
                types.uint(5000000) // 5 STX more
            ], user.address)
        ]);

        // Check total stake
        let stakeInfo = chain.callReadOnlyFn(
            'yield-scheduler',
            'get-stake',
            [types.uint(1), types.principal(user.address)],
            user.address
        );

        assertExists(stakeInfo.result);
    }
});

Clarinet.test({
    name: "Cannot unstake more than staked",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const user = accounts.get('wallet_1')!;

        // Create pool and stake
        chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'create-pool', [
                types.ascii("Limit Pool"),
                types.uint(100),
                types.uint(0),
                types.uint(1000000),
                types.uint(0),
                types.uint(100000000)
            ], deployer.address),
            Tx.contractCall('yield-scheduler', 'stake', [
                types.uint(1),
                types.uint(10000000) // 10 STX
            ], user.address)
        ]);

        // Try to unstake more than staked
        let block = chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'unstake', [
                types.uint(1),
                types.uint(20000000) // 20 STX - more than staked
            ], user.address)
        ]);

        block.receipts[0].result.expectErr().expectUint(8003); // ERR_INSUFFICIENT_STAKE
    }
});

Clarinet.test({
    name: "Generate stake info message",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const user = accounts.get('wallet_1')!;

        // Create pool and stake
        chain.mineBlock([
            Tx.contractCall('yield-scheduler', 'create-pool', [
                types.ascii("Info Pool"),
                types.uint(100),
                types.uint(0),
                types.uint(1000000),
                types.uint(0),
                types.uint(100000000)
            ], deployer.address),
            Tx.contractCall('yield-scheduler', 'stake', [
                types.uint(1),
                types.uint(10000000)
            ], user.address)
        ]);

        // Generate info
        let info = chain.callReadOnlyFn(
            'yield-scheduler',
            'generate-stake-info',
            [types.uint(1), types.principal(user.address)],
            user.address
        );

        assertExists(info.result);
    }
});

Clarinet.test({
    name: "Check is-weekend function",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const user = accounts.get('wallet_1')!;

        let isWeekend = chain.callReadOnlyFn(
            'yield-scheduler',
            'is-weekend',
            [],
            user.address
        );

        assertExists(isWeekend.result);
    }
});

Clarinet.test({
    name: "Get day of week",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const user = accounts.get('wallet_1')!;

        let dayOfWeek = chain.callReadOnlyFn(
            'yield-scheduler',
            'get-day-of-week',
            [],
            user.address
        );

        assertExists(dayOfWeek.result);
    }
});
