var Site = require('dw/system/Site');
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

module.exports = {
    getRefundAmountRemaining,
    updateOrderRefunds,
    getSCAFields
};
