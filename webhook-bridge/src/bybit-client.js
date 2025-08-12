// src/bybit-client.js
import crypto from 'crypto';

export class BybitClient {
  constructor(apiKey, apiSecret, testnet = true) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = testnet 
      ? 'https://api-testnet.bybit.com' 
      : 'https://api.bybit.com';
  }

  // Generate authentication signature for Bybit v5 API
  generateSignature(timestamp, params, method = 'GET') {
    let paramString = '';
    
    if (method === 'POST') {
      // For POST requests, params are in the body as JSON string
      paramString = typeof params === 'string' ? params : JSON.stringify(params);
    } else {
      // For GET requests, params are in query string
      paramString = new URLSearchParams(params).toString();
    }
    
    // Bybit v5 signature format: timestamp + apiKey + recv_window + paramString
    const recv_window = '5000';
    const message = timestamp + this.apiKey + recv_window + paramString;
    return crypto.createHmac('sha256', this.apiSecret).update(message).digest('hex');
  }

  // Make authenticated API request
  async apiRequest(endpoint, method = 'GET', params = {}) {
    const timestamp = Date.now().toString();
    const signature = this.generateSignature(timestamp, params, method);
    
    const headers = {
      'X-BAPI-API-KEY': this.apiKey,
      'X-BAPI-SIGN': signature,
      'X-BAPI-SIGN-TYPE': '2',
      'X-BAPI-TIMESTAMP': timestamp,
      'X-BAPI-RECV-WINDOW': '5000',
      'Content-Type': 'application/json'
    };

    let url = `${this.baseUrl}${endpoint}`;
    let requestOptions = {
      method,
      headers
    };

    if (method === 'POST') {
      requestOptions.body = JSON.stringify(params);
    } else if (method === 'GET' && Object.keys(params).length > 0) {
      const queryString = new URLSearchParams(params).toString();
      url += `?${queryString}`;
    }

    try {
      console.log(`Making request to: ${url}`);
      console.log(`Request options:`, JSON.stringify(requestOptions, null, 2));
      
      const response = await fetch(url, requestOptions);
      console.log(`Response status: ${response.status}`);
      
      const responseText = await response.text();
      console.log(`Response text: ${responseText}`);
      
      if (!responseText) {
        throw new Error('Empty response from Bybit API');
      }
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`Invalid JSON response from Bybit: ${responseText}`);
      }
      
      if (data.retCode !== 0) {
        throw new Error(`Bybit API Error: ${data.retMsg} (Code: ${data.retCode})`);
      }
      
      return data.result;
    } catch (error) {
      console.error('Bybit API request failed:', error);
      throw error;
    }
  }

  // Get account balance
  async getBalance() {
    try {
      const result = await this.apiRequest('/v5/account/wallet-balance', 'GET', {
        accountType: 'UNIFIED'
      });
      
      return result.list?.[0]?.coin || [];
    } catch (error) {
      console.error('Failed to get balance:', error);
      throw error;
    }
  }

  // Get current positions
  async getPositions(symbol = '') {
    try {
      const params = {
        category: 'linear',
        settleCoin: 'USDT'
      };
      
      if (symbol) {
        params.symbol = symbol;
      }

      const result = await this.apiRequest('/v5/position/list', 'GET', params);
      return result.list || [];
    } catch (error) {
      console.error('Failed to get positions:', error);
      throw error;
    }
  }

  // Place a market order
  async placeOrder(symbol, side, qty, orderType = 'Market', timeInForce = 'IOC') {
    try {
      // Try one-way mode first (positionIdx: 0)
      let params = {
        category: 'linear',
        symbol: symbol,
        side: side, // 'Buy' or 'Sell'
        orderType: orderType,
        qty: qty.toString(),
        timeInForce: timeInForce,
        positionIdx: 0, // 0 for one-way mode
        reduceOnly: false
      };

      try {
        const result = await this.apiRequest('/v5/order/create', 'POST', params);
        return result;
      } catch (oneWayError) {
        // If one-way mode fails with position idx error, try hedge mode
        if (oneWayError.message.includes('position idx not match')) {
          console.log('One-way mode failed, trying hedge mode...');
          
          // For hedge mode, use positionIdx 1 for buy, 2 for sell
          params.positionIdx = side === 'Buy' ? 1 : 2;
          
          const result = await this.apiRequest('/v5/order/create', 'POST', params);
          return result;
        } else {
          throw oneWayError;
        }
      }
    } catch (error) {
      console.error('Failed to place order:', error);
      throw error;
    }
  }

  // Close position
  async closePosition(symbol, side) {
    try {
      // First get current position size
      const positions = await this.getPositions(symbol);
      const position = positions.find(p => p.symbol === symbol);
      
      if (!position || parseFloat(position.size) === 0) {
        throw new Error(`No open position found for ${symbol}`);
      }

      // Place closing order (opposite side)
      const closingSide = side === 'Buy' ? 'Sell' : 'Buy';
      const result = await this.placeOrder(symbol, closingSide, Math.abs(parseFloat(position.size)), 'Market');
      
      return result;
    } catch (error) {
      console.error('Failed to close position:', error);
      throw error;
    }
  }

  // Get ticker information
  async getTicker(symbol) {
    try {
      const result = await this.apiRequest('/v5/market/tickers', 'GET', {
        category: 'linear',
        symbol: symbol
      });
      
      return result.list?.[0] || null;
    } catch (error) {
      console.error('Failed to get ticker:', error);
      throw error;
    }
  }

  // Cancel all orders for a symbol
  async cancelAllOrders(symbol) {
    try {
      const result = await this.apiRequest('/v5/order/cancel-all', 'POST', {
        category: 'linear',
        symbol: symbol
      });
      
      return result;
    } catch (error) {
      console.error('Failed to cancel orders:', error);
      throw error;
    }
  }

  // Set trading stop (take profit/stop loss)
  async setTradingStop(symbol, side, stopLoss = null, takeProfit = null) {
    try {
      const params = {
        category: 'linear',
        symbol: symbol,
        positionIdx: 0
      };

      if (stopLoss) {
        params.stopLoss = stopLoss.toString();
      }
      
      if (takeProfit) {
        params.takeProfit = takeProfit.toString();
      }

      const result = await this.apiRequest('/v5/position/trading-stop', 'POST', params);
      return result;
    } catch (error) {
      console.error('Failed to set trading stop:', error);
      throw error;
    }
  }

  // Health check
  async ping() {
    try {
      const response = await fetch(`${this.baseUrl}/v5/market/time`);
      const data = await response.json();
      return data.retCode === 0;
    } catch (error) {
      console.error('Bybit ping failed:', error);
      return false;
    }
  }
}

// Utility functions
export function calculateOrderSize(balance, riskPercent, entryPrice, stopLossPrice) {
  const riskAmount = balance * (riskPercent / 100);
  const riskPerUnit = Math.abs(entryPrice - stopLossPrice);
  
  if (riskPerUnit === 0) {
    throw new Error('Invalid stop loss price');
  }
  
  return Math.floor(riskAmount / riskPerUnit * 100) / 100; // Round to 2 decimal places
}

export function formatSymbol(symbol) {
  // Ensure symbol is in Bybit format (e.g., BTCUSDT)
  return symbol.replace(/[^A-Z]/g, '').toUpperCase();
}