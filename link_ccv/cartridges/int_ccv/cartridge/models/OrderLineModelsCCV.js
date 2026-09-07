'use strict';
var { CCV_CONST, getImageUrlFromProductID, getProductDiscount } = require('*/cartridge/scripts/helpers/CCVModelHelpers');

/**
 * CCV product order line model
 * @param {dw.order.ProductLineItem} lineItem product line item
 */
function ProductLineModelCCV(lineItem) {
    this.type = CCV_CONST.TYPES.PHYSICAL;
    this.name = lineItem.lineItemText;
    this.code = lineItem.productID;
    this.quantity = lineItem.quantity.value;
    this.unit = lineItem.quantity.unit || 'pc';
    this.unitPrice = lineItem.basePrice.value;
    this.totalPrice = lineItem.adjustedGrossPrice.value;
    this.vatRate = lineItem.taxRate * 100;
    this.vat = lineItem.tax.value;
    // this.url: '';
    this.imageUrl = getImageUrlFromProductID(lineItem.productID) || '';
    // this.brand: '';
    if (Object.hasOwnProperty.call(lineItem, 'priceAdjustments') && lineItem.priceAdjustments.length > 0) {
        this.discount = getProductDiscount(lineItem);
    }
}

/**
 * CCV shipping order line model
 * @param {dw.order.ShippingLineItem | dw.order.ProductShippingLineItem} lineItem shipping line item
 */
function ShippingLineModelCCV(lineItem) {
    this.type = CCV_CONST.TYPES.SHIPPING_FEE;
    this.name = lineItem.lineItemText;
    this.quantity = 1;
    this.vatRate = lineItem.taxRate * 100;
    this.vat = lineItem.tax.value;
    this.totalPrice = lineItem.adjustedGrossPrice.value;
    this.unitPrice = lineItem.adjustedGrossPrice.value;
}

/**
 * CCV discount order line model
 * @param {number} discountValue discount value
 */
function DiscountLineModelCCV(discountValue) {
    this.type = discountValue < 0 ? CCV_CONST.TYPES.DISCOUNT : CCV_CONST.TYPES.SURCHARGE;
    this.name = 'DISCOUNT';
    this.quantity = 1;
    this.totalPrice = discountValue;
    this.unitPrice = discountValue;
}

module.exports = {
    ProductLineModelCCV,
    ShippingLineModelCCV,
    DiscountLineModelCCV
};
