/**
 * 平台基类
 */
export interface BalanceResult {
  platform: string;
  balance: number;
  currency: string;
  unit?: string;
  display: string;
  color?: 'green' | 'yellow' | 'red';
  error?: string;
  raw_data?: unknown;
}

export interface BalanceFetcher {
  platform: string;
  fetch(apiKey: string | undefined, baseUrl: string | undefined): Promise<BalanceResult>;
}
