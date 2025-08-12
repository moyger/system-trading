# TradingView Alert Setup Guide

This guide shows you how to configure TradingView alerts to trigger your automated Bybit trading system.

## Prerequisites

- ✅ Cloudflare Worker deployed and tested
- ✅ Worker URL from deployment (e.g., `https://your-worker.workers.dev`)
- ✅ TradingView account (Pro plan required for webhook alerts)
- ✅ Edgerunner Trend Composite indicator loaded on chart

## Step 1: Add Indicator to Chart

1. Open TradingView and navigate to your desired chart (e.g., BTCUSDT)
2. Click the "Indicators" button (f📊) or press "/"
3. Search for your Edgerunner Trend Composite indicator
4. Click to add it to your chart
5. The indicator should appear in a separate pane below the price chart

## Step 2: Configure Alert Settings

### Alert #1: Long Entry (Strong Bullish Signal)

1. **Create Alert**:
   - Right-click on the Trend Composite indicator line
   - Select "Add alert on Edgerunner Trend Composite"
   - Or use the alarm clock icon and select the indicator

2. **Configure Condition**:
   - Condition: `Edgerunner Trend Composite` 
   - Operator: `Crossing Up`
   - Value: `3`
   - This triggers when trend composite crosses above +3

3. **Set Alert Actions**:
   - ✅ Check "Webhook URL"
   - Webhook URL: `https://your-worker-name.your-subdomain.workers.dev/bybit`

4. **Alert Message**:
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

5. **Settings**:
   - Alert name: `Bybit Long Entry - BTCUSDT`
   - Frequency: `Once Per Bar Close` (recommended) or `Once Per Bar` for faster signals
   - Expiration: Set to desired duration or "Never"

6. **Click "Create"**

### Alert #2: Short Entry (Strong Bearish Signal)

1. **Create Alert**: Same process as above

2. **Configure Condition**:
   - Condition: `Edgerunner Trend Composite`
   - Operator: `Crossing Down`
   - Value: `-3`

3. **Webhook URL**: Same as above

4. **Alert Message**:
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

5. **Settings**:
   - Alert name: `Bybit Short Entry - BTCUSDT`
   - Frequency: `Once Per Bar Close`

### Alert #3: Close Positions (Neutral Signal)

1. **Create Alert**: Same process as above

2. **Configure Condition**:
   - Condition: `Edgerunner Trend Composite`
   - Operator: `Crossing`
   - Value: `0`

3. **Alert Message**:
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

4. **Settings**:
   - Alert name: `Bybit Close Positions - BTCUSDT`
   - Frequency: `Once Per Bar Close`

## Step 3: Multi-Symbol Setup

To trade multiple symbols, create separate alerts for each:

### For ETHUSDT:
- Follow same steps but change `"symbol": "ETHUSDT"` in all messages
- Create separate alerts named `Bybit Long Entry - ETHUSDT`, etc.

### For SOLUSDT:
- Change to `"symbol": "SOLUSDT"`
- Create alerts named `Bybit Long Entry - SOLUSDT`, etc.

## Step 4: Alert Testing

### Test Individual Alerts

1. **Use Test Button**:
   - Go to your alerts list (alarm clock icon)
   - Find your alert
   - Click the three dots (...) menu
   - Select "Test alert"
   - This sends a webhook with current values

2. **Manual Trigger Test**:
   - Temporarily change alert condition to something that will trigger immediately
   - Example: Change "Crossing Up 3" to "Greater than 0" 
   - Let it trigger, then change back to original condition

### Verify Webhook Reception

1. **Check Cloudflare Logs**:
   - Go to Cloudflare Dashboard → Workers & Pages
   - Click your worker → Logs tab
   - Look for incoming webhook requests

2. **Check Bybit Testnet**:
   - Login to testnet.bybit.com
   - Check if orders were placed
   - Verify position opened/closed

## Step 5: Alert Management

### Best Practices

1. **Naming Convention**:
   - Use clear names: `Bybit Long Entry - BTCUSDT`
   - Include symbol and action for easy identification

2. **Organization**:
   - Group alerts by symbol or strategy
   - Use consistent naming across all pairs

3. **Frequency Settings**:
   - `Once Per Bar Close`: Safer, waits for bar to close
   - `Once Per Bar`: Faster, triggers on touch (may cause false signals)
   - Recommended: `Once Per Bar Close` for trend following

### Alert Monitoring

1. **Alert History**:
   - TradingView → Alerts → History tab
   - Shows when alerts fired and status

2. **Webhook Status**:
   - Green checkmark: Webhook sent successfully
   - Red X: Webhook failed (check worker logs)

## Common Alert Issues & Solutions

### Issue 1: Webhook Not Triggering

**Check:**
- Worker URL is correct and accessible
- Webhook token matches in both places
- TradingView Pro subscription active
- Internet connectivity

**Test:**
```bash
curl -X POST "https://your-worker.workers.dev/bybit" \
  -H "Content-Type: application/json" \
  -d '{"token":"k9P$Xz83!vW@b12N#rTe","test":true}'
```

### Issue 2: Alert Triggers But No Trade

**Check Cloudflare Logs for:**
- Webhook received but validation failed
- API connection issues
- Risk management blocking trades
- Symbol not in allowed list

### Issue 3: Too Many/Few Alerts

**Adjust:**
- Alert frequency (Once Per Bar Close vs Once Per Bar)
- Indicator timeframe (higher TF = fewer signals)
- Trend composite thresholds (higher = stronger signals only)

### Issue 4: Wrong Symbol Trading

**Verify:**
- Symbol spelling in alert message
- Symbol is supported by Bybit
- Symbol is in ALLOWED_SYMBOLS list

## Advanced Alert Features

### Multiple Timeframe Alerts

Create alerts on different timeframes:
- 4H chart for swing trades
- 1H chart for day trades  
- 15M chart for scalping

Each needs different webhook URLs or symbol identifiers.

### Conditional Alerts

Use TradingView's alert conditions to combine multiple indicators:
- Trend Composite > 3 AND RSI < 70
- Trend Composite < -3 AND Volume > Average

### Dynamic Position Sizing

Include additional data in webhook for dynamic sizing:
```json
{
  "token": "k9P$Xz83!vW@b12N#rTe",
  "trendComposite": {{plot("Trend Composite")}},
  "symbol": "BTCUSDT",
  "action": "buy",
  "timestamp": "{{time}}",
  "price": "{{close}}",
  "volume": "{{volume}}",
  "atr": "{{plot("ATR")}}"
}
```

## Security Considerations

1. **Keep Token Secret**: Don't share your webhook token
2. **Use HTTPS**: Always use secure webhook URLs
3. **Validate Sources**: Monitor for unexpected webhook traffic
4. **Test Thoroughly**: Always test on paper trading first

## Monitoring Checklist

Daily monitoring should include:
- ✅ Alerts are active (not expired)
- ✅ Webhook success rate in TradingView
- ✅ Worker logs show normal operation
- ✅ Trades executing as expected on Bybit
- ✅ Risk limits being respected
- ✅ No unexpected errors or failures

## Alert Templates

Save these as templates for quick setup:

### Long Entry Template:
```json
{
  "token": "k9P$Xz83!vW@b12N#rTe",
  "trendComposite": {{plot("Trend Composite")}},
  "symbol": "SYMBOL_HERE",
  "action": "buy",
  "timestamp": "{{time}}",
  "price": "{{close}}"
}
```

### Short Entry Template:
```json
{
  "token": "k9P$Xz83!vW@b12N#rTe",
  "trendComposite": {{plot("Trend Composite")}},
  "symbol": "SYMBOL_HERE",
  "action": "sell",
  "timestamp": "{{time}}",
  "price": "{{close}}"
}
```

### Close Template:
```json
{
  "token": "k9P$Xz83!vW@b12N#rTe",
  "trendComposite": {{plot("Trend Composite")}},
  "symbol": "SYMBOL_HERE",
  "action": "close",
  "timestamp": "{{time}}",
  "price": "{{close}}"
}
```

Replace `SYMBOL_HERE` with the actual symbol (BTCUSDT, ETHUSDT, etc.) for each alert.