I would like to replicate Arthur Hill’s indicators but I’d like this to be timeframe-adaptive as well where it can work in lower timeframe. Arthur’s defaults are tuned for **daily** bars (125 ≈ six months). If you drop to 1h/4h/weekly, keep ratios similar: e.g., for 4h bars ~ 125 trading days × 6 bars/day ≈ 750 lookback, or just re‑optimize thresholds to control whipsaws. He often uses the same constructs but adjusts periods and thresholds to the regime. 

- **1. TIP-Trend Composite**A trend indicator that quantifies and aggregates signals in five trend-following indicators (Moving Average Rate-of-Change, CCI Close, Bollinger Bands, Keltner Channels, StochClose)
- **2. TIP-StochClose**Based on the Stochastic Oscillator, a trend-momentum indicator that filters out intraday high-low spikes to improve signal consistency
- **3. TIP-RSI Trend Range**A trend indicator that uses the RSI range over a given timeframe to define uptrends and downtrends
- **4. TIP-Moving Average Trend**A trend indicator that shows when a moving average is rising or falling, and the degree of ascent or descent
- **5. TIP-Momentum Composite**A momentum indicator that quantifies and aggregates overbought/oversold signals in five momentum indicators (RSI, %B, StochClose, CCI Close, Normalized ROC)
- **6. TIP-Percent Above MA**A trend-momentum indicator that measures the percentage distance between two simple moving averages
- **7. TIP-CCI Close**Based on the Commodity Channel Index, a trend momentum indicator that filters out intraday high-low spikes to improve signal consistency
- **8. TIP-Normalized ROC**A momentum indicator that normalizes the absolute rate-of-change using the Average True Range (values can be compared across securities)
- **9. TIP-High Low Range Percent**A volatility indicator that shows when the high-low range narrows or expands
- **10. TIP-Normalized ATR**A volatility indicator that shows the Average True Range as a percentage of price (values can be compared across securities)

Use Firecrawl MCP to scrape any knowledge that we can get from here to code the indicators properly and effectively. 

1. https://stockcharts.com/marketplace/plug-ins/trend-investor-pro.html
2. https://help.stockcharts.com/charts-and-tools/stockchartsacp/stockchartsacp-plug-ins/trend-investor-pro-indicator-edge
3. https://articles.stockcharts.com/article/articles-arthurhill-2023-03-find-the-strongest-price-chart-986/
4. https://trendinvestorpro.com/