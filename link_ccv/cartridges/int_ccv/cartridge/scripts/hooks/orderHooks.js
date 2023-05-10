'use strict';
/* eslint-disable camelcase */ // custom properties can't be camelcase due to PWA implementation of ocapi calls

var Status = require('dw/system/Status');
var Site = require('dw/system/Site');
var PaymentMgr = require('dw/order/PaymentMgr');
var PaymentTransaction = require('dw/order/PaymentTransaction');

var languageMap = {
    nl: 'nld',
    en: 'eng',
    fr: 'fra',
    de: 'deu',
    dk: 'dan',
    es: 'spa'
};

/**
 * Hook fired after creating an order via OCAPI.
 * Here we create a payment request in CCV, and return the payUrl to the clientSide
 * @param {Object} order - the database object
 * @returns {undefined|dw.system.Status} return status.ERROR if the payment create request failed
 */
exports.afterPOST = function (order) { // eslint-disable-line consistent-return
    var { createCCVPayment, CCV_CONSTANTS } = require('*/cartridge/scripts/services/CCVPaymentHelpers');
    var { getSCAFields } = require('*/cartridge/scripts/helpers/CCVOrderHelpers');
    var returnUrl = request.httpParameters.ccvReturnUrl && request.httpParameters.ccvReturnUrl.pop();

    // ============= CREATE CCV PAYMENT REQUEST =============
    var requestLanguage = request.locale.split('_')[0];
    var orderDescription = order.allProductLineItems.toArray()
        .map(pli => pli.quantity + ' ' + pli.productName)
        .join(', ')
        .substring(0, 255);

    var { ccv_issuer_id } = order.paymentInstruments[0].custom;
    var paymentInstrument = order.paymentInstruments[0];

    var selectedMethodCCVId = paymentInstrument.custom.ccv_method_id;

    // DEFAULT
    var requestBody = {
        amount: order.totalGrossPrice.value,
        // amount: 8.01,
        currency: order.currencyCode.toLowerCase(),
        method: selectedMethodCCVId,
        returnUrl: `${returnUrl}?ref=${order.orderNo}&token=${order.orderToken}`,
        merchantOrderReference: order.orderNo,
        description: orderDescription,
        language: languageMap[requestLanguage],
        details: {}
    };

    if ((selectedMethodCCVId === 'ideal') && ccv_issuer_id) {
        requestBody.issuer = ccv_issuer_id;
    }

    if (selectedMethodCCVId === 'giropay' && ccv_issuer_id) {
        requestBody.details.bic = ccv_issuer_id;
    }

    // CREDIT CARD
    if (selectedMethodCCVId === 'card') {
        if (paymentInstrument.custom.ccvVaultAccessToken) {
            // vault payment
            requestBody.details = {
                vaultAccessToken: paymentInstrument.custom.ccvVaultAccessToken
            };
        } else if (paymentInstrument.creditCardNumber) {
            // new inline credit card payment
            // var [firstName, lastName] = paymentInstrument.creditCardHolder.split(' ');
            // requestBody.details = {
            //     pan: paymentInstrument.creditCardNumber,
            //     expiryDate: `${paymentInstrument.creditCardExpirationMonth}${paymentInstrument.creditCardExpirationYear}`.padStart(4, '0'),
            //     cardholderFirstName: firstName,
            //     cardholderLastName: lastName || firstName
            // };
        }

        if (paymentInstrument.custom.ccv_save_card
            && customer.registered
            && customer.authenticated
            && Site.current.getCustomPreferenceValue('ccvStoreCardsInVaultEnabled')) {
            // a vaultAccessToken will be returned in the checkTransactionInfo response
            // we will add it to the customer's payment instrument in the UpdateStatuses job
            requestBody.storeInVault = 'yes';
        }

        if (Site.current.getCustomPreferenceValue('ccvCardsAuthoriseEnabled')) {
            // if we don't specify a transactionType in the request, 'sale' wil be used by default
            requestBody.transactionType = CCV_CONSTANTS.TRANSACTION_TYPE.AUTHORISE;
        }

        // adding data required for 3DS frictionless flow
        var scaFields = getSCAFields(order);
        Object.assign(requestBody, scaFields);
    }

    // BANCONTACT
    if (paymentInstrument.paymentMethod === 'CCV_BANCONTACT') {
        requestBody.brand = 'bcmc';
    }

    var paymentResponse = {};

    try {
        paymentResponse = createCCVPayment({
            requestBody: requestBody
        });
    } catch (error) {
        var ccvLogger = require('dw/system/Logger').getLogger('CCV', 'ccv');
        paymentResponse.error = error;
        paymentInstrument.custom.ccv_failure_code = (paymentResponse.error && paymentResponse.error.message) || undefined;
        ccvLogger.error(`Failed creating a CCV payment request: ${error}`);

        return new Status(Status.ERROR);
    }

    // ============= set CCV properties =============
    order.custom.ccvTransactionReference = paymentResponse.reference; // eslint-disable-line no-param-reassign
    order.custom.ccvPayUrl = paymentResponse.payUrl; // eslint-disable-line no-param-reassign

    var paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod()).getPaymentProcessor();

    paymentInstrument.paymentTransaction.setTransactionID(paymentResponse.reference);
    paymentInstrument.paymentTransaction.setPaymentProcessor(paymentProcessor);
    paymentInstrument.paymentTransaction.setType(
        requestBody.transactionType === CCV_CONSTANTS.TRANSACTION_TYPE.AUTHORISE // eslint-disable-line no-param-reassign
        ? PaymentTransaction.TYPE_AUTH
        : PaymentTransaction.TYPE_CAPTURE
    );

    if (paymentInstrument.custom.ccvVaultAccessToken) {
        paymentInstrument.custom.ccvVaultAccessToken = '****';
    }
};
