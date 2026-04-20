export const googleSheetsService = {
  async syncToSheets(guidelines: any[], webAppUrl: string): Promise<void> {
    const response = await fetch('/api/sheets/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        url: webAppUrl, 
        method: 'POST',
        data: { action: 'sync', guidelines } 
      })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to sync to sheets');
    }
  },

  async fetchFromSheets(webAppUrl: string): Promise<any[]> {
    const response = await fetch(`/api/sheets/proxy?url=${encodeURIComponent(webAppUrl)}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch from sheets');
    }
    const { guidelines } = await response.json();
    return guidelines;
  }
};
