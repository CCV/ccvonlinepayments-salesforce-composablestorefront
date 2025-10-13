'use strict';
var ShippingLineItem = require('dw/order/ShippingLineItem');

/**
 * Ideal Order Line model - used in Ideal Fast Checkout
 * @param {dw.order.LineItem} lineItem line item
 */
function IdealOrderLine(lineItem) {
    this.type = lineItem instanceof ShippingLineItem ? 'SHIPPING_FEE' : 'PHYSICAL';
    this.name = lineItem.lineItemText;
    this.quantity = 'quantity' in lineItem ? lineItem.quantity.value : 1; // shipping line items don't have a qty
    this.unit = 'quantity' in lineItem ? lineItem.quantity.unit || 'pc' : 'pc';
    this.unitPrice = lineItem.basePrice.value;
    this.totalPrice = lineItem.adjustedGrossPrice.value;
}

module.exports = {
    IdealOrderLine
};
