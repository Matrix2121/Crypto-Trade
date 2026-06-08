-- Add CoinGecko coin id for targeted market-stats sync
ALTER TABLE tracked_asset ADD COLUMN IF NOT EXISTS coingecko_id VARCHAR(64);

UPDATE tracked_asset SET coingecko_id = 'bitcoin' WHERE symbol = 'BTC/USD' AND coingecko_id IS NULL;
UPDATE tracked_asset SET coingecko_id = 'ethereum' WHERE symbol = 'ETH/USD' AND coingecko_id IS NULL;
UPDATE tracked_asset SET coingecko_id = 'ripple' WHERE symbol = 'XRP/USD' AND coingecko_id IS NULL;
UPDATE tracked_asset SET coingecko_id = 'tether' WHERE symbol = 'USDT/USD' AND coingecko_id IS NULL;
UPDATE tracked_asset SET coingecko_id = 'binancecoin' WHERE symbol = 'BNB/USD' AND coingecko_id IS NULL;
UPDATE tracked_asset SET coingecko_id = 'solana' WHERE symbol = 'SOL/USD' AND coingecko_id IS NULL;
UPDATE tracked_asset SET coingecko_id = 'usd-coin' WHERE symbol = 'USDC/USD' AND coingecko_id IS NULL;
UPDATE tracked_asset SET coingecko_id = 'dogecoin' WHERE symbol = 'DOGE/USD' AND coingecko_id IS NULL;
UPDATE tracked_asset SET coingecko_id = 'tron' WHERE symbol = 'TRX/USD' AND coingecko_id IS NULL;
UPDATE tracked_asset SET coingecko_id = 'cardano' WHERE symbol = 'ADA/USD' AND coingecko_id IS NULL;
UPDATE tracked_asset SET coingecko_id = 'wrapped-bitcoin' WHERE symbol = 'WBTC/USD' AND coingecko_id IS NULL;
UPDATE tracked_asset SET coingecko_id = 'stellar' WHERE symbol = 'XLM/USD' AND coingecko_id IS NULL;
UPDATE tracked_asset SET coingecko_id = 'sui' WHERE symbol = 'SUI/USD' AND coingecko_id IS NULL;
UPDATE tracked_asset SET coingecko_id = 'chainlink' WHERE symbol = 'LINK/USD' AND coingecko_id IS NULL;
UPDATE tracked_asset SET coingecko_id = 'hedera-hashgraph' WHERE symbol = 'HBAR/USD' AND coingecko_id IS NULL;
UPDATE tracked_asset SET coingecko_id = 'bitcoin-cash' WHERE symbol = 'BCH/USD' AND coingecko_id IS NULL;
UPDATE tracked_asset SET coingecko_id = 'avalanche-2' WHERE symbol = 'AVAX/USD' AND coingecko_id IS NULL;
UPDATE tracked_asset SET coingecko_id = 'shiba-inu' WHERE symbol = 'SHIB/USD' AND coingecko_id IS NULL;
UPDATE tracked_asset SET coingecko_id = 'the-open-network' WHERE symbol = 'TON/USD' AND coingecko_id IS NULL;
UPDATE tracked_asset SET coingecko_id = 'litecoin' WHERE symbol = 'LTC/USD' AND coingecko_id IS NULL;
