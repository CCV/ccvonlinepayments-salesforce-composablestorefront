'use strict';

var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
var StringUtils = require('dw/util/StringUtils');

var CCV_CONSTANTS = {
    PATH: {
        METHODS: '/method',
        CREATE_PAYMENT: '/payment',
        CHECK_TRANSACTION_STATUS: '/transaction'
    },
    STATUS: {
        PENDING: 'pending',
        SUCCESS: 'success',
        FAILED: 'failed',
        MANUAL_INTERVENTION: 'manualintervention'
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

    /** response
     * {
        "merchantOrderReference" : "123456",
        "amount" : 9.99,
        "returnUrl" : "http://shop/return?order=123456",
        "language" : "eng",
        "lastUpdate" : 1450871254946,
        "payUrl" : "https://redirect.jforce.be/card/payment.html?reference=C151223124734945CB87E191.0",
        "reference" : "C151223124734945CB87E191.0",
        "created" : 1450871254946,
        "currency" : "eur",
        "method" : "card",
        "type" : "sale",
        "description" : "Order 123456",
        "status" : "pending"
        }
     */
}

/**
 * Checks the status of a CCV transaction
 * @param {string} reference CCV transaction reference
 * @returns {Object} response from service call
 */
function checkCCVTransaction(reference) {
    return callCCVService({
        requestMethod: 'GET',
        path: `${CCV_CONSTANTS.PATH.CHECK_TRANSACTION_STATUS}?reference=${reference}`,
        mockResponse: {
            merchantOrderReference: '123456',
            amount: 33.17,
            brand: 'visa',
            returnUrl: 'http://shop/return?order=123456',
            language: 'eng',
            lastUpdate: 1450871414476,
            payUrl: 'https://redirect.jforce.be/card/payment.html?reference=C151223124734945CB87E191.0',
            reference: 'C151223124734945CB87E191.0',
            created: 1450871254959,
            currency: 'eur',
            method: 'card',
            type: 'sale',
            description: 'Order 123456',
            status: 'success'
        }
    });

    /**
 *     var exampleResponse = {
        "merchantOrderReference" : "123456",
        "amount" : 9.99,
        "brand" : "visa",
        "returnUrl" : "http://shop/return?order=123456",
        "language" : "eng",
        "lastUpdate" : 1450871414476,
        "payUrl" : "https://redirect.jforce.be/card/payment.html?reference=C151223124734945CB87E191.0",
        "reference" : "C151223124734945CB87E191.0",
        "created" : 1450871254959,
        "currency" : "eur",
        "method" : "card",
        "type" : "sale",
        "description" : "Order 123456",
        "status" : "success"
      }
 */
}

module.exports = {
    callCCVService,
    CCV_CONSTANTS,
    createCCVPayment,
    checkCCVTransaction
};
