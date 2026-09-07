var ccvLogger = require('dw/system/Logger').getLogger('CCV', 'ccv');
var { CCV_CONSTANTS, checkCCVTransaction } = require('*/cartridge/scripts/services/CCVPaymentHelpers');
var authorizationHandlers = require('*/cartridge/scripts/authorizationHandlers');
/**
 * Reads the CCV transaction status for an order and works out what should happen to it.
 *
 * This function only reads - it performs the CCV service calls and returns what was found, but
 * makes no changes to the order. That keeps the service calls out of the order transaction, so
 * the order is not locked while we wait for CCV. The resulting changes are applied by
 * handleAuthorizationResult, which does have to run in a transactional context.
 *
 * @param {dw.order.Order} order order being processed
 * @param {string<webhook|job>} context context of execution
 * @returns {Object} authorization status object
 */
exports.authorizeCCV = function (order, context) {
    var ccvTransactionReference = order.custom.ccvTransactionReference;
    var transactionStatusResponse;
    var childTransactionStatusResponse;

    if (!ccvTransactionReference) {
        ccvLogger.warn(`No CCV transaction reference found for order ${order.orderNo}`);
        return { missingReference: true };
    }

    try {
        transactionStatusResponse = checkCCVTransaction(ccvTransactionReference);
    } catch (error) {
        return { error };
    }

    var status = transactionStatusResponse.status;

    /**
     * Cannot retrieve LP payment method
     * without requesting child transaction information
     */
    if (transactionStatusResponse.childReferenceId) {
        try {
            childTransactionStatusResponse = checkCCVTransaction(transactionStatusResponse.childReferenceId);
        } catch (error) {
            return { error };
        }
    }

    var isLandingPage = transactionStatusResponse.method === 'landingpage';
    var childPaymentMethodId = (isLandingPage && childTransactionStatusResponse && childTransactionStatusResponse.method) || '';

    /**
     * Format the payment method as in BM, to match payment method ID
     * Used for payment icons on the storefront
     */
    var childPaymentMethodFormatted = childPaymentMethodId ? ('CCV_' + childPaymentMethodId).toUpperCase() : '';

    var currencyMismatch = transactionStatusResponse.currency !== order.currencyCode.toLowerCase();
    var priceMismatch = transactionStatusResponse.amount !== order.totalGrossPrice.value;

    return {
        status: status,
        currencyMismatch,
        priceMismatch,
        ccvTransactionReference,
        transactionStatusResponse,
        context,
        // written to the order by handleAuthorizationResult, inside the transaction
        transactionDetails: {
            // childReferenceId is present only when paying with Landing page payments
            ccvChildTransactionReference: transactionStatusResponse.childReferenceId || '',
            ccv_card_type: transactionStatusResponse.brand || (childTransactionStatusResponse && childTransactionStatusResponse.brand) || '',
            ccv_landingpage_method: childPaymentMethodFormatted,
            ccv_transaction_status: status,
            ccv_failure_code: transactionStatusResponse.failureCode || null
        },
        isAuthorized: status === CCV_CONSTANTS.STATUS.SUCCESS && !currencyMismatch && !priceMismatch
    };
};

/**
 * Applies the outcome of authorizeCCV to the order.
 * Must be called in a transactional context.
 *
 * @param {Object} authResult authorization result object
 * @param {dw.order.Order} order order
 */
exports.handleAuthorizationResult = function (authResult, order) {
    var { status, currencyMismatch, priceMismatch, isAuthorized, error } = authResult;

    if (authResult.missingReference) {
        authorizationHandlers.failOrderWithHook({
            order,
            noteTitle: 'CCV payment failed',
            noteMsg: 'No ccvTransactionReference found in order.',
            authResult
        });
        return;
    }

    if (error) {
        throw new Error(`Error checking transaction status in order ${order.orderNo}: ${error}`);
    }

    authorizationHandlers.applyTransactionDetails(order, authResult);

    if (status === CCV_CONSTANTS.STATUS.FAILED) {
        authorizationHandlers.handleFailed(order, authResult);
        return;
    }

    if (status === CCV_CONSTANTS.STATUS.MANUAL_INTERVENTION) {
        authorizationHandlers.handleManualIntervention(order, authResult);
        return;
    }

    // paymentAmount or currency mismatch between SFCC and CCV
    if (status === CCV_CONSTANTS.STATUS.SUCCESS && (priceMismatch || currencyMismatch)) {
        authorizationHandlers.handlePriceOrCurrencyMismatch(order, authResult);
        return;
    }

    if (isAuthorized) {
        authorizationHandlers.handleSuccess(order, authResult);
        return;
    }
};
