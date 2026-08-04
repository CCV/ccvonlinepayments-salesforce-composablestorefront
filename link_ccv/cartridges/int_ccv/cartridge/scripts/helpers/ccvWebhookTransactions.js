'use strict';

/**
 * Queue of iDEAL fast checkout orders waiting for their consumer details.
 *
 * CCV never sends consumer data (email, name, phone) in the webhook body, and it is often not
 * on the transaction yet when we read it back during the webhook. Rather than making the shopper
 * wait, the order is placed straight away and queued here, and CCVPayment-ProcessWebhookTransactions
 * fills in the customer details once CCV has processed them.
 */

var CustomObjectMgr = require('dw/object/CustomObjectMgr');

var CO_TYPE = 'CCVWebhookTransactions';

// stop retrying after this many runs, so a record that can never be enriched does not keep
// calling CCV until the retention period removes it
var MAX_ATTEMPTS = 10;

/**
 * Queues an order for consumer-data enrichment.
 * Must be called in a transactional context.
 *
 * @param {dw.order.Order} order order to enrich
 */
function enqueue(order) {
    var enrichment = CustomObjectMgr.getCustomObject(CO_TYPE, order.orderNo)
        || CustomObjectMgr.createCustomObject(CO_TYPE, order.orderNo);

    enrichment.custom.transactionReference = order.custom.ccvTransactionReference;
}

/**
 * Returns the queued enrichment records, oldest first.
 *
 * @returns {dw.util.SeekableIterator} queued enrichment records
 */
function getPending() {
    return CustomObjectMgr.queryCustomObjects(CO_TYPE, '', 'creationDate asc');
}

/**
 * Removes an enrichment record.
 * Must be called in a transactional context.
 *
 * @param {dw.object.CustomObject} enrichment enrichment record
 */
function remove(enrichment) {
    CustomObjectMgr.remove(enrichment);
}

module.exports = {
    CO_TYPE,
    MAX_ATTEMPTS,
    enqueue,
    getPending,
    remove
};
