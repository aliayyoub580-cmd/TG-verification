const productSingle = jest.fn().mockResolvedValue({ data: { id: '11111111-1111-4111-8111-111111111111', name: 'T.G. 15 mg' }, error: null });
const duplicateIn = jest.fn().mockResolvedValue({ data: [], error: null });
const mockFrom = jest.fn((table) => {
  if (table === 'products') return { select: () => ({ eq: () => ({ single: productSingle }) }) };
  if (table === 'qr_codes') return { select: () => ({ in: duplicateIn }) };
  return {};
});
jest.mock('../config/supabase', () => ({ supabaseAdmin: { from: mockFrom } }));
const { previewCSVImport, getCSVTemplate } = require('../services/importExportService');
const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';

describe('client-provided code CSV workflow', () => {
  beforeEach(() => { jest.clearAllMocks(); duplicateIn.mockResolvedValue({ data: [], error: null }); });
  test('template contains only the code column and examples', () => {
    expect(getCSVTemplate().toString()).toBe('code\n7GG6Y89U8K\nABC123XYZ9\nCODE000003\n');
  });
  test('product selection is required', async () => {
    await expect(previewCSVImport(Buffer.from('code\nABC123\n'))).rejects.toMatchObject({ statusCode: 400 });
  });
  test('previews ten client-provided codes', async () => {
    const csv = `code\n${Array.from({length:10},(_,i)=>`CLIENT${String(i).padStart(4,'0')}`).join('\n')}\n`;
    const result = await previewCSVImport(Buffer.from(csv), PRODUCT_ID);
    expect(result).toMatchObject({ totalRows: 10, importReady: 10, invalid: 0, duplicatesInFile: 0 });
  });
  test('trims stored values and detects case-insensitive duplicates within CSV', async () => {
    const result = await previewCSVImport(Buffer.from('code\n  AbC123  \nabc123\n'), PRODUCT_ID);
    expect(result.importReady).toBe(1); expect(result.sample[0].code).toBe('AbC123'); expect(result.duplicatesInFile).toBe(1);
  });
  test('detects codes already in database', async () => {
    duplicateIn.mockResolvedValue({ data: [{ code_normalized: 'ABC123' }], error: null });
    const result = await previewCSVImport(Buffer.from('code\nABC123\n'), PRODUCT_ID);
    expect(result.importReady).toBe(0); expect(result.duplicatesInDB).toBe(1);
  });
  test('reports empty and invalid rows', async () => {
    const result = await previewCSVImport(Buffer.from('code\n\nA\nVALID1\n'), PRODUCT_ID);
    expect(result.invalid).toBeGreaterThanOrEqual(1); expect(result.importReady).toBe(1);
  });
});
