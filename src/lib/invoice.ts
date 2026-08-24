import { db } from '@/lib/db';
import { formatMoney, INR, taxableFromInclusive, taxFromInclusive, roundOffDelta } from '@/lib/money';
import { pdf } from '@react-pdf/renderer';

interface InvoiceData {
  orderId: string;
  kind: 'tax' | 'credit_note';
}

export async function generateInvoice(data: InvoiceData): Promise<Buffer> {
  const order = await db.order.findUnique({
    where: { id: data.orderId },
    include: {
      user: true,
      items: { include: { product: true, variant: true } },
      shipments: true,
    },
  });

  if (!order) throw new Error('Order not found');

  const financialYear = getFinancialYear(order.placedAt);
  const invoiceNumber = await generateInvoiceNumber(data.kind, financialYear);

  const seller = {
    name: 'LUMEN&CO',
    gstin: '27ABCDE1234F1Z5',
    address: '123 Fashion Street, Mumbai, Maharashtra 400001',
    stateCode: '27',
  };

  const buyer = {
    name: order.user.name,
    gstin: undefined,
    address: order.shippingAddressJson,
    placeOfSupply: JSON.parse(order.shippingAddressJson).stateCode || '27',
  };

  const lines = order.items.map((item, index) => {
    const taxable = taxableFromInclusive(item.lineTotal, item.taxRate);
    const taxAmount = item.lineTotal - taxable;
    const cgst = item.hsnCode && buyer.placeOfSupply === seller.stateCode ? taxAmount / 2 : 0;
    const sgst = item.hsnCode && buyer.placeOfSupply === seller.stateCode ? taxAmount / 2 : 0;
    const igst = item.hsnCode && buyer.placeOfSupply !== seller.stateCode ? taxAmount : 0;

    return {
      sno: index + 1,
      description: `${item.name} (${item.size} / ${item.color})`,
      hsnCode: item.hsnCode,
      qty: item.qty,
      unit: 'PCS',
      unitPrice: formatMoney(item.unitPrice, { currency: INR }),
      taxableValue: formatMoney(taxable, { currency: INR }),
      taxRate: item.taxRate,
      cgst: formatMoney(cgst, { currency: INR }),
      sgst: formatMoney(sgst, { currency: INR }),
      igst: formatMoney(igst, { currency: INR }),
      total: formatMoney(item.lineTotal, { currency: INR }),
    };
  });

  const taxableTotal = lines.reduce((sum, l) => sum + Number(l.taxableValue.replace(/[₹,]/g, '')), 0);
  const cgstTotal = lines.reduce((sum, l) => sum + Number(l.cgst.replace(/[₹,]/g, '')), 0);
  const sgstTotal = lines.reduce((sum, l) => sum + Number(l.sgst.replace(/[₹,]/g, '')), 0);
  const igstTotal = lines.reduce((sum, l) => sum + Number(l.igst.replace(/[₹,]/g, '')), 0);
  const totalTax = cgstTotal + sgstTotal + igstTotal;
  const roundOff = roundOffDelta(order.grandTotal);
  const grandTotal = order.grandTotal + roundOff;

  const invoice = {
    invoiceNumber,
    kind: data.kind,
    financialYear,
    seller,
    buyer,
    lines,
    totals: {
      taxableValue: formatMoney(taxableTotal, { currency: INR }),
      cgst: formatMoney(cgstTotal, { currency: INR }),
      sgst: formatMoney(sgstTotal, { currency: INR }),
      igst: formatMoney(igstTotal, { currency: INR }),
      totalTax: formatMoney(totalTax, { currency: INR }),
      roundOff: formatMoney(roundOff, { currency: INR }),
      grandTotal: formatMoney(grandTotal, { currency: INR }),
    },
    issuedAt: new Date(),
  };

  await db.invoice.create({
    data: {
      orderId: order.id,
      invoiceNumber,
      kind: data.kind,
      financialYear,
      sellerName: seller.name,
      sellerGstin: seller.gstin,
      sellerAddress: seller.address,
      sellerStateCode: seller.stateCode,
      buyerName: buyer.name,
      buyerGstin: buyer.gstin,
      buyerAddress: buyer.address,
      placeOfSupply: buyer.placeOfSupply,
      taxableValue: taxableTotal,
      cgst: cgstTotal,
      sgst: sgstTotal,
      igst: igstTotal,
      cess: 0,
      roundOff,
      total: grandTotal,
      linesJson: JSON.stringify(lines),
      issuedAt: new Date(),
    },
  });

  return Buffer.from(JSON.stringify(invoice));
}

function getFinancialYear(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  if (month >= 4) return `${year}-${year + 1}`;
  return `${year - 1}-${year}`;
}

async function generateInvoiceNumber(kind: 'tax' | 'credit_note', financialYear: string): Promise<string> {
  const prefix = kind === 'tax' ? 'INV' : 'CN';
  const count = await db.invoice.count({ where: { financialYear, kind } });
  return `${prefix}-${financialYear}-${String(count + 1).padStart(6, '0')}`;
}

export async function getInvoicePdfBuffer(orderId: string): Promise<Buffer> {
  const invoiceData = await generateInvoice({ orderId, kind: 'tax' });
  return invoiceData;
}