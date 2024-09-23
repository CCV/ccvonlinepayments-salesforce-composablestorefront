var KLARNA_CONST = {
    TYPES: {
        PHYSICAL: 'PHYSICAL',
        SHIPPING_FEE: 'SHIPPING_FEE',
        SURCHARGE: 'SURCHARGE',
        DISCOUNT: 'DISCOUNT'
    }
};

/**
 * Calculates the total product discount for the given line item
 * @param {dw.order.ProductLineItem} lineItem product line item
 * 
 * @returns {number} calculated total product discount
 */
function getProductDiscount (lineItem) {
    var totalDiscount = 0;
    collections.forEach(lineItem.priceAdjustments, (priceAdjusment) => {
        var priceValue = Number(priceAdjusment.priceValue);
        totalDiscount += Math.abs(priceValue);
    })
    return totalDiscount;
}

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
    this.vatRate = lineItem.taxRate * 100;
    this.vat = lineItem.tax.value;
    // this.url: '';
    // this.imageUrl: '';
    // this.brand: '';
    if (Object.hasOwnProperty.call(lineItem, 'priceAdjustments') && lineItem.priceAdjustments.length > 0) {
        this.discount = KlarnaModelsCCV.getProductDiscount(lineItem);
    }
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
 * @param {number} discountValue discount value
 */
function KlarnaDiscountLineModel(discountValue) {
    this.type = discountValue < 0 ? KLARNA_CONST.TYPES.DISCOUNT : KLARNA_CONST.TYPES.SURCHARGE;
    this.name = 'DISCOUNT';
    this.quantity = 1;
    this.totalPrice = discountValue;
    this.unitPrice = discountValue;
}

module.exports = {
    KlarnaProductLineModel,
    KlarnaShippingLineModel,
    KlarnaDiscountLineModel
};
