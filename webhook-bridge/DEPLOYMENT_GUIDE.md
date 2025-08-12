# Bybit Trading System - Deployment & Testing Guide

This guide will walk you through deploying and testing your automated Bybit trading system step-by-step.

## Phase 1: Pre-Deployment Setup

### 1.1 Bybit Testnet Account Setup

1. **Create Testnet Account**
   - Visit: https://testnet.bybit.com/
   - Sign up with email and password
   - Complete email verification

2. **Generate API Keys**
   - Login to testnet dashboard
   - Go to Account & Security → API Management
   - Create new API key with these permissions:
     - ✅ Read-Write
     - ✅ Contract Trading
     - ✅ Spot Trading
   - **IMPORTANT**: Save API Key and Secret immediately (you can't see secret again)

3. **Fund Testnet Account**
   - Go to Assets → Spot Account
   - Click "Get Testnet Assets" 
   - Request USDT (you'll get ~10,000 USDT for testing)

4. **Verify API Access**
   - Note your API Key and Secret for deployment
   - Test API connectivity using Postman or similar (optional)

### 1.2 Local Environment Setup

1. **Install Wrangler CLI** (if not installed):
   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare**:
   ```bash
   wrangler login
   ```

3. **Navigate to Project**:
   ```bash
   cd /path/to/your/project/webhook-bridge
   ```

## Phase 2: Cloudflare Worker Deployment

### 2.1 Deploy the Worker

```bash
# Deploy to Cloudflare
wrangler deploy

# You should see output like:
# ✨ Successfully deployed to https://your-worker-name.your-subdomain.workers.dev
```

**Save the worker URL** - you'll need it for webhooks!

### 2.2 Configure Secrets

Set your Bybit API credentials as encrypted secrets:

```bash
# Set API key (paste your key when prompted)
wrangler secret put BYBIT_API_KEY

# Set API secret (paste your secret when prompted) 
wrangler secret put BYBIT_API_SECRET
```

### 2.3 Verify Environment Variables

Check your `wrangler.jsonc` has correct settings:

```jsonc
{
  "vars": {
    "WEBHOOK_SECRET": "k9P$Xz83!vW@b12N#rTe",
    "BYBIT_TESTNET": "true",                    // IMPORTANT: Keep as "true" for testing
    "MAX_RISK_PER_TRADE": "2",                 // 2% risk per trade
    "MAX_DAILY_LOSS": "10",                    // 10% max daily loss
    "ALLOWED_SYMBOLS": "BTCUSDT,ETHUSDT,SOLUSDT"
  }
}
```

If you need to change these, update the file and redeploy:
```bash
wrangler deploy
```

## Phase 3: Initial Testing

### 3.1 Health Check Test

Test the status endpoint:

```bash
curl "https://your-worker-name.your-subdomain.workers.dev/status"
```

**Expected Response**:
```json
{
  "status": "healthy",
  "bybit": true,
  "timestamp": "2023-12-07T10:30:00.000Z",
  "testnet": true
}
```

❌ **If you get errors**: Check API keys are set correctly and Bybit testnet is accessible.

### 3.2 Manual Trading Test

Test a buy order with curl:

```bash
curl -X POST "https://your-worker-name.your-subdomain.workers.dev/bybit" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "k9P$Xz83!vW@b12N#rTe",
    "trendComposite": 4,
    "symbol": "BTCUSDT",
    "action": "buy",
    "timestamp": "'$(date +%s)'000",
    "price": "45000"
  }'
```

**Expected Response**:
```json
{
  "ok": true,
  "action": "buy",
  "orderId": "12345",
  "symbol": "BTCUSDT",
  "side": "Buy",
  "quantity": 0.02,
  "price": 45000.00,
  "stopLoss": 44100.00,
  "signalStrength": 4,
  "riskMetrics": {
    "exposure": "9.00",
    "drawdown": "0.00",
    "dailyPnl": "0.00",
    "dailyTrades": 1,
    "openPositions": 1
  }
}
```

### 3.3 Verify Trade on Bybit

1. Login to https://testnet.bybit.com/
2. Go to Trading → Derivatives → BTCUSDT
3. Check "Positions" tab - you should see your long position
4. Check "Orders" tab - you should see the filled market order
5. Check if stop-loss order is placed

### 3.4 Test Sell Signal

```bash
curl -X POST "https://your-worker-name.your-subdomain.workers.dev/bybit" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "k9P$Xz83!vW@b12N#rTe",
    "trendComposite": -4,
    "symbol": "BTCUSDT",
    "action": "sell",
    "timestamp": "'$(date +%s)'000",
    "price": "45000"
  }'
```

### 3.5 Test Close Signal

```bash
curl -X POST "https://your-worker-name.your-subdomain.workers.dev/bybit" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "k9P$Xz83!vW@b12N#rTe",
    "trendComposite": 0,
    "symbol": "BTCUSDT",
    "action": "close",
    "timestamp": "'$(date +%s)'000",
    "price": "45000"
  }'
```

This should close all open positions for BTCUSDT.

## Phase 4: TradingView Integration

### 4.1 Deploy Pine Script

1. Copy the Edgerunner Trend Composite script from `/scripts/Edgerunner_Trend_Composite.pine`
2. Open TradingView Pine Editor
3. Paste the script and click "Save and Apply to Chart"
4. The indicator should appear below your price chart

### 4.2 Create Webhook Alerts

For each alert type, follow these steps:

1. Right-click on the Trend Composite indicator
2. Select "Add Alert"
3. Configure the alert:

**Long Entry Alert**:
- Condition: "Trend Composite" → "Crossing Up" → "3"
- Alert Actions: ✅ Webhook
- Webhook URL: `https://your-worker-name.your-subdomain.workers.dev/bybit`
- Message: 
  ```json
  {
    "token": "k9P$Xz83!vW@b12N#rTe",
    "trendComposite": {{plot("Trend Composite")}},
    "symbol": "BTCUSDT",
    "action": "buy",
    "timestamp": "{{time}}",
    "price": "{{close}}"
  }
  ```

**Short Entry Alert**:
- Condition: "Trend Composite" → "Crossing Down" → "-3"
- Webhook URL: Same as above
- Message:
  ```json
  {
    "token": "k9P$Xz83!vW@b12N#rTe",
    "trendComposite": {{plot("Trend Composite")}},
    "symbol": "BTCUSDT",
    "action": "sell",
    "timestamp": "{{time}}",
    "price": "{{close}}"
  }
  ```

**Close Positions Alert**:
- Condition: "Trend Composite" → "Crossing" → "0"
- Webhook URL: Same as above
- Message:
  ```json
  {
    "token": "k9P$Xz83!vW@b12N#rTe",
    "trendComposite": {{plot("Trend Composite")}},
    "symbol": "BTCUSDT",
    "action": "close",
    "timestamp": "{{time}}",
    "price": "{{close}}"
  }
  ```

### 4.3 Test TradingView Alerts

1. Use the "Test Alert" button in TradingView to send a test webhook
2. Check Cloudflare Worker logs for incoming requests
3. Verify trades execute on Bybit testnet

## Phase 5: Monitoring & Validation

### 5.1 Monitor Worker Logs

1. Go to Cloudflare Dashboard → Workers & Pages
2. Click on your worker name
3. Go to "Logs" tab
4. Watch real-time logs for webhook requests and trade execution

### 5.2 Key Metrics to Monitor

- **Alert Reception**: Webhooks being received from TradingView
- **Trade Execution**: Orders successfully placed on Bybit
- **Risk Management**: Position sizes and risk limits working correctly
- **Error Handling**: How system handles invalid signals or API errors

### 5.3 Success Criteria Checklist

Before going live, verify:

- ✅ Health check endpoint returns healthy status
- ✅ Manual API tests execute trades correctly
- ✅ TradingView alerts trigger webhook successfully  
- ✅ Position sizing respects risk limits (2% per trade)
- ✅ Stop losses are placed automatically
- ✅ Close signals properly close all positions
- ✅ Error handling works for invalid signals
- ✅ Risk limits prevent excessive trading
- ✅ All logs show expected behavior

## Troubleshooting Common Issues

### Worker Deployment Issues
```bash
# If deployment fails, check:
wrangler whoami  # Verify login
wrangler deploy --compatibility-date=2023-12-01  # Force compatibility date
```

### API Connection Issues
- Verify API keys are correct and have trading permissions
- Check if testnet mode matches your API keys (testnet keys won't work on mainnet)
- Ensure Bybit testnet is funded with test USDT

### Webhook Issues
- Verify webhook URL is correct (copy from deployment output)
- Check webhook token matches in both Pine Script and worker config
- Use curl tests to isolate if issue is TradingView or worker

### Trade Execution Issues
- Check Bybit testnet balance is sufficient
- Verify symbol format (BTCUSDT, not BTC/USDT)
- Check minimum order sizes on Bybit

## Next Steps

Once testing is successful:

1. **Monitor for 24-48 hours** on testnet to ensure stability
2. **Review all trades** to verify strategy is working as expected  
3. **Set up production** with real API keys when ready
4. **Start with small position sizes** for initial live trading

## Emergency Procedures

If something goes wrong:

1. **Stop alerts** in TradingView immediately
2. **Manually close positions** in Bybit if needed
3. **Check worker logs** for error details
4. **Test with curl** to isolate issues
5. **Redeploy worker** if configuration changes needed

Remember: Always test thoroughly on testnet before risking real money!