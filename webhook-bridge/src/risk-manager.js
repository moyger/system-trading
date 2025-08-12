// src/risk-manager.js

export class RiskManager {
  constructor(config = {}) {
    // Default risk parameters
    this.config = {
      maxRiskPerTrade: config.maxRiskPerTrade || 2, // 2% per trade
      maxDailyLoss: config.maxDailyLoss || 10, // 10% max daily loss
      maxPositionsPerSymbol: config.maxPositionsPerSymbol || 1,
      maxTotalPositions: config.maxTotalPositions || 5,
      minAccountBalance: config.minAccountBalance || 100, // Minimum USDT balance
      allowedSymbols: config.allowedSymbols || ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
      tradingHours: config.tradingHours || { start: 0, end: 24 }, // 24/7 by default
      ...config
    };
    
    // Track daily stats (would need persistent storage in production)
    this.dailyStats = {
      tradesCount: 0,
      pnl: 0,
      lastResetDate: new Date().toDateString()
    };
  }

  // Reset daily stats if new day
  resetDailyStatsIfNeeded() {
    const today = new Date().toDateString();
    if (this.dailyStats.lastResetDate !== today) {
      this.dailyStats = {
        tradesCount: 0,
        pnl: 0,
        lastResetDate: today
      };
    }
  }

  // Validate if symbol is allowed for trading
  isSymbolAllowed(symbol) {
    return this.config.allowedSymbols.includes(symbol.toUpperCase());
  }

  // Check if within trading hours
  isWithinTradingHours() {
    const hour = new Date().getUTCHours();
    return hour >= this.config.tradingHours.start && hour < this.config.tradingHours.end;
  }

  // Calculate position size based on risk parameters
  calculatePositionSize(balance, entryPrice, stopLossPrice, signalStrength = 1) {
    const riskAmount = balance * (this.config.maxRiskPerTrade / 100);
    const riskPerUnit = Math.abs(entryPrice - stopLossPrice);
    
    if (riskPerUnit === 0) {
      throw new Error('Invalid stop loss price - no risk per unit');
    }
    
    let baseSize = riskAmount / riskPerUnit;
    
    // Adjust size based on signal strength (1-5 scale)
    const strengthMultiplier = Math.min(signalStrength / 3, 1.5); // Max 1.5x for strong signals
    baseSize *= strengthMultiplier;
    
    // Round to appropriate decimal places
    return Math.round(baseSize * 100) / 100;
  }

  // Validate trade before execution
  async validateTrade(tradeData, currentBalance, currentPositions = []) {
    this.resetDailyStatsIfNeeded();
    
    const errors = [];
    const warnings = [];
    
    // Check minimum balance
    if (currentBalance < this.config.minAccountBalance) {
      errors.push(`Insufficient balance: ${currentBalance} < ${this.config.minAccountBalance}`);
    }
    
    // Check if symbol is allowed
    if (!this.isSymbolAllowed(tradeData.symbol)) {
      errors.push(`Symbol ${tradeData.symbol} not in allowed list`);
    }
    
    // Check trading hours
    if (!this.isWithinTradingHours()) {
      errors.push('Outside trading hours');
    }
    
    // Check daily loss limit
    const dailyLossPercent = (this.dailyStats.pnl / currentBalance) * 100;
    if (dailyLossPercent <= -this.config.maxDailyLoss) {
      errors.push(`Daily loss limit reached: ${dailyLossPercent.toFixed(2)}%`);
    }
    
    // Check maximum positions per symbol
    const symbolPositions = currentPositions.filter(p => 
      p.symbol === tradeData.symbol && parseFloat(p.size) !== 0
    );
    
    if (symbolPositions.length >= this.config.maxPositionsPerSymbol) {
      errors.push(`Max positions reached for ${tradeData.symbol}: ${symbolPositions.length}`);
    }
    
    // Check total open positions
    const totalPositions = currentPositions.filter(p => parseFloat(p.size) !== 0);
    if (totalPositions.length >= this.config.maxTotalPositions) {
      errors.push(`Max total positions reached: ${totalPositions.length}`);
    }
    
    // Calculate position size and validate
    if (tradeData.entryPrice && tradeData.stopLossPrice) {
      try {
        const positionSize = this.calculatePositionSize(
          currentBalance,
          tradeData.entryPrice,
          tradeData.stopLossPrice,
          tradeData.signalStrength || 1
        );
        
        if (positionSize < 0.01) {
          warnings.push(`Position size very small: ${positionSize}`);
        }
        
        // Check if position value is too large (> 50% of balance)
        const positionValue = positionSize * tradeData.entryPrice;
        const positionPercent = (positionValue / currentBalance) * 100;
        
        if (positionPercent > 50) {
          errors.push(`Position too large: ${positionPercent.toFixed(2)}% of balance`);
        }
        
        tradeData.calculatedSize = positionSize;
        
      } catch (error) {
        errors.push(`Position size calculation failed: ${error.message}`);
      }
    }
    
    // Validate signal strength
    if (tradeData.signalStrength && (tradeData.signalStrength < 1 || tradeData.signalStrength > 5)) {
      warnings.push(`Invalid signal strength: ${tradeData.signalStrength}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      adjustedTrade: tradeData
    };
  }

  // Process signal from TradingView
  processSignal(signal) {
    // Determine trade direction and strength
    const trendComposite = signal.trendComposite || 0;
    let action = 'hold';
    let signalStrength = Math.abs(trendComposite);
    
    if (trendComposite > 3) {
      action = 'buy';
    } else if (trendComposite < -3) {
      action = 'sell';
    } else if (trendComposite === 0) {
      action = 'close'; // Neutral signal, close positions
    }
    
    return {
      action,
      signalStrength,
      symbol: signal.symbol || 'BTCUSDT',
      timestamp: signal.timestamp || Date.now(),
      originalSignal: signal
    };
  }

  // Get risk-adjusted stop loss level
  calculateStopLoss(entryPrice, side, atrValue, atrMultiplier = 2) {
    const atrDistance = atrValue * atrMultiplier;
    
    if (side === 'Buy') {
      return entryPrice - atrDistance;
    } else {
      return entryPrice + atrDistance;
    }
  }

  // Emergency stop - close all positions if conditions met
  shouldTriggerEmergencyStop(currentBalance, initialBalance) {
    const totalLoss = ((initialBalance - currentBalance) / initialBalance) * 100;
    return totalLoss >= this.config.maxDailyLoss;
  }

  // Update daily stats (would persist to storage in production)
  updateDailyStats(pnl, tradesCount = 1) {
    this.dailyStats.pnl += pnl;
    this.dailyStats.tradesCount += tradesCount;
  }

  // Get current risk metrics
  getRiskMetrics(currentBalance, initialBalance, currentPositions = []) {
    const totalPositionValue = currentPositions.reduce((total, pos) => {
      return total + (parseFloat(pos.size) * parseFloat(pos.markPrice || pos.avgPrice || 0));
    }, 0);
    
    const exposure = (totalPositionValue / currentBalance) * 100;
    const drawdown = ((initialBalance - currentBalance) / initialBalance) * 100;
    
    return {
      exposure: exposure.toFixed(2),
      drawdown: drawdown.toFixed(2),
      dailyPnl: this.dailyStats.pnl.toFixed(2),
      dailyTrades: this.dailyStats.tradesCount,
      openPositions: currentPositions.filter(p => parseFloat(p.size) !== 0).length
    };
  }
}

// Helper function to create default risk configuration
export function createDefaultRiskConfig(overrides = {}) {
  return {
    maxRiskPerTrade: 2,
    maxDailyLoss: 10,
    maxPositionsPerSymbol: 1,
    maxTotalPositions: 3,
    minAccountBalance: 100,
    allowedSymbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ADAUSDT', 'DOTUSDT'],
    tradingHours: { start: 0, end: 24 },
    ...overrides
  };
}