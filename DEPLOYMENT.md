# Yield Scheduler - Testnet Deployment Guide

## Prerequisites

✅ Contracts verified with `clarinet check`
✅ Clarity 4 compatible (epoch 3.3)
✅ Event logging implemented
✅ Comprehensive test coverage

## Step 1: Generate Testnet Wallet

You need a Stacks testnet wallet to deploy. Choose one method:

### Option A: Using Hiro Wallet (Recommended)
1. Install Hiro Wallet browser extension
2. Create new wallet and **save your seed phrase securely**
3. Switch to Testnet network in wallet settings
4. Copy your testnet address

### Option B: Using Stacks CLI
```bash
npm install -g @stacks/cli
stx make_keychain -t 2>&1 | head -1
```

Save the output securely - it contains your mnemonic and address.

## Step 2: Fund Your Testnet Wallet

1. Go to: https://explorer.hiro.so/sandbox/faucet?chain=testnet
2. Enter your testnet address
3. Request testnet STX (you'll need at least 1 STX for deployment fees)
4. Wait for confirmation (~10 minutes)

## Step 3: Configure Deployment Settings

Edit `settings/Testnet.toml` and replace the placeholder with your mnemonic:

```toml
[network]
name = "testnet"
node_rpc_address = "https://api.testnet.hiro.so"
deployment_fee_rate = 10

[[network.accounts]]
mnemonic = "YOUR_MNEMONIC_PHRASE_HERE"
# Example: "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12"

[contracts]
```

**⚠️ SECURITY WARNING**: Never commit your mnemonic to Git! The `.gitignore` file excludes settings files by default.

## Step 4: Generate Deployment Plan

```bash
cd /Users/user/gwill/claritycodes/stacks-clarity4-projects/yield-scheduler
clarinet deployments generate --testnet --low-cost
```

This creates a deployment plan file in `deployments/testnet/`.

## Step 5: Review Deployment Plan

```bash
cat deployments/testnet/<generated-file>.yaml
```

Verify:
- Contract names are correct
- Deployment order (reward-token first, then yield-scheduler)
- Estimated fees

## Step 6: Deploy to Testnet

```bash
clarinet deployments apply --testnet
```

This will:
1. Deploy `reward-token.clar`
2. Deploy `yield-scheduler.clar`
3. Print transaction IDs for each contract

## Step 7: Verify Deployment

After deployment completes, you'll receive transaction IDs. Verify on Stacks Explorer:

```
https://explorer.hiro.so/txid/<TRANSACTION_ID>?chain=testnet
```

Check contract on explorer:
```
https://explorer.hiro.so/address/<YOUR_ADDRESS>?chain=testnet
```

## Step 8: Update README with Deployment Info

Once deployed, update README.md with:
- Deployer address
- Contract addresses
- Transaction IDs
- Explorer links

## Troubleshooting

### "unable to retrieve default deployer account"
- Verify your mnemonic is correctly set in `settings/Testnet.toml`
- Ensure mnemonic is in quotes and properly formatted

### "insufficient funds"
- Request more testnet STX from faucet
- Wait for faucet transaction to confirm

### "transaction failed"
- Check Clarity syntax errors with `clarinet check`
- Verify network connectivity
- Check testnet status: https://status.test-net.stacks.co/

### "nonce too low"
- Previous deployment may still be pending
- Wait a few minutes and try again

## Post-Deployment

### Test the Contract

1. **Create a test pool**:
```bash
stx call <CONTRACT_ADDRESS>.yield-scheduler create-pool \
  '("Test Pool", u100, u0, u1000000, u0, u0)' \
  --testnet
```

2. **Verify pool creation**:
```bash
stx call_read_only <CONTRACT_ADDRESS>.yield-scheduler get-pool u1 --testnet
```

### Monitor Events

All major contract actions emit events:
- `staked` - User stakes tokens
- `unstaked` - User unstakes tokens
- `rewards-claimed` - User claims rewards
- `compounded` - User compounds rewards
- `pool-funded` - Pool receives funding
- `bonus-schedule-added` - Bonus schedule added
- `pool-status-changed` - Pool activated/deactivated

View events in Stacks Explorer transaction details.

## Next Steps

1. ✅ Deploy contracts to testnet
2. 📝 Update README.md with deployment information
3. 🔄 Push to GitHub: https://github.com/big14way/yield-rescheduler.git
4. 🧪 Test all contract functions on testnet
5. 📊 Set up monitoring/indexing (optional)
6. 🚀 Plan mainnet deployment (if applicable)

## Support

- Stacks Discord: https://discord.gg/stacks
- Clarity Documentation: https://docs.stacks.co/clarity
- Clarinet Docs: https://docs.hiro.so/clarinet
