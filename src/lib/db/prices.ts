/**
 * Oil Prices Database CRUD Operations
 * Store and retrieve oil prices from the oil_prices table.
 */

import { pool } from './index';
import type { OilPriceData, OilPricePoint } from '../external/alphavantage';

export type { OilPriceData, OilPricePoint };

/**
 * Insert a new oil price record into the database.
 *
 * @param price - Oil price data with symbol, current price, and change
 */
export async function insertPrice(price: OilPriceData): Promise<void> {
  await pool.query(`
    INSERT INTO oil_prices (symbol, price, change, change_percent)
    VALUES ($1, $2, $3, $4)
  `, [price.symbol, price.current, price.change, price.changePercent]);
}

/**
 * Get the latest price for each oil symbol with 30-day history for sparklines.
 *
 * @returns Array of prices with symbol, current price, change, and history
 */
export async function getLatestPrices(): Promise<{
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  history: { value: number }[];
}[]> {
  // Get latest price for each symbol
  const latest = await pool.query<{
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
  }>(`
    SELECT DISTINCT ON (symbol) symbol, price, change, change_percent as "changePercent"
    FROM oil_prices ORDER BY symbol, fetched_at DESC
  `);

  // Get 30-day history for sparkline
  const history = await pool.query<{
    symbol: string;
    value: number;
    fetched_at: Date;
  }>(`
    SELECT symbol, price as value, fetched_at
    FROM oil_prices
    WHERE fetched_at > NOW() - INTERVAL '30 days'
    ORDER BY symbol, fetched_at ASC
  `);

  return latest.rows.map(row => ({
    ...row,
    price: Number(row.price),
    change: Number(row.change),
    changePercent: Number(row.changePercent),
    history: history.rows
      .filter(h => h.symbol === row.symbol)
      .map(h => ({ value: Number(h.value) })),
  }));
}
