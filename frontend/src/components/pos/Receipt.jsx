import React, { useRef } from 'react';
import { CheckCircle, Printer, ShoppingCart, WifiOff } from 'lucide-react';
import { format } from 'date-fns';

export default function Receipt({ sale, onNew, user }) {
  const printRef = useRef();

  const handlePrint = () => {
    const content = printRef.current.innerHTML;
    const win = window.open('', '_blank', 'width=400,height=600');
    win.document.write(`
      <html><head><title>Receipt ${sale.receiptNumber}</title>
      <style>
        body { font-family: 'Courier New', monospace; font-size: 12px; width: 300px; margin: 0 auto; padding: 10px; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .line { border-top: 1px dashed #000; margin: 6px 0; }
        .row { display: flex; justify-content: space-between; }
        .total-row { font-weight: bold; font-size: 14px; }
        h2 { font-size: 16px; margin: 4px 0; }
        p { margin: 2px 0; }
      </style></head>
      <body>${content}</body></html>
    `);
    win.document.close();
    win.print();
  };

  const isOffline = sale.status === 'pending_sync';

  return (
    <div className="min-h-full bg-surface-950 flex items-start justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Success banner */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-emerald-900/40 border-2 border-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle size={32} className="text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Sale Complete!</h2>
          {isOffline && (
            <div className="mt-2 flex items-center justify-center gap-1.5 text-amber-400 text-sm">
              <WifiOff size={13} /> Saved offline — will sync when online
            </div>
          )}
        </div>

        {/* Receipt card */}
        <div className="bg-white text-gray-900 rounded-2xl overflow-hidden shadow-2xl" ref={printRef}>
          <div className="center p-4 bg-slate-900 text-white">
            <h2 className="bold">MY SHOP</h2>
            <p style={{ fontSize: '11px', color: '#94a3b8' }}>123 Main Street, Accra</p>
            <p style={{ fontSize: '11px', color: '#94a3b8' }}>Tel: +233 24 000 0001</p>
          </div>

          <div className="p-4 space-y-1 text-xs font-mono">
            <div className="row">
              <span>Receipt:</span>
              <span className="bold">{sale.receiptNumber}</span>
            </div>
            <div className="row">
              <span>Date:</span>
              <span>{format(new Date(sale.offlineCreatedAt || sale.createdAt || new Date()), 'dd/MM/yyyy HH:mm')}</span>
            </div>
            <div className="row">
              <span>Cashier:</span>
              <span>{user?.firstName} {user?.lastName}</span>
            </div>
            <div className="row">
              <span>Payment:</span>
              <span>{sale.paymentMethod?.replace('_', ' ')}</span>
            </div>

            <div className="line" />

            {/* Items */}
            {(sale.items || []).map((item, i) => (
              <div key={i}>
                <div className="bold">{item.productName}</div>
                <div className="row">
                  <span>{item.quantity} x ₵{Number(item.unitPrice).toFixed(2)}</span>
                  <span>₵{Number(item.subtotal).toFixed(2)}</span>
                </div>
              </div>
            ))}

            <div className="line" />

            <div className="row"><span>Subtotal</span><span>₵{Number(sale.subtotal).toFixed(2)}</span></div>
            {Number(sale.taxAmount) > 0 && (
              <div className="row"><span>Tax</span><span>₵{Number(sale.taxAmount).toFixed(2)}</span></div>
            )}
            {Number(sale.discountAmount) > 0 && (
              <div className="row"><span>Discount</span><span>-₵{Number(sale.discountAmount).toFixed(2)}</span></div>
            )}

            <div className="line" />

            <div className="row total-row">
              <span>TOTAL</span>
              <span>₵{Number(sale.total).toFixed(2)}</span>
            </div>

            {sale.paymentMethod === 'CASH' && (
              <>
                <div className="row"><span>Amount Paid</span><span>₵{Number(sale.amountPaid).toFixed(2)}</span></div>
                <div className="row bold"><span>Change</span><span>₵{Number(sale.changeDue || 0).toFixed(2)}</span></div>
              </>
            )}

            <div className="line" />
            <div className="center" style={{ fontSize: '11px', color: '#6b7280' }}>
              <p>Thank you for your purchase!</p>
              <p>Powered by POS System v1.0</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={handlePrint}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl flex items-center justify-center gap-2 font-medium transition-colors"
          >
            <Printer size={16} /> Print
          </button>
          <button
            onClick={onNew}
            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center justify-center gap-2 font-medium transition-colors"
          >
            <ShoppingCart size={16} /> New Sale
          </button>
        </div>
      </div>
    </div>
  );
}
