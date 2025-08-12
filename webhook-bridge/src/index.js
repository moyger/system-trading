// src/index.js
import { BybitClient } from './bybit-client.js';
import { RiskManager, createDefaultRiskConfig } from './risk-manager.js';

export default {
	async fetch(request, env) {
	  const url = new URL(request.url);
	  const json = (obj, code=200, extra={}) =>
		new Response(JSON.stringify(obj), {
		  status: code,
		  headers: { "content-type": "application/json", ...extra }
		});
  
	  // CORS / preflight (lets you test from anywhere)
	  if (request.method === "OPTIONS") {
		return new Response(null, {
		  headers: {
			"access-control-allow-origin": "*",
			"access-control-allow-methods": "GET,POST,OPTIONS",
			"access-control-allow-headers": "content-type"
		  }
		});
	  }
  
	  // --- POST /enqueue (TradingView sends here)
	  if (url.pathname === "/enqueue" && request.method === "POST") {
		let body;
		try { body = await request.json(); } catch (_) {
		  return json({ ok:false, error:"Invalid JSON" }, 400);
		}
  
		// Simple shared-secret check (TradingView can't set headers, so put token in body)
		if (env.WEBHOOK_SECRET && body.token !== env.WEBHOOK_SECRET) {
		  return json({ ok:false, error:"Bad token" }, 403);
		}
  
		const account = (body.account || "FTMO").toUpperCase();
		const key = `q:${account}`;
  
		// Add unique signal ID to prevent duplicates
		const signalId = Date.now() + "-" + Math.random().toString(36).substr(2, 9);
		
		const current = await env.QUEUE.get(key);
		const queue = current ? JSON.parse(current) : [];
		queue.push({ ...body, signalId, receivedAt: Date.now() });
  
		await env.QUEUE.put(key, JSON.stringify(queue));
		return json({ ok:true, size: queue.length, signalId }, 200, { "access-control-allow-origin": "*" });
	  }
  
	  // --- GET /dequeue?account=FTMO (MT5 EA polls this)
	  if (url.pathname === "/dequeue" && request.method === "GET") {
		const account = (url.searchParams.get("account") || "FTMO").toUpperCase();
		const key = `q:${account}`;
  
		try {
		  const current = await env.QUEUE.get(key);
		  const queue = current ? JSON.parse(current) : [];
		  const next = queue.shift() || null;
  
		  // Only update KV if we actually dequeued something (saves KV writes)
		  if (next) {
			await env.QUEUE.put(key, JSON.stringify(queue));
		  }
		  
		  return json(next, 200, { "access-control-allow-origin": "*" });
		} catch (error) {
		  // If KV fails (limit exceeded), return null gracefully
		  console.log("KV error:", error.message);
		  return json(null, 200, { "access-control-allow-origin": "*" });
		}
	  }

	  // --- POST /bybit (TradingView sends here for Bybit trading)
	  if (url.pathname === "/bybit" && request.method === "POST") {
		let body;
		try { 
		  body = await request.json(); 
		} catch (_) {
		  return json({ ok:false, error:"Invalid JSON" }, 400);
		}

		// Validate webhook secret (temporarily disabled for testing)
		// if (env.WEBHOOK_SECRET && body.token !== env.WEBHOOK_SECRET) {
		//   return json({ ok:false, error:"Bad token" }, 403);
		// }

		try {
		  // Initialize Bybit client
		  const bybitClient = new BybitClient(
			env.BYBIT_API_KEY,
			env.BYBIT_API_SECRET,
			env.BYBIT_TESTNET === 'true'
		  );

		  // Initialize risk manager
		  const riskConfig = createDefaultRiskConfig({
			maxRiskPerTrade: parseFloat(env.MAX_RISK_PER_TRADE) || 2,
			maxDailyLoss: parseFloat(env.MAX_DAILY_LOSS) || 10,
			allowedSymbols: (env.ALLOWED_SYMBOLS || 'BTCUSDT,ETHUSDT,SOLUSDT').split(',')
		  });
		  const riskManager = new RiskManager(riskConfig);

		  // Process the signal
		  const signal = riskManager.processSignal(body);
		  const symbol = body.symbol || 'BTCUSDT';

		  console.log('Processing signal:', JSON.stringify(signal));

		  // Get current account state
		  const [balanceInfo, positions, ticker] = await Promise.all([
			bybitClient.getBalance(),
			bybitClient.getPositions(symbol),
			bybitClient.getTicker(symbol)
		  ]);

		  const usdtBalance = balanceInfo.find(b => b.coin === 'USDT');
		  const currentBalance = parseFloat(usdtBalance?.walletBalance || 0);
		  const currentPrice = parseFloat(ticker?.lastPrice || 0);

		  if (currentBalance === 0 || currentPrice === 0) {
			throw new Error('Unable to get balance or price information');
		  }

		  // Handle different actions
		  let result = {};

		  if (signal.action === 'close') {
			// Close all positions for this symbol
			const openPositions = positions.filter(p => parseFloat(p.size) !== 0);
			
			for (const position of openPositions) {
			  const side = parseFloat(position.size) > 0 ? 'Sell' : 'Buy';
			  const closeResult = await bybitClient.placeOrder(
				symbol, 
				side, 
				Math.abs(parseFloat(position.size))
			  );
			  console.log('Position closed:', closeResult);
			}

			result = { 
			  action: 'close_all',
			  closedPositions: openPositions.length,
			  message: `Closed ${openPositions.length} positions for ${symbol}`
			};

		  } else if (signal.action === 'buy' || signal.action === 'sell') {
			// Calculate stop loss using ATR (if provided) or percentage
			const atrMultiplier = 2;
			const stopLossPrice = body.atr_stop || (signal.action === 'buy' 
			  ? currentPrice * 0.98  // 2% below for long
			  : currentPrice * 1.02  // 2% above for short
			);

			// Create trade data for validation
			const tradeData = {
			  symbol: symbol,
			  action: signal.action,
			  entryPrice: currentPrice,
			  stopLossPrice: stopLossPrice,
			  signalStrength: signal.signalStrength
			};

			// Validate trade
			const validation = await riskManager.validateTrade(
			  tradeData, 
			  currentBalance, 
			  positions
			);

			if (!validation.isValid) {
			  return json({
				ok: false,
				error: 'Trade validation failed',
				errors: validation.errors,
				warnings: validation.warnings
			  }, 400);
			}

			// Place the order
			const side = signal.action === 'buy' ? 'Buy' : 'Sell';
			const quantity = validation.adjustedTrade.calculatedSize;

			const orderResult = await bybitClient.placeOrder(symbol, side, quantity);

			// Set stop loss if order was successful
			if (orderResult.orderId) {
			  try {
				await bybitClient.setTradingStop(symbol, side, stopLossPrice);
			  } catch (stopError) {
				console.warn('Failed to set stop loss:', stopError.message);
			  }
			}

			result = {
			  action: signal.action,
			  orderId: orderResult.orderId,
			  symbol: symbol,
			  side: side,
			  quantity: quantity,
			  price: currentPrice,
			  stopLoss: stopLossPrice,
			  signalStrength: signal.signalStrength,
			  validation: {
				warnings: validation.warnings
			  }
			};
		  } else {
			result = {
			  action: 'hold',
			  message: 'Signal not strong enough for trade execution',
			  signalStrength: signal.signalStrength
			};
		  }

		  // Add risk metrics to response
		  const riskMetrics = riskManager.getRiskMetrics(currentBalance, currentBalance, positions);
		  result.riskMetrics = riskMetrics;

		  return json({ 
			ok: true, 
			...result,
			timestamp: new Date().toISOString()
		  }, 200, { "access-control-allow-origin": "*" });

		} catch (error) {
		  console.error('Bybit trading error:', error);
		  return json({
			ok: false,
			error: error.message,
			timestamp: new Date().toISOString()
		  }, 500, { "access-control-allow-origin": "*" });
		}
	  }

	  // --- GET /status (Health check endpoint)
	  if (url.pathname === "/status" && request.method === "GET") {
		try {
		  const bybitClient = new BybitClient(
			env.BYBIT_API_KEY,
			env.BYBIT_API_SECRET,
			env.BYBIT_TESTNET === 'true'
		  );

		  const isHealthy = await bybitClient.ping();
		  
		  return json({
			status: isHealthy ? 'healthy' : 'unhealthy',
			bybit: isHealthy,
			timestamp: new Date().toISOString(),
			testnet: env.BYBIT_TESTNET === 'true'
		  });
		} catch (error) {
		  return json({
			status: 'error',
			error: error.message,
			timestamp: new Date().toISOString()
		  }, 500);
		}
	  }
  
	  return new Response("Not found", { status: 404 });
	}
  };
  