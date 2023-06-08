var KLARNA_CONST = {
    TYPES: {
        PHYSICAL: 'PHYSICAL',
        SHIPPING_FEE: 'SHIPPING_FEE',
        SURCHARGE: 'SURCHARGE',
        DISCOUNT: 'DISCOUNT'
    }
};

/**
 * Klarna product order line model
 * @param {dw.order.ProductLineItem} lineItem product line item
 */
function KlarnaProductLineModel(lineItem) {
    this.type = KLARNA_CONST.TYPES.PHYSICAL;
    this.name = lineItem.lineItemText;
    this.code = lineItem.productID;
    this.quantity = lineItem.quantity.value;
    this.unit = lineItem.quantity.unit || 'pc';
    this.unitPrice = lineItem.basePrice.value;
    this.totalPrice = lineItem.adjustedGrossPrice.value;
    // this.discount = '';
    this.vatRate = lineItem.taxRate * 100;
    this.vat = lineItem.tax.value;
    // this.url: '';
    // this.imageUrl: '';
    // this.brand: '';
}

/**
 * Klarna shipping order line model
 * @param {dw.order.ShippingLineItem | dw.order.ProductShippingLineItem} lineItem shipping line item
 */
function KlarnaShippingLineModel(lineItem) {
    this.type = KLARNA_CONST.TYPES.SHIPPING_FEE;
    this.name = lineItem.lineItemText;
    this.quantity = 1;
    this.vatRate = lineItem.taxRate * 100;
    this.vat = lineItem.tax.value;
    this.totalPrice = lineItem.adjustedGrossPrice.value;
    this.unitPrice = lineItem.adjustedGrossPrice.value;
}

/**
 * Klarna discount order line model
 * @param {dw.order.ProductLineItem} lineItem product line item
 */
function KlarnaDiscountLineModel(lineItem) {
    this.type = lineItem.priceValue < 0 ? KLARNA_CONST.TYPES.DISCOUNT : KLARNA_CONST.TYPES.SURCHARGE;
    this.name = lineItem.lineItemText;
    this.quantity = lineItem.quantity || 1;
    this.totalPrice = lineItem.grossPrice.value;
    this.unitPrice = (lineItem.grossPrice.divide(this.quantity)).value;
}

module.exports = {
    KlarnaProductLineModel,
    KlarnaShippingLineModel,
    KlarnaDiscountLineModel
};
