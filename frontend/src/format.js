export const peso = (n) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n);
export const when = (d) => new Date(d).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
export const STATUS = {
  pending:   { label: 'Pending',   hint: 'Waiting for the store to confirm.' },
  preparing: { label: 'Preparing', hint: 'Your order is being prepared.' },
  ready:     { label: 'Ready',     hint: 'Ready! Show your order code to the store.' },
  out_for_delivery: { label: 'Out for delivery', hint: 'Your order is on its way! Keep your phone nearby.' },
  completed: { label: 'Completed', hint: 'Order completed. Salamat!' },
  cancelled: { label: 'Cancelled', hint: 'This order was cancelled.' },
};

// Label at hint ayon sa uri ng order: ang "Ready" ay "Ready for pickup" kapag Pickup
export const statusOf = (status, fulfillment) => {
  if (status === 'ready') {
    return fulfillment === 'pickup'
      ? { label: 'Ready for pickup', hint: 'Ready to pick up! Show your order code to the store.' }
      : { label: 'Ready', hint: 'Your order is packed and will be sent out for delivery soon.' };
  }
  return STATUS[status];
};
