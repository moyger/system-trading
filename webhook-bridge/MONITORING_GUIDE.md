# Monitoring & Troubleshooting Guide

This guide covers how to monitor your automated trading system and troubleshoot common issues.

## Daily Monitoring Checklist

### 🔍 System Health (5 minutes daily)

1. **Worker Status Check**:
   ```bash
   curl "https://your-worker.workers.dev/status"
   ```
   - ✅ Should return `"status": "healthy"`
   - ✅ Should show `"bybit": true`
   - ✅ Verify `"testnet": true` (until you go live)

2. **TradingView Alerts Status**:
   - Login to TradingView → Alerts
   - Check all alerts are "Active" (not expired)
   - Look for any alerts with red error indicators

3. **Bybit Account Status**:
   - Login to testnet.bybit.com (or live)
   - Check account balance vs expected
   - Review recent trades and positions
   - Verify no unexpected large losses

### 📊 Performance Review (10 minutes daily)

1. **Cloudflare Worker Logs**:
   - Go to Cloudflare Dashboard → Workers & Pages → Your Worker → Logs
   - Look for error messages (red entries)
   - Check webhook reception frequency
   - Verify trade execution confirmations

2. **Trade Performance**:
   - Count number of trades vs expected signals
   - Check win/loss ratio
   - Verify position sizes are within risk limits
   - Review stop-loss executions

3. **Risk Management**:
   - Daily P&L vs limits (should be < 10% loss)
   - Number of open positions (should be ≤ max limits)
   - Account balance trend over time

## Key Metrics to Track

### 📈 Trading Metrics

| Metric | Target | How to Check |
|--------|--------|--------------|
| **Signal Reception** | 100% | TradingView alert history |
| **Trade Execution** | >95% | Bybit vs TradingView alerts |
| **Position Sizing** | Within 2% risk | Trade logs + balance |
| **Stop Loss Placement** | 100% | Bybit orders tab |
| **Daily Loss Limit** | <10% | Account balance tracking |
| **Max Positions** | ≤5 total, ≤1 per symbol | Bybit positions |

### 🚨 Alert Thresholds

Set up monitoring for these conditions:

- **High Error Rate**: >5% of webhooks failing
- **No Signals**: No alerts for >24 hours (may indicate issue)
- **Unexpected Trades**: Trades without corresponding alerts
- **Large Losses**: Single trade loss >5% of account
- **API Failures**: Bybit connectivity issues
- **Balance Anomalies**: Unexpected balance changes

## Monitoring Dashboards

### Option 1: Simple Spreadsheet Tracking

Create a Google Sheet with daily entries:

| Date | Alerts Sent | Trades Executed | P&L | Balance | Open Positions | Issues |
|------|-------------|----------------|-----|---------|----------------|--------|
| 2023-12-07 | 3 | 3 | +$150 | $10,150 | 2 | None |
| 2023-12-08 | 1 | 1 | -$75 | $10,075 | 1 | Stop loss hit |

### Option 2: Automated Logging

Add logging to your worker for key metrics:

```javascript
// Add to your worker response
console.log(`TRADE_LOG: ${JSON.stringify({
  timestamp: new Date().toISOString(),
  action: signal.action,
  symbol: symbol,
  quantity: quantity,
  price: currentPrice,
  balance: currentBalance,
  pnl: dailyPnL
})}`);
```

### Option 3: External Monitoring

Set up external monitoring with:
- **UptimeRobot**: Monitor worker health endpoint
- **Discord/Telegram Bot**: Send daily trade summaries
- **Email Alerts**: For critical errors or large losses

## Common Issues & Troubleshooting

### 🚫 Issue 1: No Trades Executing

**Symptoms:**
- TradingView alerts firing
- No corresponding trades on Bybit
- Worker logs show webhook received

**Diagnosis Steps:**
1. Check worker logs for error messages
2. Verify API keys are correct and active
3. Test manual webhook with curl
4. Check risk management blocking trades

**Common Causes:**
```javascript
// Risk management blocking
"error": "Trade validation failed"
"errors": ["Max positions reached for BTCUSDT: 1"]

// API authentication
"error": "Bybit API Error: Invalid API key"

// Insufficient balance
"error": "Unable to get balance or price information"
```

**Solutions:**
- Check and reset API keys if expired
- Verify account has sufficient testnet funds
- Adjust risk parameters if too restrictive
- Check symbol spelling and availability

### 🚫 Issue 2: Partial Trade Execution

**Symptoms:**
- Some alerts execute trades, others don't
- Inconsistent behavior

**Diagnosis:**
```bash
# Test specific symbols
curl -X POST "https://your-worker.workers.dev/bybit" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "your-token",
    "trendComposite": 4,
    "symbol": "PROBLEM_SYMBOL",
    "action": "buy",
    "timestamp": "'$(date +%s)'000",
    "price": "100"
  }'
```

**Common Causes:**
- Symbol not in ALLOWED_SYMBOLS list
- Minimum order size requirements
- Market hours restrictions
- Individual symbol risk limits hit

### 🚫 Issue 3: High Error Rate

**Symptoms:**
- Many webhook failures in TradingView
- Red error indicators on alerts
- High 4xx/5xx responses in worker logs

**Diagnosis:**
1. Check worker error logs for patterns
2. Test with simplified payloads
3. Verify network connectivity
4. Check Cloudflare service status

**Common Causes:**
```javascript
// Invalid JSON format
"error": "Invalid JSON"

// Authentication failures  
"error": "Bad token"

// Rate limiting
"error": "Too Many Requests"
```

### 🚫 Issue 4: Unexpected Trades

**Symptoms:**
- Trades appearing without corresponding alerts
- Wrong trade sizes or directions
- Trades on wrong symbols

**Diagnosis:**
1. Check all active TradingView alerts
2. Review webhook authentication tokens
3. Check for duplicate alerts or bots
4. Verify alert message formats

**Immediate Action:**
```bash
# Stop all trading immediately
curl -X POST "https://your-worker.workers.dev/bybit" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "your-token",
    "action": "close",
    "symbol": "BTCUSDT"
  }'
```

### 🚫 Issue 5: Risk Management Not Working

**Symptoms:**
- Position sizes larger than expected
- Too many positions open
- Daily losses exceeding limits

**Check Current Limits:**
```bash
# Test risk validation
curl -X POST "https://your-worker.workers.dev/bybit" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "your-token",
    "trendComposite": 4,
    "symbol": "BTCUSDT",
    "action": "buy",
    "price": "45000"
  }'
```

Look for validation errors in response.

**Update Risk Settings:**
Edit `wrangler.jsonc` and redeploy:
```jsonc
{
  "vars": {
    "MAX_RISK_PER_TRADE": "1",    // Reduce to 1%
    "MAX_DAILY_LOSS": "5",        // Reduce to 5%
    "ALLOWED_SYMBOLS": "BTCUSDT"  // Limit to one symbol
  }
}
```

## Emergency Procedures

### 🚨 Emergency Stop (All Trading)

1. **Disable All TradingView Alerts**:
   - Go to TradingView → Alerts
   - Select all alerts → Actions → Disable

2. **Close All Positions**:
   ```bash
   # For each symbol you're trading
   curl -X POST "https://your-worker.workers.dev/bybit" \
     -H "Content-Type: application/json" \
     -d '{
       "token": "your-token",
       "action": "close",
       "symbol": "BTCUSDT"
     }'
   ```

3. **Manually Close in Bybit** (if webhook fails):
   - Login to Bybit
   - Go to Positions tab
   - Close all positions manually

### 🚨 System Reset

If major issues occur:

1. **Redeploy Worker**:
   ```bash
   cd webhook-bridge
   wrangler deploy
   ```

2. **Reset API Keys**:
   ```bash
   wrangler secret put BYBIT_API_KEY
   wrangler secret put BYBIT_API_SECRET
   ```

3. **Test All Functions**:
   ```bash
   ./test-webhook.sh https://your-worker.workers.dev
   ```

## Performance Optimization

### Reduce Latency

1. **Cloudflare Edge Locations**: Already optimized
2. **Alert Frequency**: Use "Once Per Bar" for faster signals
3. **Market Orders**: Already implemented for immediate execution

### Improve Reliability

1. **Redundant Alerts**: Set up alerts on multiple timeframes
2. **Error Handling**: Already built into worker
3. **Backup Monitoring**: Set up external health checks

### Scale Trading

1. **More Symbols**: Add to ALLOWED_SYMBOLS list
2. **Higher Position Sizes**: Increase MAX_RISK_PER_TRADE carefully
3. **Multiple Strategies**: Deploy additional workers for different strategies

## Log Analysis

### Successful Trade Log Entry
```
Processing signal: {"action":"buy","signalStrength":4,"symbol":"BTCUSDT"}
Order placed: {"orderId":"12345","side":"Buy","quantity":0.02}
Stop loss set: {"stopLoss":44100}
```

### Failed Trade Log Entry
```
Trade validation failed: ["Max positions reached for BTCUSDT: 1"]
Risk check blocked trade: signalStrength=4, currentBalance=1000
```

### API Error Log Entry
```
Bybit API Error: Invalid signature (Code: 10003)
Failed to place order: {"symbol":"BTCUSDT","side":"Buy","quantity":0.02}
```

## Weekly Review Process

### 📅 Weekly Tasks (30 minutes)

1. **Performance Analysis**:
   - Calculate weekly P&L and win rate
   - Compare against buy-and-hold benchmark
   - Analyze largest winning and losing trades

2. **System Health Review**:
   - Review error logs for patterns
   - Check alert firing frequency vs market activity
   - Verify risk management effectiveness

3. **Strategy Adjustments**:
   - Consider adjusting trend composite thresholds
   - Evaluate position sizing effectiveness
   - Review stop-loss performance

### 📊 Key Weekly Metrics

- Total trades executed
- Win/loss ratio  
- Average trade size vs risk limit
- Maximum drawdown vs limit
- Alert-to-trade conversion rate
- System uptime percentage

### 🔧 Maintenance Tasks

- Update API keys if needed (rotate quarterly)
- Review and update allowed symbols list
- Check for TradingView indicator updates
- Backup trade logs and performance data
- Test emergency procedures

## Going Live Checklist

Before switching from testnet to live trading:

- ✅ System stable for 7+ days on testnet
- ✅ All emergency procedures tested
- ✅ Risk management working correctly
- ✅ Win rate and P&L acceptable
- ✅ Monitoring systems in place
- ✅ Live API keys obtained and tested
- ✅ Starting with reduced position sizes
- ✅ Manual override procedures ready

Remember: Start small and scale up gradually!