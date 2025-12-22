# Time-Based Yield Scheduler

A DeFi staking protocol with customizable time-based reward schedules, bonus periods, and dynamic multipliers.

## Clarity 4 Features Used

| Feature | Usage |
|---------|-------|
| `stacks-block-time` | Real-time schedule evaluation, cooldown enforcement, reward calculation |
| `restrict-assets?` | Safe token transfers during stake/unstake operations |
| `to-ascii?` | Human-readable pool status and stake info messages |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Pool Manager                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  create-pool() → Define reward rate, schedule type    │   │
│  │  add-bonus-schedule() → Time-based multipliers        │   │
│  │  fund-rewards-pool() → Add rewards                    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Schedule Engine                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  stacks-block-time → Current timestamp                │   │
│  │  get-current-multiplier() → Active bonus check        │   │
│  │  is-weekend() → Weekend detection                     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Staking Engine                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  stake() → Lock tokens with restrict-assets?          │   │
│  │  unstake() → Withdraw with cooldown check             │   │
│  │  claim-rewards() → Collect earned rewards             │   │
│  │  compound() → Auto-restake rewards                    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Schedule Types

| Type | Description | Multiplier Logic |
|------|-------------|------------------|
| `LINEAR` | Constant rewards | Always 1x |
| `BONUS_WEEKEND` | 2x on weekends | Sat/Sun = 2x |
| `TIERED` | Duration-based | Longer stake = higher rewards |
| `DECAY` | Decreasing over time | Early = higher rewards |

## Features

### For Pool Creators
- Custom reward rates and schedules
- Add bonus periods (happy hours, events)
- Set minimum stakes and cooldowns
- Fund and manage reward pools

### For Stakers
- Stake tokens to earn rewards
- Automatic multiplier application
- Compound rewards for maximum APY
- View pending rewards in real-time

## Contract Functions

### Pool Management

```clarity
;; Create a new staking pool
(create-pool 
    (name (string-ascii 64))
    (reward-rate uint)        ;; Base reward rate in basis points
    (schedule-type uint)      ;; 0=LINEAR, 1=WEEKEND, 2=TIERED, 3=DECAY
    (min-stake uint)          ;; Minimum stake amount
    (cooldown-period uint)    ;; Seconds before unstake allowed
    (initial-rewards uint))   ;; Initial rewards to fund pool

;; Add bonus schedule
(add-bonus-schedule
    (pool-id uint)
    (name (string-ascii 32))
    (multiplier uint)         ;; 10000 = 1x, 20000 = 2x
    (start-time uint)
    (duration uint))

;; Fund rewards pool
(fund-rewards-pool (pool-id uint) (amount uint))
```

### Staking Functions

```clarity
;; Stake tokens
(stake (pool-id uint) (amount uint))

;; Unstake tokens
(unstake (pool-id uint) (amount uint))

;; Claim pending rewards
(claim-rewards (pool-id uint))

;; Compound rewards (auto-restake)
(compound (pool-id uint))
```

### Read-Only Helpers

```clarity
;; Get current multiplier for pool
(get-current-multiplier (pool-id uint))

;; Calculate pending rewards
(calculate-pending-rewards (pool-id uint) (staker principal))

;; Check if it's weekend
(is-weekend)

;; Generate pool status message
(generate-pool-status (pool-id uint))
;; Returns: "Pool #1: STX Staking Pool | Staked: 1000000 | Rate: 100"
```

## Reward Calculation

```
base_reward = (stake_amount × reward_rate × time_elapsed) / ONE_DAY
multiplier = get_current_multiplier(pool_id)
final_reward = (base_reward × multiplier) / 10000
```

### Example
- Stake: 1000 STX
- Reward Rate: 100 (1%)
- Time Staked: 7 days
- Multiplier: 20000 (2x weekend bonus)

```
base = (1000 × 100 × 604800) / 86400 = 700 STX
final = (700 × 20000) / 10000 = 1400 STX
```

## Bonus Schedule Presets

```clarity
;; Weekend Bonus: 2x rewards on Sat/Sun
(add-bonus-schedule pool-id "Weekend Bonus" u20000 start-time u172800)

;; Happy Hour: 1.5x for 2 hours daily
(add-bonus-schedule pool-id "Happy Hour" u15000 start-time u7200)

;; Early Bird: 3x for first week
(add-bonus-schedule pool-id "Early Bird" u30000 start-time u604800)

;; Loyalty Bonus: 1.25x after 30 days
(add-bonus-schedule pool-id "Loyalty" u12500 (+ start u2592000) u0)
```

## Status

✅ **Clarity 4 compatible** (epoch 3.3)
✅ **All tests passing**
✅ **Comprehensive test coverage** (27 tests)
✅ **Event logging for monitoring**
✅ **Best practices .gitignore**
✅ **Ready for testnet deployment**

## Installation & Testing

```bash
cd yield-scheduler
clarinet check  # Verify syntax and Clarity 4 compatibility
```

## Deployment

### Testnet Deployment Steps

1. **Generate deployer wallet**:
```bash
npm install -g @stacks/cli
stx make_keychain -t 2>&1 | head -1
```

2. **Update settings/Testnet.toml** with your mnemonic

3. **Fund testnet address** at https://explorer.hiro.so/sandbox/faucet?chain=testnet

4. **Deploy contracts**:
```bash
clarinet deployments generate --testnet
clarinet deployments apply --testnet
```

### Deployment Information

**Network**: Stacks Testnet
**Deployer Address**: `ST1S3R27KWS78BZQJ3XF3BQK89VZTHHCPZMD3TTTK`
**Block Height**: 3691661
**Deployment Cost**: 0.137280 STX

**Transactions**:
- **Faucet TX**: [0x42f8b59a3e1973845d8ae2d9c751e8fec98ffba62769c4ffbb3689e8b5e11d98](https://explorer.hiro.so/txid/0x42f8b59a3e1973845d8ae2d9c751e8fec98ffba62769c4ffbb3689e8b5e11d98?chain=testnet)
- **reward-token**: [0x0f63cf43e6f0b4be07f83d2a12a9fb25e70308a3a4a563491b144ebc284b413c](https://explorer.hiro.so/txid/0x0f63cf43e6f0b4be07f83d2a12a9fb25e70308a3a4a563491b144ebc284b413c?chain=testnet)
- **yield-scheduler**: [0xd9cfc43a73eb784294dc38933bbe2c84d4763e2a7fedd5c06ec33dfeef69b73e](https://explorer.hiro.so/txid/0xd9cfc43a73eb784294dc38933bbe2c84d4763e2a7fedd5c06ec33dfeef69b73e?chain=testnet)

**Contract Addresses**:
- [ST1S3R27KWS78BZQJ3XF3BQK89VZTHHCPZMD3TTTK.reward-token](https://explorer.hiro.so/txid/ST1S3R27KWS78BZQJ3XF3BQK89VZTHHCPZMD3TTTK.reward-token?chain=testnet)
- [ST1S3R27KWS78BZQJ3XF3BQK89VZTHHCPZMD3TTTK.yield-scheduler](https://explorer.hiro.so/txid/ST1S3R27KWS78BZQJ3XF3BQK89VZTHHCPZMD3TTTK.yield-scheduler?chain=testnet)

**Explorer**: https://explorer.hiro.so/address/ST1S3R27KWS78BZQJ3XF3BQK89VZTHHCPZMD3TTTK?chain=testnet

## Example: Create Weekend Bonus Pool

```typescript
// 1. Create pool with weekend schedule
const poolId = await createPool({
    name: "Weekend Warriors",
    rewardRate: 500,           // 5% base
    scheduleType: 1,           // BONUS_WEEKEND
    minStake: 10000000,        // 10 STX
    cooldownPeriod: 86400,     // 1 day
    initialRewards: 1000000000 // 1000 STX rewards
});

// 2. User stakes on Friday
await stake(poolId, 100000000); // 100 STX

// 3. Weekend arrives - 2x multiplier active
const multiplier = await getCurrentMultiplier(poolId);
// Returns: 20000 (2x)

// 4. Check pending rewards
const pending = await calculatePendingRewards(poolId, userAddress);

// 5. Compound for maximum gains
await compound(poolId);
```

## Security Features

1. **Cooldown Periods**: Prevent flash stake attacks
2. **Minimum Stakes**: Ensure meaningful participation
3. **Asset Protection**: `restrict-assets?` on all transfers
4. **Admin Controls**: Pool pause/unpause capability

## APY Calculation

With compound frequency factored in:

```
APY = (1 + (reward_rate / compounds_per_year))^compounds_per_year - 1
```

Daily compounding at 5% base rate:
```
APY = (1 + 0.05/365)^365 - 1 = 5.13%
```

With 2x weekend bonus (approx 28% of year):
```
Effective APY ≈ 6.5%
```

## Hiro Chainhooks Integration

This project includes a **Hiro Chainhooks** implementation for real-time monitoring of staking activity, reward distributions, and pool performance metrics.

### Features

✅ **Real-time Pool Tracking**: Monitor pool creation, staking, unstaking, and reward claims
✅ **User Analytics**: Track staker participation, compound frequency, and retention
✅ **Reward Monitoring**: Calculate and track total rewards distributed across all pools
✅ **Schedule Analytics**: Monitor bonus period effectiveness and multiplier usage
✅ **Reorg-Resistant**: Chainhook's built-in protection against blockchain reorganizations

### Tracked Events

| Event | Contract Function | Data Collected |
|-------|------------------|----------------|
| Pool Created | `create-pool` | Name, reward rate, schedule type, min stake |
| Tokens Staked | `stake` | Pool ID, staker, amount, timestamp |
| Tokens Unstaked | `unstake` | Pool ID, staker, amount, cooldown check |
| Rewards Claimed | `claim-rewards` | Pool ID, staker, reward amount |
| Rewards Compounded | `compound` | Pool ID, staker, compounded amount |
| Bonus Schedule Added | `add-bonus-schedule` | Pool ID, multiplier, start time, duration |
| Pool Funded | `fund-rewards-pool` | Pool ID, amount added |

### Analytics Output

The Chainhooks observer generates real-time analytics:

```json
{
  "totalPools": 15,
  "uniqueStakers": 234,
  "totalStaked": 45000000000,
  "totalRewardsDistributed": 2340000000,
  "totalRewardsClaimed": 1890000000,
  "totalCompounds": 567,
  "activeSchedules": 23,
  "pools": [...],
  "stakes": [...],
  "claims": [...],
  "timestamp": "2025-12-16T10:30:00.000Z"
}
```

### Quick Start

```bash
cd chainhooks
npm install
cp .env.example .env
# Edit .env with your configuration
npm start
```

For detailed setup and configuration, see [chainhooks/README.md](./chainhooks/README.md).

### Use Cases

- **Pool Dashboard**: Real-time metrics for TVL, APY, and reward distributions
- **Staker Analytics**: Track user behavior, compound frequency, and retention rates
- **Schedule Optimization**: Analyze bonus period effectiveness and multiplier impact
- **Compliance Monitoring**: Audit trail of all staking operations and reward distributions
- **Risk Management**: Monitor pool health, reward pool balances, and withdrawal patterns
- **Marketing Analytics**: Measure campaign effectiveness through staking activity spikes

## License

MIT License

## WalletConnect Integration

This project includes a fully-functional React dApp with WalletConnect v2 integration for seamless interaction with Stacks blockchain wallets.

### Features

- **🔗 Multi-Wallet Support**: Connect with any WalletConnect-compatible Stacks wallet
- **✍️ Transaction Signing**: Sign messages and submit transactions directly from the dApp
- **📝 Contract Interactions**: Call smart contract functions on Stacks testnet
- **🔐 Secure Connection**: End-to-end encrypted communication via WalletConnect relay
- **📱 QR Code Support**: Easy mobile wallet connection via QR code scanning

### Quick Start

#### Prerequisites

- Node.js (v16.x or higher)
- npm or yarn package manager
- A Stacks wallet (Xverse, Leather, or any WalletConnect-compatible wallet)

#### Installation

```bash
cd dapp
npm install
```

#### Running the dApp

```bash
npm start
```

The dApp will open in your browser at `http://localhost:3000`

#### Building for Production

```bash
npm run build
```

### WalletConnect Configuration

The dApp is pre-configured with:

- **Project ID**: 1eebe528ca0ce94a99ceaa2e915058d7
- **Network**: Stacks Testnet (Chain ID: `stacks:2147483648`)
- **Relay**: wss://relay.walletconnect.com
- **Supported Methods**:
  - `stacks_signMessage` - Sign arbitrary messages
  - `stacks_stxTransfer` - Transfer STX tokens
  - `stacks_contractCall` - Call smart contract functions
  - `stacks_contractDeploy` - Deploy new smart contracts

### Project Structure

```
dapp/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── WalletConnectButton.js      # Wallet connection UI
│   │   └── ContractInteraction.js       # Contract call interface
│   ├── contexts/
│   │   └── WalletConnectContext.js     # WalletConnect state management
│   ├── hooks/                            # Custom React hooks
│   ├── utils/                            # Utility functions
│   ├── config/
│   │   └── stacksConfig.js             # Network and contract configuration
│   ├── styles/                          # CSS styling
│   ├── App.js                           # Main application component
│   └── index.js                         # Application entry point
└── package.json
```

### Usage Guide

#### 1. Connect Your Wallet

Click the "Connect Wallet" button in the header. A QR code will appear - scan it with your mobile Stacks wallet or use the desktop wallet extension.

#### 2. Interact with Contracts

Once connected, you can:

- View your connected address
- Call read-only contract functions
- Submit contract call transactions
- Sign messages for authentication

#### 3. Disconnect

Click the "Disconnect" button to end the WalletConnect session.

### Customization

#### Updating Contract Configuration

Edit `src/config/stacksConfig.js` to point to your deployed contracts:

```javascript
export const CONTRACT_CONFIG = {
  contractName: 'your-contract-name',
  contractAddress: 'YOUR_CONTRACT_ADDRESS',
  network: 'testnet' // or 'mainnet'
};
```

#### Adding Custom Contract Functions

Modify `src/components/ContractInteraction.js` to add your contract-specific functions:

```javascript
const myCustomFunction = async () => {
  const result = await callContract(
    CONTRACT_CONFIG.contractAddress,
    CONTRACT_CONFIG.contractName,
    'your-function-name',
    [functionArgs]
  );
};
```

### Technical Details

#### WalletConnect v2 Implementation

The dApp uses the official WalletConnect v2 Sign Client with:

- **@walletconnect/sign-client**: Core WalletConnect functionality
- **@walletconnect/utils**: Helper utilities for encoding/decoding
- **@walletconnect/qrcode-modal**: QR code display for mobile connection
- **@stacks/connect**: Stacks-specific wallet integration
- **@stacks/transactions**: Transaction building and signing
- **@stacks/network**: Network configuration for testnet/mainnet

#### BigInt Serialization

The dApp includes BigInt serialization support for handling large numbers in Clarity contracts:

```javascript
BigInt.prototype.toJSON = function() { return this.toString(); };
```

### Supported Wallets

Any wallet supporting WalletConnect v2 and Stacks blockchain, including:

- **Xverse Wallet** (Recommended)
- **Leather Wallet** (formerly Hiro Wallet)
- **Boom Wallet**
- Any other WalletConnect-compatible Stacks wallet

### Troubleshooting

**Connection Issues:**
- Ensure your wallet app supports WalletConnect v2
- Check that you're on the correct network (testnet vs mainnet)
- Try refreshing the QR code or restarting the dApp

**Transaction Failures:**
- Verify you have sufficient STX for gas fees
- Confirm the contract address and function names are correct
- Check that post-conditions are properly configured

**Build Errors:**
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Ensure Node.js version is 16.x or higher
- Check for dependency conflicts in package.json

### Resources

- [WalletConnect Documentation](https://docs.walletconnect.com/)
- [Stacks.js Documentation](https://docs.stacks.co/build-apps/stacks.js)
- [Xverse WalletConnect Guide](https://docs.xverse.app/wallet-connect)
- [Stacks Blockchain Documentation](https://docs.stacks.co/)

### Security Considerations

- Never commit your private keys or seed phrases
- Always verify transaction details before signing
- Use testnet for development and testing
- Audit smart contracts before mainnet deployment
- Keep dependencies updated for security patches

### License

This dApp implementation is provided as-is for integration with the Stacks smart contracts in this repository.

