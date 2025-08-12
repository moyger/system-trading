# Bybit Integration for Edgerunner Trading System

This integration extends the existing Cloudflare Worker to support automated trading on Bybit exchange based on TradingView alerts from the Edgerunner Trend Composite indicator.

## Architecture

```
TradingView Alert → Cloudflare Worker → Risk Management → Bybit API
```

## Features

- **Automated Trading**: Execute trades based on Trend Composite signals
- **Risk Management**: Position sizing, daily loss limits, exposure controls
- **Multi-Symbol Support**: Trade multiple crypto pairs
- **Stop Loss Management**: Automatic stop-loss placement
- **Health Monitoring**: Status endpoint for system health
- **Testnet Support**: Test with paper trading before live deployment

## Setup Instructions

### 1. Deploy the Worker

```bash
cd webhook-bridge
wrangler deploy
```

### 2. Set API Credentials

```bash
wrangler secret put BYBIT_API_KEY
wrangler secret put BYBIT_API_SECRET
```

### 3. Configure Environment

Update `wrangler.jsonc` with your settings:

```jsonc
{
  "BYBIT_TESTNET": "true",              // Set to "false" for mainnet
  "MAX_RISK_PER_TRADE": "2",           // 2% risk per trade
  "MAX_DAILY_LOSS": "10",              // 10% max daily loss
  "ALLOWED_SYMBOLS": "BTCUSDT,ETHUSDT" // Comma-separated symbols
}
```

### 4. Set Up TradingView Alerts

1. Add Edgerunner Trend Composite indicator to your chart
2. Create alerts using these conditions:
   - **Long Entry**: Trend Composite crosses above 3
   - **Short Entry**: Trend Composite crosses below -3
   - **Close Positions**: Trend Composite crosses 0 (neutral)

3. Use these webhook URLs and messages:

**Webhook URL**: `https://your-worker.your-subdomain.workers.dev/bybit`

**Long Entry Alert Message**:
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

**Short Entry Alert Message**:
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

**Close Positions Alert Message**:
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

## Trading Logic

### Entry Signals
- **Long Entry**: When Trend Composite > 3 (strong bullish signal)
- **Short Entry**: When Trend Composite < -3 (strong bearish signal)
- **Position Close**: When Trend Composite = 0 (neutral signal)

### Risk Management
- **Position Sizing**: 2% of account balance per trade (configurable)
- **Stop Loss**: 2% from entry price (or based on ATR if provided)
- **Daily Loss Limit**: 10% maximum daily loss
- **Maximum Positions**: 1 position per symbol, 5 total positions
- **Allowed Symbols**: Configurable whitelist of trading pairs

### Order Execution
- **Order Type**: Market orders for immediate execution
- **Stop Loss**: Automatic stop-loss placement after order fill
- **Position Management**: Automatic position closing on neutral signals

## API Endpoints

### POST /bybit
Main trading endpoint that processes TradingView webhook alerts.

**Request**:
```json
{
  "token": "your_webhook_secret",
  "trendComposite": 4,
  "symbol": "BTCUSDT",
  "action": "buy",
  "timestamp": "1640995200000",
  "price": "47500.00"
}
```

**Response** (Success):
```json
{
  "ok": true,
  "action": "buy",
  "orderId": "12345",
  "symbol": "BTCUSDT",
  "side": "Buy",
  "quantity": 0.02,
  "price": 47500.00,
  "stopLoss": 46550.00,
  "signalStrength": 4,
  "riskMetrics": {
    "exposure": "15.50",
    "drawdown": "0.00",
    "dailyPnl": "0.00",
    "dailyTrades": 1,
    "openPositions": 1
  },
  "timestamp": "2023-12-07T10:30:00.000Z"
}
```

**Response** (Error):
```json
{
  "ok": false,
  "error": "Trade validation failed",
  "errors": ["Max positions reached for BTCUSDT: 1"],
  "warnings": [],
  "timestamp": "2023-12-07T10:30:00.000Z"
}
```

### GET /status
Health check endpoint.

**Response**:
```json
{
  "status": "healthy",
  "bybit": true,
  "timestamp": "2023-12-07T10:30:00.000Z",
  "testnet": true
}
```

## Configuration Options

### Risk Parameters
- `MAX_RISK_PER_TRADE`: Percentage of balance to risk per trade (default: 2)
- `MAX_DAILY_LOSS`: Maximum daily loss percentage (default: 10)
- `ALLOWED_SYMBOLS`: Comma-separated list of allowed trading symbols

### API Settings
- `BYBIT_API_KEY`: Your Bybit API key (secret)
- `BYBIT_API_SECRET`: Your Bybit API secret (secret)
- `BYBIT_TESTNET`: Use testnet ("true") or mainnet ("false")

### Security
- `WEBHOOK_SECRET`: Token for webhook authentication

## Testing

1. **Health Check**: Visit `https://your-worker.workers.dev/status`
2. **Test Alert**: Send a manual POST request to `/bybit` endpoint
3. **Paper Trading**: Use testnet mode to test without real funds

## Security Notes

- API keys are stored as encrypted secrets in Cloudflare Workers
- Webhook token validation prevents unauthorized trades
- Risk management prevents excessive losses
- Testnet mode allows safe testing

## Monitoring

- Check Cloudflare Worker logs for trade execution details
- Monitor Bybit account for position changes
- Set up additional monitoring via the `/status` endpoint
- Review daily risk metrics in API responses

## Troubleshooting

### Common Issues
1. **Invalid JSON**: Check webhook message format
2. **Bad token**: Verify WEBHOOK_SECRET matches
3. **API errors**: Check API key permissions and testnet setting
4. **Risk validation failed**: Review position limits and balance requirements

### Logs
Check Cloudflare Worker logs in the dashboard for detailed error messages and trade execution information.