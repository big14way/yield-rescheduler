# Yield Scheduler Chainhooks Integration

Real-time event tracking and analytics for the Yield Scheduler platform. Monitors staking pools, reward distribution, bonus schedules, and yield generation using Stacks Chainhooks.

## Features

### Event Tracking

This integration monitors all key Yield Scheduler events:

1. **Pool Management**
   - **Pool Creation** (`create-pool`) - New staking pool initialization
   - **Bonus Schedules** (`add-bonus-schedule`) - Time-based reward multipliers
   - **Pool Funding** (`fund-rewards-pool`) - Adding rewards to pools
   - **Pool Status** (`set-pool-active`) - Enable/disable pools
   - Tracks pool types: Linear, Bonus Weekend, Tiered, Decay

2. **Staking Operations**
   - **Stake** (`stake`) - Users depositing tokens
   - **Unstake** (`unstake`) - Users withdrawing tokens
   - **Cooldown Periods**: Track withdrawal restrictions
   - **Minimum Stakes**: Enforce pool requirements

3. **Reward Distribution**
   - **Claim Rewards** (`claim-rewards`) - Users claiming earned yield
   - **Compound** (`compound`) - Auto-restake rewards
   - **Reward Rates**: Track APY and multipliers
   - **Time-based Bonuses**: Weekend and scheduled multipliers

4. **Yield Metrics**
   - Total value staked (TVS)
   - Total rewards distributed
   - Average stake per user
   - Pool performance by schedule type
   - Compound vs claim ratios

### Analytics Collected

The integration tracks comprehensive metrics:

- **Users**: Unique stakers
- **Pools**: Total pools created
- **Total Staked**: Aggregate value in all pools
- **Rewards Distributed**: Total yield paid out
- **Stake/Unstake**: Operation counts
- **Claims/Compounds**: Distribution breakdown
- **Bonus Schedules**: Active multiplier periods
- **Pool Distribution**: Breakdown by schedule type

## Setup

### Prerequisites

- Node.js 18+ and npm
- Access to a Stacks Chainhook node (Hiro Platform or self-hosted)
- The Yield Scheduler contract deployed on Stacks testnet/mainnet

### Installation

1. Navigate to the chainhooks directory:
```bash
cd yield-scheduler/chainhooks
```

2. Install dependencies:
```bash
npm install
```

3. Copy and configure environment variables:
```bash
cp .env.example .env
```

4. Edit `.env` with your configuration:
```env
# Chainhook Node Configuration
CHAINHOOK_NODE_URL=http://localhost:20456

# Server Configuration
SERVER_HOST=0.0.0.0
SERVER_PORT=3003
SERVER_AUTH_TOKEN=your-secret-token-here
EXTERNAL_BASE_URL=http://localhost:3003

# Contract Configuration
SCHEDULER_CONTRACT=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.yield-scheduler
REWARD_TOKEN_CONTRACT=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.reward-token

# Starting block height
START_BLOCK=0

# Network
NETWORK=testnet
```

### Running the Observer

Start the Chainhook observer:

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

## Contract Events

### Monitored Functions

| Function | Description | Actor | Fee |
|----------|-------------|-------|-----|
| `create-pool` | Create staking pool | Admin | None |
| `add-bonus-schedule` | Add reward multiplier | Admin | None |
| `stake` | Deposit tokens | User | None |
| `unstake` | Withdraw tokens | User | Cooldown applies |
| `claim-rewards` | Claim yield | User | None |
| `compound` | Restake rewards | User | None |
| `fund-rewards-pool` | Add rewards | Anyone | None |
| `set-pool-active` | Toggle pool | Admin | None |

### Print Events Tracked

The contract emits detailed print events:

```clarity
{event: "pool-created", pool-id: uint, name: string, reward-rate: uint, schedule-type: uint}
{event: "bonus-schedule-added", pool-id: uint, schedule-index: uint, name: string, multiplier: uint}
{event: "staked", pool-id: uint, staker: principal, amount: uint, total-amount: uint}
{event: "unstaked", pool-id: uint, staker: principal, amount: uint, remaining: uint}
{event: "rewards-claimed", pool-id: uint, staker: principal, amount: uint, total-earned: uint}
{event: "compounded", pool-id: uint, staker: principal, amount: uint, new-total: uint}
{event: "pool-funded", pool-id: uint, funder: principal, amount: uint, new-total: uint}
{event: "pool-status-changed", pool-id: uint, active: bool, admin: principal}
```

### Schedule Types

- **0 = Linear**: Constant reward rate
- **1 = Bonus Weekend**: 2x rewards on weekends
- **2 = Tiered**: Higher rewards for larger stakes
- **3 = Decay**: Decreasing rewards over time

## Analytics Output

Analytics data is saved to `analytics-data.json`:

```json
{
  "users": ["ST1...", "ST2..."],
  "uniqueUsers": 156,
  "totalPools": 8,
  "totalStaked": 50000000000,
  "totalRewardsDistributed": 5000000000,
  "avgStakePerUser": 320512821,
  "totalStakeOperations": 445,
  "totalUnstakeOperations": 123,
  "totalClaims": 289,
  "totalCompounds": 178,
  "poolsBySchedule": {
    "linear": 3,
    "bonusWeekend": 2,
    "tiered": 2,
    "decay": 1
  },
  "pools": [
    {
      "creator": "ST...",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "txid": "0x..."
    }
  ],
  "stakes": [...],
  "unstakes": [...],
  "claims": [...],
  "compounds": [...],
  "bonusSchedules": [...],
  "timestamp": "2024-01-15T12:00:00.000Z"
}
```

## Key Metrics

### Pool Statistics

- **Total Pools**: Number of staking pools
- **Active Pools**: Currently accepting stakes
- **Pool Distribution**: Breakdown by schedule type
- **Total Staked**: Aggregate value across pools

### Yield Metrics

- **Total Rewards**: Aggregate yield distributed
- **Claim Rate**: Claims vs compounds ratio
- **Average Stake**: Per user staking amount
- **Pool Utilization**: Staked vs capacity

### User Behavior

- **Compound Ratio**: Auto-restaking frequency
- **Hold Duration**: Average stake duration
- **Pool Preferences**: Most popular pool types
- **Bonus Utilization**: Weekend/bonus period activity

## Use Cases

### DeFi Analytics
- Track total value staked
- Monitor yield distribution
- Analyze pool performance

### Pool Optimization
- Identify most popular schedule types
- Optimize reward rates
- Adjust bonus multipliers

### User Insights
- Track staking patterns
- Monitor compound vs claim behavior
- Analyze retention metrics

### Revenue Projection
- Forecast reward distribution
- Calculate pool sustainability
- Project TVL growth

## Architecture

The integration uses the Hiro Chainhook Event Observer to:

1. Register predicates for scheduler contract functions
2. Listen for on-chain events in real-time
3. Parse transaction data and print events
4. Aggregate staking and reward metrics
5. Persist analytics with graceful shutdown

## Troubleshooting

### Observer won't start
- Verify Chainhook node URL is accessible
- Check contract address matches deployment
- Ensure START_BLOCK is valid

### Missing staking events
- Confirm contract is deployed and active
- Verify network setting matches deployment
- Check Chainhook node sync status

### Reward calculation issues
- Ensure all claims/compounds are captured
- Verify reward rate tracking
- Check for time-based multiplier handling

## Production Considerations

For production deployments:

1. **Database Integration**: Use PostgreSQL for stake/reward tracking
2. **Real-time APY**: Calculate current yields
3. **User Dashboard**: Show personal staking stats
4. **Pool Analytics**: Performance comparison
5. **Alert System**: Low reward pool notifications
6. **API Layer**: Expose metrics via REST/GraphQL

## Schedule Types Explained

### Linear (Type 0)
- **Fixed Rate**: Constant reward rate
- **Predictable**: Easy to calculate returns
- **Use Case**: Conservative stakers

### Bonus Weekend (Type 1)
- **Time-based**: 2x rewards on weekends
- **Dynamic**: Uses `stacks-block-time` for day calculation
- **Use Case**: Active traders

### Tiered (Type 2)
- **Amount-based**: Higher stakes = higher rates
- **Incentive**: Encourage larger deposits
- **Use Case**: Whale stakers

### Decay (Type 3)
- **Time-based**: Rewards decrease over time
- **Early Advantage**: Higher initial yields
- **Use Case**: Launch incentives

## Bonus Schedule System

Pools can have up to 5 active bonus schedules:

```clarity
{
  name: "Summer Promo",
  multiplier: 15000,  // 1.5x rewards (10000 = 1x)
  start-time: 1704067200,
  end-time: 1711929600,
  active: true
}
```

The contract automatically applies the highest active multiplier at any given time.

## Reward Calculation

Base reward formula:
```
reward = (staked_amount * reward_rate * time_elapsed) / ONE_DAY
```

With multiplier:
```
final_reward = (base_reward * multiplier) / 10000
```

Example:
- Staked: 1000 tokens
- Rate: 100 (1% daily)
- Time: 1 day
- Multiplier: 15000 (1.5x)
- Reward: (1000 * 100 * 86400) / 86400 * 15000 / 10000 = 15 tokens

## Security Features

### Cooldown Periods
- Configurable unstake delays
- Protection against flash loan attacks
- Per-pool settings

### Minimum Stakes
- Prevent dust attacks
- Reduce gas costs
- Maintain pool efficiency

### Active/Inactive Pools
- Admin control over pool status
- Emergency pause capability
- Migration support

## Contract Information

- **Scheduler Contract**: `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.yield-scheduler`
- **Reward Token**: `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.reward-token`
- **Network**: Stacks Testnet
- **Clarity Version**: 4 (Epoch 3.3)
- **Features**: `stacks-block-time`, `to-ascii?`

## Resources

- [Stacks Chainhooks Documentation](https://docs.hiro.so/chainhooks)
- [Yield Scheduler Contract](../contracts/yield-scheduler.clar)
- [Reward Token Contract](../contracts/reward-token.clar)
- [Hiro Platform](https://platform.hiro.so/)

## License

MIT
