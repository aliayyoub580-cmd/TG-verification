const mockInsert = jest.fn().mockResolvedValue({ error: null });
const mockFrom = jest.fn(() => ({
  select: jest.fn(() => ({
    in: jest.fn().mockResolvedValue({ data: [], error: null }),
    limit: jest.fn().mockResolvedValue({ data: [], error: null }),
  })),
  insert: mockInsert,
}));

jest.mock('../config/supabase', () => ({
  supabaseAdmin: { from: mockFrom },
}));

const {
  previewCSVImport,
  importCSV,
  getCSVTemplate,
} = require('../services/importExportService');

describe('three-column QR CSV format', () => {
  beforeEach(() => {
    mockInsert.mockClear();
    mockFrom.mockClear();
  });

  test('template contains only code, batch_number, and status', () => {
    expect(getCSVTemplate().toString('utf8')).toBe(
      'code,batch_number,status\nAFMU000SZQ,batch-2,active\n'
    );
  });

  test('preview accepts the requested format without product_id', async () => {
    const preview = await previewCSVImport(
      Buffer.from('code,batch_number,status\nAFMU000SZQ,batch-2,active\n')
    );

    expect(preview.importReady).toBe(1);
    expect(preview.sample[0]).toMatchObject({
      code: 'AFMU000SZQ',
      batch_number: 'batch-2',
      status: 'active',
    });
  });

  test('import stores batch_number and does not require product_id', async () => {
    const result = await importCSV(
      Buffer.from('code,batch_number,status\nAFMU000SZQ,batch-2,active\n')
    );

    expect(result).toMatchObject({ imported: 1, failed: 0 });
    expect(mockInsert).toHaveBeenCalledWith([
      { code: 'AFMU000SZQ', batch_number: 'batch-2', status: 'active' },
    ]);
  });

  test('rejects the old product_id format with a clear error', async () => {
    await expect(
      previewCSVImport(Buffer.from('code,product_id,status\nABC123,uuid,active\n'))
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});
