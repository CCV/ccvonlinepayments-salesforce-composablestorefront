'use strict';

var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
var StringUtils = require('dw/util/StringUtils');

var CCV_CONSTANTS = {
    PATH: {
        METHODS: '/method',
        CREATE_PAYMENT: '/payment',
        CHECK_TRANSACTION_STATUS: '/transaction',
        REFUND: '/refund',
        REVERSAL: '/reversal',
        CANCEL: '/cancel'
    },
    STATUS: {
        PENDING: 'pending',
        SUCCESS: 'success',
        FAILED: 'failed',
        MANUAL_INTERVENTION: 'manualintervention'
    },
    TRANSACTION_TYPE: {
        AUTHORISE: 'authorise',
        CAPTURE: 'sale'
    }
};

/**
 * Calls
 * @param {Object} svcParams Required fields for service call
 * @returns {Object} parsed response object
 */
function callCCVService(svcParams) {
    var service = LocalServiceRegistry.createService('CCVPayment', {
        createRequest(svc, params) {
            svc.addHeader('Content-Type', 'application/json');
            svc.addHeader('charset', 'utf-8');
            svc.setRequestMethod(params.requestMethod || 'POST');

            var url = svc.configuration.credential.URL + (params.path || '');
            var apiKey = svc.configuration.credential.password;
            var authHeader = 'Basic ' + StringUtils.encodeBase64(apiKey + ':');

            svc.addHeader('Authorization', authHeader);

            // svc.addHeader('Idempotency-Reference', params.idempotencyReference);
            svc.setURL(url);

            return params.requestBody ? JSON.stringify(params.requestBody) : '';
        },
        parseResponse(svc, response) { // eslint-disable-line no-unused-vars
            if (response && response.text) {
                return JSON.parse(response.text);
            }
            return null; // ?
        },
        mockCall() {
            var mockResponseObj = svcParams.mockResponse;
            return {
                statusCode: 200,
                statusMessage: 'Success',
                text: JSON.stringify(mockResponseObj)
            };
        },
        filterLogMessage: (message) => (message)
    });

    var result = service.call(svcParams);

    if (result.isOk()) {
        return result.object;
    }

    throw new Error(result.errorMessage);
}

/**
 * Creates a payment in CCV hosted-payment-page. The returned payUrl is where we have to
 * redirect the customer so they can complete their payment
 * @param {Object} params parameters passed in the http request
 * @returns {Object} service call response
 */
function createCCVPayment(params) {
    return callCCVService({
        path: CCV_CONSTANTS.PATH.CREATE_PAYMENT,
        requestMethod: 'POST',
        requestBody: params.requestBody
    });
}

/**
 * Checks the status of a CCV transaction
 * @param {string} reference CCV transaction reference
 * @returns {Object} response from service call
 */
function checkCCVTransaction(reference) {
    if (!reference) {
        throw new Error('Failed checking transaction: missing reference!');
    }
    return callCCVService({
        requestMethod: 'GET',
        path: `${CCV_CONSTANTS.PATH.CHECK_TRANSACTION_STATUS}?reference=${reference}`
    });
}

/**
 * Checks the status of multiple CCV transactions
 * @param {Array} references CCV transaction references
 * @returns {Object} response from service call
 */
function checkCCVTransactions(references) {
    if (!references || references.length === 0) {
        throw new Error('Failed checking transactions: missing references!');
    }
    return callCCVService({
        requestMethod: 'GET',
        path: `${CCV_CONSTANTS.PATH.CHECK_TRANSACTION_STATUS}?references=${references.join(',')}`
    });
}
/**
 * Returns CCV payment methods
 * @returns {Object} response from service call
 */
function getCCVPaymentMethods() {
    return callCCVService({
        requestMethod: 'GET',
        path: CCV_CONSTANTS.PATH.METHODS
    });
}

/**
 * Refunds an existing payment.
 * Refunds are allowed for all existing payment methods, except LandingPage, Terminal, Token and Vault.
 * @returns {Object} ccvRefunds object with data about existing refund requests
*/
function refundCCVPayment({ order, amount, description }) {
    var Transaction = require('dw/system/Transaction');
    var PaymentTransaction = require('dw/order/PaymentTransaction');

    var ccvRefunds = JSON.parse(order.custom.ccvRefunds || '[]');

    var requestBody = {
        reference: order.custom.ccvTransactionReference,
        description: description
    };

    var isReversal = order.paymentInstruments[0].paymentTransaction.type.value === PaymentTransaction.TYPE_AUTH;

    if (amount && !isReversal) {
        // for partial refunds
        requestBody.amount = amount;
    }
    var refundResponse;

    try {
        refundResponse = callCCVService({
            path: isReversal ? CCV_CONSTANTS.PATH.REVERSAL : CCV_CONSTANTS.PATH.REFUND,
            requestBody: requestBody
        });
    } catch (error) {
        // refund requests can fail if, for example, we exceed the refundable amount
        Transaction.wrap(()=> {
            order.addNote('CCV: refund request failed', error);
        });
        return null;
    }

    ccvRefunds.push({
        reference: refundResponse.reference,
        amount: refundResponse.amount,
        status: refundResponse.status,
        currency: refundResponse.currency,
        failureCode: refundResponse.failureCode,
        date: refundResponse.created,
        type: isReversal ? 'reversal' : 'refund'
    });

    var { updateOrderRefunds } = require('*/cartridge/scripts/helpers/CCVOrderHelpers');
    updateOrderRefunds(order, ccvRefunds);

    return ccvRefunds;
}

/**
 * Cancels a CCV payment if it is not yet authorized
 * @param {{dw.order.Order}} order order
 * @returns {object|null} service response
 */
function cancelCCVPayment({ order }) {
    var reference = order.custom.ccvTransactionReference;

    return callCCVService({
        path: `${CCV_CONSTANTS.PATH.CANCEL}?reference=${reference}`
    });
}

module.exports = {
    callCCVService,
    CCV_CONSTANTS,
    createCCVPayment,
    checkCCVTransaction,
    checkCCVTransactions,
    getCCVPaymentMethods,
    refundCCVPayment,
    cancelCCVPayment
};
