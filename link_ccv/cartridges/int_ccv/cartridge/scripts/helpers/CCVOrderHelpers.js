var Site = require('dw/system/Site');
var ProductLineItem = require('dw/order/ProductLineItem');
var ShippingLineItem = require('dw/order/ShippingLineItem');
var ProductShippingLineItem = require('dw/order/ProductShippingLineItem');
var PriceAdjustment = require('dw/order/PriceAdjustment');
var { CCV_CONSTANTS } = require('*/cartridge/scripts/services/CCVPaymentHelpers');

/**
 * Returns amount eligible for refund for the given order
 * @param {dw.order.Order} order SFCC order
 * @returns {dw.value.Money} refundable amount
 */
function getRefundAmountRemaining(order) {
    var Money = require('dw/value/Money');

    var refunds = JSON.parse(order.custom.ccvRefunds || '[]');
    var currencyCode = order.currencyCode;
    var refundedTotalAmount = new Money(0, currencyCode);

    refunds.forEach((refund) => {
        if (refund.status !== CCV_CONSTANTS.STATUS.FAILED) {
            refundedTotalAmount = refundedTotalAmount.add(new Money(refund.amount, currencyCode));
        }
    });

    var refundAmountRemaining = order.totalGrossPrice.subtract(refundedTotalAmount);
    return refundAmountRemaining;
}


/**
 * Updates the order with the given refunds and updates ccvHasPendingRefunds and ccvManualInterventionRefund
 * @param {dw.order.Order} order order to update
 * @param {Array} ccvRefunds array with new refunds
 */
function updateOrderRefunds(order, ccvRefunds) {
    var Transaction = require('dw/system/Transaction');
    var hasPendingRefunds = ccvRefunds.some(refund => refund.status === CCV_CONSTANTS.STATUS.PENDING);
    var requiresManualIntervention = ccvRefunds.some(refund => refund.status === CCV_CONSTANTS.STATUS.MANUAL_INTERVENTION);

    Transaction.wrap(() => {
        order.custom.ccvRefunds = JSON.stringify(ccvRefunds); // eslint-disable-line no-param-reassign
        order.custom.ccvHasPendingRefunds = hasPendingRefunds; // eslint-disable-line no-param-reassign
        if (requiresManualIntervention) order.custom.ccvManualInterventionRefund = true; // eslint-disable-line no-param-reassign
    });
}

/**
 * Extracts the fields required for 3DS frictionless flow
 * @param {dw.order.Order} order dw order
 * @returns {Object} sca fields
 */
function getSCAFields(order) {
    var billingAddress = order.billingAddress;
    var shippingAddress = order.shipments[0].shippingAddress;
    return {
        scaReady: Site.current.getCustomPreferenceValue('ccvScaReadyEnabled') ? 'yes' : 'no',

        billingAddress: billingAddress.address1,
        billingCity: billingAddress.city,
        billingState: billingAddress.stateCode,
        billingPostalCode: billingAddress.postalCode,
        billingCountry: billingAddress.countryCode.value,
        billingHouseExtension: billingAddress.address2 || '',
        billingPhoneNumber: billingAddress.phone.replace(/\D/g, ''),
        billingPhoneCountry: billingAddress.custom.phone_country || '00',
        billingEmail: order.customerEmail,
        billingFirstName: billingAddress.firstName,
        billingLastName: billingAddress.lastName,

        shippingFirstName: shippingAddress.firstName,
        shippingLastName: shippingAddress.lastName,
        shippingAddress: shippingAddress.address1,
        shippingCity: shippingAddress.city,
        shippingState: shippingAddress.stateCode,
        shippingPostalCode: shippingAddress.postalCode,
        shippingCountry: shippingAddress.countryCode.value,
        shippingPhoneCountry: shippingAddress.custom.phone_country || '00',
        shippingPhoneNumber: shippingAddress.phone.replace(/\D/g, ''),
        shippingHouseExtension: shippingAddress.address2 || '',
        shippingEmail: order.customerEmail
    };
}

/**
 *
 * @param {dw.order.Order} order sfcc order
 * @returns {Array} array of order lines used for klarna payments
 */
function getKlarnaOrderLines(order) {
    var collections = require('*/cartridge/scripts/util/collections');
    var lineItems = [];


    collections.forEach(order.allLineItems, (lineItem => {
        lineItems.push(getKlarnaOrderLineModel(lineItem));
    }));

    return lineItems;
}

/**
 * Returns an order line model used in Klarna payments
 * @param {dw.order.ProductLineItem
* |dw.order.ProductShippingLineItem
* |dw.order.ShippingLineItem
* |dw.order.PriceAdjustment} lineItem lineitem
* @returns {Object|null} model
*/
function getKlarnaOrderLineModel(lineItem) {
    var { KlarnaProductLineModel, KlarnaShippingLineModel, KlarnaDiscountLineModel } = require('*/cartridge/models/KlarnaModelsCCV.js');

    if (lineItem instanceof ProductLineItem) {
        return new KlarnaProductLineModel(lineItem);
    } else if (lineItem instanceof ShippingLineItem
        || lineItem instanceof ProductShippingLineItem) {
        return new KlarnaShippingLineModel(lineItem);
    } else if (lineItem instanceof PriceAdjustment) {
        return new KlarnaDiscountLineModel(lineItem);
    }
    return null;
}


/**
 * Updates the CCV refund status on orders with pending refunds
 * @param {dw.order.Order} order order
 */
function checkRefundStatus(order) {
    var ccvLogger = require('dw/system/Logger').getLogger('CCV', 'ccv_refunds');
    var Transaction = require('dw/system/Transaction');
    var { checkCCVTransactions } = require('*/cartridge/scripts/services/CCVPaymentHelpers');

    ccvLogger.info(`Processing refund for order ${order.orderNo}`);
    try {
        var refunds = JSON.parse(order.custom.ccvRefunds || '[]');

        if (!refunds || refunds.length === 0) {
            ccvLogger.warn(`No refunds found in order ${order.orderNo}.`);
            Transaction.wrap(() => {
                order.custom.ccvHasPendingRefunds = false; // eslint-disable-line no-param-reassign
                order.addNote('Refund error', 'Order was marked to have pending CCV refunds, but ccvRefunds was empty.');
            });
            return;
        }

        var refundReferences = refunds.map(refund => refund.reference);

        var transactionStatusResponse = checkCCVTransactions(refundReferences);

        // update existing references
        refunds.map(refund => {
            var refundUpdateObj = transactionStatusResponse.toArray().find(obj => obj.reference === refund.reference);
            if (refundUpdateObj) {
                refund.status = refundUpdateObj.status; // eslint-disable-line no-param-reassign
                if (refundUpdateObj.failureCode) {
                    refund.failureCode = refundUpdateObj.failureCode; // eslint-disable-line no-param-reassign
                }
            }
            return refund;
        });

        updateOrderRefunds(order, refunds);
    } catch (error) {
        ccvLogger.error(`Error updating CCV refund status for order ${order.orderNo}: \n ${error.message}\n${error.stack}`);
    }
}

module.exports = {
    getRefundAmountRemaining,
    updateOrderRefunds,
    getSCAFields,
    getKlarnaOrderLines,
    getKlarnaOrderLineModel,
    checkRefundStatus
};
