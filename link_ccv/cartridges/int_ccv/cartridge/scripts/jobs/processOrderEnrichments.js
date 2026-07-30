'use strict';

var Status = require('dw/system/Status');
var Transaction = require('dw/system/Transaction');
var OrderMgr = require('dw/order/OrderMgr');
var ccvLogger = require('dw/system/Logger').getLogger('CCV', 'ccv');

var ccvOrderEnrichment = require('*/cartridge/scripts/helpers/ccvOrderEnrichment');
var { addAddressDetails } = require('*/cartridge/scripts/helpers/CCVOrderHelpers');
var { checkCCVTransaction } = require('*/cartridge/scripts/services/CCVPaymentHelpers');

/**
 * Adds the consumer details (email, name, phone) to iDEAL fast checkout orders that were placed
 * before CCV had processed them onto the transaction. See CCC-144 / CCC-161.
 *
 * @returns {dw.system.Status} job status
 */
exports.execute = function () {
    // read the queue into an array so the iterator is closed before we start writing to the records
    var pending = [];
    var queue = ccvOrderEnrichment.getPending();

    try {
        while (queue.hasNext()) {
            pending.push(queue.next());
        }
    } finally {
        queue.close();
    }

    pending.forEach(processEnrichment);

    return new Status(Status.OK);
};

/**
 * Applies the consumer details for a single queued order, or defers it to the next run.
 *
 * @param {dw.object.CustomObject} enrichment enrichment record
 */
function processEnrichment(enrichment) {
    var orderNo = enrichment.custom.orderNo;
    var order = OrderMgr.getOrder(orderNo);
    var transactionStatusResponse;

    try {
        // the service call is made outside of the transaction so the order is not locked while we wait
        transactionStatusResponse = order && checkCCVTransaction(enrichment.custom.transactionReference);
    } catch (error) {
        ccvLogger.error(`CCV: could not read transaction for order ${orderNo}: ${error}`);
    }

    Transaction.wrap(function () {
        if (transactionStatusResponse && addAddressDetails({ transactionStatusResponse, order })) {
            ccvOrderEnrichment.remove(enrichment);
            ccvLogger.info(`CCV: consumer data applied to order ${orderNo}.`);
            return;
        }

        var attempts = (enrichment.custom.attempts || 0) + 1;
        enrichment.custom.attempts = attempts; // eslint-disable-line no-param-reassign

        if (attempts >= ccvOrderEnrichment.MAX_ATTEMPTS) {
            ccvOrderEnrichment.remove(enrichment);
            ccvLogger.error(`CCV: giving up on the consumer data for order ${orderNo} after ${attempts} attempts.`);
        }
    });
}
