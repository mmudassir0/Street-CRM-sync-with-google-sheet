import axios, { AxiosInstance } from 'axios';
import { getConfig } from './config';

export interface StreetRecord {
  [key: string]: any;
}

export class StreetClient {
  public client: AxiosInstance;
  public baseUrl: string;

  constructor() {
    const config = getConfig();
    if (!config.streetApiKey) {
      throw new Error(
        'STREET_API_KEY is not defined. Please set it in your .env file or environment variables.'
      );
    }

    this.baseUrl = config.streetBaseUrl;
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${config.streetApiKey}`,
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
      },
      timeout: 60000,
    });
  }

  /**
   * Performs an independent connection check to Street API.
   */
  async testConnection(): Promise<{ success: boolean; status: number; sampleData?: any; error?: string }> {
    try {
      // First try /properties?page[size]=1
      const response = await this.client.get('/properties', {
        params: { 'page[size]': 1 },
      });

      return {
        success: true,
        status: response.status,
        sampleData: response.data,
      };
    } catch (err: any) {
      const status = err.response?.status || 500;
      const errorMsg =
        err.response?.data?.errors?.[0]?.detail ||
        err.response?.data?.message ||
        err.message;

      return {
        success: false,
        status,
        error: errorMsg,
      };
    }
  }

  /**
   * Fetches all records from a given Street API endpoint with pagination handling.
   */
  async fetchAll(endpoint: string, maxPages: number = 50): Promise<StreetRecord[]> {
    const allRecords: StreetRecord[] = [];
    let currentPage = 1;
    const pageSize = 100;

    // Normalize endpoint (e.g. "properties" or "/properties")
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    console.log(`[Street API] Fetching from ${cleanEndpoint}...`);

    while (currentPage <= maxPages) {
      try {
        const response = await this.client.get(cleanEndpoint, {
          params: {
            'page[number]': currentPage,
            'page[size]': pageSize,
          },
        });

        const data = response.data;
        let items: any[] = [];

        // Handle JSON:API standard: { data: [ { id, type, attributes: { ... } } ] }
        if (Array.isArray(data?.data)) {
          items = data.data.map((item: any) => this.flattenJsonApiRecord(item));
        } else if (Array.isArray(data)) {
          // Plain JSON array
          items = data.map((item: any) => this.flattenRecord(item));
        } else if (Array.isArray(data?.results)) {
          // Paginated { results: [ ... ] }
          items = data.results.map((item: any) => this.flattenRecord(item));
        } else if (data?.data && typeof data.data === 'object') {
          // Single record object returned
          items = [this.flattenJsonApiRecord(data.data)];
        }

        if (items.length === 0) {
          break;
        }

        allRecords.push(...items);
        console.log(`  -> Page ${currentPage}: Fetched ${items.length} records (Total so far: ${allRecords.length})`);

        // Check if there is a next page indicator or if we received fewer than pageSize
        const hasNextPage =
          data?.links?.next !== undefined && data?.links?.next !== null;
        const totalMeta = data?.meta?.pagination?.total || data?.meta?.total;

        if (totalMeta && allRecords.length >= totalMeta) {
          break;
        }

        if (!hasNextPage && items.length < pageSize) {
          break;
        }

        currentPage++;
      } catch (err: any) {
        if (err.response?.status === 404) {
          console.warn(`[Street API] Endpoint "${cleanEndpoint}" returned 404 Not Found. Skipping this endpoint.`);
          return [];
        }
        throw new Error(
          `Failed to fetch ${cleanEndpoint} (Page ${currentPage}): ${
            err.response?.data?.errors?.[0]?.detail || err.message
          }`
        );
      }
    }

    return allRecords;
  }

  /**
   * Flattens a JSON:API resource object into a flat key-value dictionary.
   */
  private flattenJsonApiRecord(item: any): StreetRecord {
    const flat: StreetRecord = {};

    if (item.id !== undefined) flat['id'] = item.id;
    if (item.type !== undefined) flat['type'] = item.type;

    // Flatten attributes
    if (item.attributes && typeof item.attributes === 'object') {
      const flatAttrs = this.flattenRecord(item.attributes);
      for (const [key, val] of Object.entries(flatAttrs)) {
        flat[key] = val;
      }
    }

    // Flatten relationships (extract related IDs)
    if (item.relationships && typeof item.relationships === 'object') {
      for (const [relName, relData] of Object.entries(item.relationships as Record<string, any>)) {
        if (relData?.data?.id) {
          flat[`${relName}_id`] = relData.data.id;
        } else if (Array.isArray(relData?.data)) {
          flat[`${relName}_ids`] = relData.data.map((r: any) => r.id).join(', ');
        }
      }
    }

    return flat;
  }

  /**
   * Recursively flattens an arbitrary object into dot-notation keys.
   */
  private flattenRecord(obj: any, prefix: string = ''): StreetRecord {
    const flattened: StreetRecord = {};

    for (const [key, value] of Object.entries(obj || {})) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (value === null || value === undefined) {
        flattened[fullKey] = '';
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        // Nested object
        const nested = this.flattenRecord(value, fullKey);
        Object.assign(flattened, nested);
      } else if (Array.isArray(value)) {
        // Array: check if simple primitives or array of objects
        if (value.length > 0 && typeof value[0] === 'object') {
          flattened[fullKey] = JSON.stringify(value);
        } else {
          flattened[fullKey] = value.join(', ');
        }
      } else {
        flattened[fullKey] = value;
      }
    }

    return flattened;
  }
}
