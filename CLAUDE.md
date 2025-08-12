# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a Pine Script trading system repository implementing Arthur Hill's TIP (Trend Investor Pro) indicators with timeframe adaptation capabilities. All indicators are designed to work across different timeframes (1H, 4H, Daily, Weekly) by adjusting the lookback periods proportionally.

## Pine Script Development

### Testing Indicators
Indicators should be tested in TradingView's Pine Editor:
1. Copy the Pine Script code from `/scripts/*.pine`
2. Paste into TradingView Pine Editor
3. Add to chart to verify compilation and functionality
4. Test timeframe adaptation with multiplier settings (0.2 for 1H, 1.0 for Daily, 5 for Weekly)

### Common Pine Script Issues to Watch For
- `plot()` and `alertcondition()` must be at global scope, not inside conditional blocks
- Multi-line ternary operators need to be on single lines in Pine Script v6
- Boolean variables cannot be initialized with `na` - use `false` instead
- When checking if a boolean is uninitialized, use a separate tracking variable rather than `na(boolVar)`

## Indicator Architecture

### Core Indicators Structure
The system implements 11 indicators divided into three categories:

1. **Trend Following** - Designed to capture 3-6 month trends with default 125-period lookback
   - Trend Composite: Aggregates 5 trend signals (-5 to +5 scoring)
   - StochClose: Stochastic based on closing prices only
   - RSI Trend Range: RSI with smoothing for trend detection
   - Moving Average Trend: Rate of change of moving averages

2. **Mean Reversion** - Shorter timeframe oscillators for overbought/oversold conditions
   - Momentum Composite: Aggregates 5 momentum indicators
   - CCI Close: CCI using closing prices only
   - Percent Above MA: Distance between price and moving average

3. **Volatility** - Risk and volatility measurement
   - ATR Trailing Stop: Dynamic stop-loss with SAR mode
   - Normalized ATR: ATR as percentage for cross-security comparison
   - Normalized ROC: Rate of change normalized by ATR
   - High Low Range Percent: Intraday range as percentage

### Timeframe Adaptation Pattern
All indicators (except ATR Trailing Stop) use this pattern:
```pine
timeframeMultiplier = input.float(1.0, "Timeframe Multiplier", ...)
basePeriod = 125  // Optimized for daily
adjustedPeriod = math.round(basePeriod * timeframeMultiplier)
```

### External Indicator Integration
The ATR Trailing Stop can accept external trend signals:
- Trend Composite can feed its signal to ATR Trailing Stop
- External indicator values > 0 trigger long stops, < 0 trigger short stops

## Reference Documentation

Original indicator specifications from Arthur Hill are documented at:
- https://help.stockcharts.com/charts-and-tools/stockchartsacp/stockchartsacp-plug-ins/trend-investor-pro-indicator-edge

Key implementation details:
- Default periods are optimized for daily charts (125 ≈ 6 months)
- Indicators using closing prices only (StochClose, CCI Close) are more stable than those using high/low
- Thresholds can be adjusted per security volatility characteristics