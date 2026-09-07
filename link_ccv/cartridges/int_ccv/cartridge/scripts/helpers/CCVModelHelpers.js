'use strict';

var CCV_CONST = {
    TYPES: {
        PHYSICAL: 'PHYSICAL',
        SHIPPING_FEE: 'SHIPPING_FEE',
        SURCHARGE: 'SURCHARGE',
        DISCOUNT: 'DISCOUNT'
    }
};
var IMAGE_SIZE = 'medium';

/**
 * Get Image URL from given Product ID
 *
 * @param {string} productID - Suggested product ID
 * @return {string} - Image URL
 */
function getImageUrlFromProductID(productID) {
    var ProductMgr = require('dw/catalog/ProductMgr');
    var product = ProductMgr.getProduct(productID);
    if (!product) { return null; }
    var imageProduct = product;
    if (product.master) {
        imageProduct = product.variationModel.defaultVariant;
    }
    return imageProduct.getImage(IMAGE_SIZE).httpsURL.toString();
}

/**
 * Calculates the total product discount for the given line item
 * @param {dw.order.ProductLineItem} lineItem product line item
 *
 * @returns {number} calculated total product discount
 */
function getProductDiscount(lineItem) {
    var collections = require('*/cartridge/scripts/util/collections');
    var totalDiscount = 0;
    collections.forEach(lineItem.priceAdjustments, (priceAdjusment) => {
        var priceValue = Number(priceAdjusment.priceValue);
        totalDiscount += Math.abs(priceValue);
    });
    return totalDiscount;
}

module.exports = {
    CCV_CONST,
    getImageUrlFromProductID,
    getProductDiscount
};
