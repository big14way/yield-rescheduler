import { ChainhookEventObserver } from '@hirosystems/chainhook-client';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Analytics storage (in production, use a database)
const analytics = {
  users: new Set(),
  totalPools: 0,
  totalStaked: 0,
  totalRewardsDistributed: 0,
  totalStakeOperations: 0,
  totalUnstakeOperations: 0,
  totalClaims: 0,
  totalCompounds: 0,
  poolsBySchedule: {
    linear: 0,
    bonusWeekend: 0,
    tiered: 0,
    decay: 0
  },
  pools: [],
  stakes: [],
  unstakes: [],
  claims: [],
  compounds: [],
  bonusSchedules: []
};

// Save analytics to JSON file
function saveAnalytics() {
  const data = {
    ...analytics,
    users: Array.from(analytics.users),
    timestamp: new Date().toISOString(),
    uniqueUsers: analytics.users.size,
    avgStakePerUser: analytics.users.size > 0 ? analytics.totalStaked / analytics.users.size : 0
  };

  fs.writeFileSync(
    path.join(process.cwd(), 'analytics-data.json'),
    JSON.stringify(data, null, 2)
  );

  console.log(`📊 Analytics saved - Users: ${data.uniqueUsers}, Pools: ${data.totalPools}, Staked: ${(data.totalStaked / 1000000).toFixed(2)}, Rewards: ${(data.totalRewardsDistributed / 1000000).toFixed(2)}`);
}

// Create predicates for yield scheduler events
function createSchedulerPredicates() {
  const contractId = process.env.SCHEDULER_CONTRACT;
  const startBlock = parseInt(process.env.START_BLOCK) || 0;
  const network = process.env.NETWORK || 'testnet';

  return [
    {
      uuid: randomUUID(),
      name: 'pool-created-events',
      version: 1,
      chain: 'stacks',
      networks: {
        [network]: {
          if_this: {
            scope: 'contract_call',
            contract_identifier: contractId,
            method: 'create-pool'
          },
          then_that: {
            http_post: {
              url: `${process.env.EXTERNAL_BASE_URL}/chainhook/pool-created`,
              authorization_header: `Bearer ${process.env.SERVER_AUTH_TOKEN}`
            }
          },
          start_block: startBlock
        }
      }
    },
    {
      uuid: randomUUID(),
      name: 'bonus-schedule-events',
      version: 1,
      chain: 'stacks',
      networks: {
        [network]: {
          if_this: {
            scope: 'contract_call',
            contract_identifier: contractId,
            method: 'add-bonus-schedule'
          },
          then_that: {
            http_post: {
              url: `${process.env.EXTERNAL_BASE_URL}/chainhook/bonus-schedule`,
              authorization_header: `Bearer ${process.env.SERVER_AUTH_TOKEN}`
            }
          },
          start_block: startBlock
        }
      }
    },
    {
      uuid: randomUUID(),
      name: 'stake-events',
      version: 1,
      chain: 'stacks',
      networks: {
        [network]: {
          if_this: {
            scope: 'contract_call',
            contract_identifier: contractId,
            method: 'stake'
          },
          then_that: {
            http_post: {
              url: `${process.env.EXTERNAL_BASE_URL}/chainhook/stake`,
              authorization_header: `Bearer ${process.env.SERVER_AUTH_TOKEN}`
            }
          },
          start_block: startBlock
        }
      }
    },
    {
      uuid: randomUUID(),
      name: 'unstake-events',
      version: 1,
      chain: 'stacks',
      networks: {
        [network]: {
          if_this: {
            scope: 'contract_call',
            contract_identifier: contractId,
            method: 'unstake'
          },
          then_that: {
            http_post: {
              url: `${process.env.EXTERNAL_BASE_URL}/chainhook/unstake`,
              authorization_header: `Bearer ${process.env.SERVER_AUTH_TOKEN}`
            }
          },
          start_block: startBlock
        }
      }
    },
    {
      uuid: randomUUID(),
      name: 'claim-rewards-events',
      version: 1,
      chain: 'stacks',
      networks: {
        [network]: {
          if_this: {
            scope: 'contract_call',
            contract_identifier: contractId,
            method: 'claim-rewards'
          },
          then_that: {
            http_post: {
              url: `${process.env.EXTERNAL_BASE_URL}/chainhook/claim`,
              authorization_header: `Bearer ${process.env.SERVER_AUTH_TOKEN}`
            }
          },
          start_block: startBlock
        }
      }
    },
    {
      uuid: randomUUID(),
      name: 'compound-events',
      version: 1,
      chain: 'stacks',
      networks: {
        [network]: {
          if_this: {
            scope: 'contract_call',
            contract_identifier: contractId,
            method: 'compound'
          },
          then_that: {
            http_post: {
              url: `${process.env.EXTERNAL_BASE_URL}/chainhook/compound`,
              authorization_header: `Bearer ${process.env.SERVER_AUTH_TOKEN}`
            }
          },
          start_block: startBlock
        }
      }
    },
    {
      uuid: randomUUID(),
      name: 'pool-funded-events',
      version: 1,
      chain: 'stacks',
      networks: {
        [network]: {
          if_this: {
            scope: 'contract_call',
            contract_identifier: contractId,
            method: 'fund-rewards-pool'
          },
          then_that: {
            http_post: {
              url: `${process.env.EXTERNAL_BASE_URL}/chainhook/pool-funded`,
              authorization_header: `Bearer ${process.env.SERVER_AUTH_TOKEN}`
            }
          },
          start_block: startBlock
        }
      }
    },
    {
      uuid: randomUUID(),
      name: 'scheduler-print-events',
      version: 1,
      chain: 'stacks',
      networks: {
        [network]: {
          if_this: {
            scope: 'print_event',
            contract_identifier: contractId,
            contains: 'event'
          },
          then_that: {
            http_post: {
              url: `${process.env.EXTERNAL_BASE_URL}/chainhook/print-event`,
              authorization_header: `Bearer ${process.env.SERVER_AUTH_TOKEN}`
            }
          },
          start_block: startBlock
        }
      }
    }
  ];
}

// Parse print event data
function parsePrintEvent(eventValue) {
  try {
    if (typeof eventValue === 'string') {
      return JSON.parse(eventValue);
    }
    return eventValue;
  } catch (error) {
    console.error('Error parsing print event:', error);
    return null;
  }
}

// Get schedule type name
function getScheduleTypeName(scheduleType) {
  const types = { 0: 'linear', 1: 'bonusWeekend', 2: 'tiered', 3: 'decay' };
  return types[scheduleType] || 'unknown';
}

// Event handler
async function handleChainhookEvent(uuid, payload) {
  console.log(`\n🔔 Event received: ${uuid}`);

  try {
    // Process transactions in the payload
    if (payload.apply && payload.apply.length > 0) {
      for (const block of payload.apply) {
        console.log(`📦 Block ${block.block_identifier.index}`);

        for (const tx of block.transactions) {
          const sender = tx.metadata.sender;
          analytics.users.add(sender);

          // Process contract calls
          if (tx.metadata.kind?.data?.contract_call) {
            const contractCall = tx.metadata.kind.data.contract_call;
            const method = contractCall.function_name;

            console.log(`  → ${sender} called ${method}`);

            switch (method) {
              case 'create-pool':
                analytics.totalPools++;
                analytics.pools.push({
                  creator: sender,
                  timestamp: new Date().toISOString(),
                  txid: tx.transaction_identifier.hash
                });
                console.log(`  🏊 Pool created`);
                break;

              case 'add-bonus-schedule':
                analytics.bonusSchedules.push({
                  creator: sender,
                  timestamp: new Date().toISOString(),
                  txid: tx.transaction_identifier.hash
                });
                console.log(`  📅 Bonus schedule added`);
                break;

              case 'stake':
                analytics.totalStakeOperations++;
                analytics.stakes.push({
                  staker: sender,
                  timestamp: new Date().toISOString(),
                  txid: tx.transaction_identifier.hash
                });
                console.log(`  💎 Stake operation`);
                break;

              case 'unstake':
                analytics.totalUnstakeOperations++;
                analytics.unstakes.push({
                  staker: sender,
                  timestamp: new Date().toISOString(),
                  txid: tx.transaction_identifier.hash
                });
                console.log(`  💸 Unstake operation`);
                break;

              case 'claim-rewards':
                analytics.totalClaims++;
                analytics.claims.push({
                  claimer: sender,
                  timestamp: new Date().toISOString(),
                  txid: tx.transaction_identifier.hash
                });
                console.log(`  🎁 Rewards claimed`);
                break;

              case 'compound':
                analytics.totalCompounds++;
                analytics.compounds.push({
                  compounder: sender,
                  timestamp: new Date().toISOString(),
                  txid: tx.transaction_identifier.hash
                });
                console.log(`  🔄 Rewards compounded`);
                break;

              case 'fund-rewards-pool':
                console.log(`  💰 Rewards pool funded`);
                break;

              case 'set-pool-active':
                console.log(`  ⚙️  Pool status changed`);
                break;
            }
          }

          // Process print events for detailed tracking
          if (tx.metadata.receipt?.events) {
            for (const event of tx.metadata.receipt.events) {
              if (event.type === 'SmartContractEvent') {
                const eventData = parsePrintEvent(event.data.value);

                if (eventData) {
                  // Track specific events from print statements
                  if (eventData.event === 'pool-created') {
                    const poolId = eventData['pool-id'] || 0;
                    const scheduleType = getScheduleTypeName(eventData['schedule-type']);
                    const rewardRate = eventData['reward-rate'] || 0;

                    analytics.poolsBySchedule[scheduleType] = (analytics.poolsBySchedule[scheduleType] || 0) + 1;

                    console.log(`  ℹ️  Pool #${poolId} created - Type: ${scheduleType}, Rate: ${rewardRate / 100}%`);
                  } else if (eventData.event === 'bonus-schedule-added') {
                    const poolId = eventData['pool-id'] || 0;
                    const multiplier = eventData.multiplier || 10000;

                    console.log(`  ℹ️  Bonus schedule added to Pool #${poolId} - Multiplier: ${multiplier / 100}%`);
                  } else if (eventData.event === 'staked') {
                    const poolId = eventData['pool-id'] || 0;
                    const amount = eventData.amount || 0;
                    const totalAmount = eventData['total-amount'] || 0;

                    analytics.totalStaked += amount;

                    console.log(`  ℹ️  Staked ${amount / 1000000} tokens in Pool #${poolId} (Total: ${totalAmount / 1000000})`);
                  } else if (eventData.event === 'unstaked') {
                    const poolId = eventData['pool-id'] || 0;
                    const amount = eventData.amount || 0;
                    const remaining = eventData.remaining || 0;

                    analytics.totalStaked -= amount;

                    console.log(`  ℹ️  Unstaked ${amount / 1000000} tokens from Pool #${poolId} (Remaining: ${remaining / 1000000})`);
                  } else if (eventData.event === 'rewards-claimed') {
                    const poolId = eventData['pool-id'] || 0;
                    const amount = eventData.amount || 0;
                    const totalEarned = eventData['total-earned'] || 0;

                    analytics.totalRewardsDistributed += amount;

                    console.log(`  ℹ️  Claimed ${amount / 1000000} rewards from Pool #${poolId} (Total earned: ${totalEarned / 1000000})`);
                  } else if (eventData.event === 'compounded') {
                    const poolId = eventData['pool-id'] || 0;
                    const amount = eventData.amount || 0;
                    const newTotal = eventData['new-total'] || 0;

                    analytics.totalRewardsDistributed += amount;
                    analytics.totalStaked += amount;

                    console.log(`  ℹ️  Compounded ${amount / 1000000} rewards in Pool #${poolId} (New total: ${newTotal / 1000000})`);
                  } else if (eventData.event === 'pool-funded') {
                    const poolId = eventData['pool-id'] || 0;
                    const amount = eventData.amount || 0;

                    console.log(`  ℹ️  Pool #${poolId} funded with ${amount / 1000000} rewards`);
                  }
                }
              }
            }
          }
        }
      }

      // Save analytics after processing
      saveAnalytics();
    }

  } catch (error) {
    console.error('Error processing event:', error);
  }
}

// Start the observer
async function start() {
  console.log('🚀 Starting Yield Scheduler Chainhook Observer\n');

  const serverOptions = {
    hostname: process.env.SERVER_HOST,
    port: parseInt(process.env.SERVER_PORT),
    auth_token: process.env.SERVER_AUTH_TOKEN,
    external_base_url: process.env.EXTERNAL_BASE_URL
  };

  const chainhookOptions = {
    base_url: process.env.CHAINHOOK_NODE_URL
  };

  const predicates = createSchedulerPredicates();

  console.log(`📡 Server: ${serverOptions.external_base_url}`);
  console.log(`🔗 Chainhook Node: ${chainhookOptions.base_url}`);
  console.log(`📋 Monitoring ${predicates.length} event types\n`);
  console.log(`📝 Contract: ${process.env.SCHEDULER_CONTRACT}\n`);

  const observer = new ChainhookEventObserver(serverOptions, chainhookOptions);

  try {
    await observer.start(predicates, handleChainhookEvent);
    console.log('✅ Observer started successfully!\n');
    console.log('Tracking:');
    console.log('  - Pool creation and management');
    console.log('  - Staking and unstaking operations');
    console.log('  - Reward claims and compounds');
    console.log('  - Bonus schedules (weekend, tiered, decay)');
    console.log('  - Total value staked and rewards distributed\n');
    console.log('Waiting for events...\n');
  } catch (error) {
    console.error('❌ Failed to start observer:', error.message);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down gracefully...');
  saveAnalytics();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n👋 Shutting down gracefully...');
  saveAnalytics();
  process.exit(0);
});

// Start the observer
start().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
