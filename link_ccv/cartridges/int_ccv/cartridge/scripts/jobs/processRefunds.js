var Status = require('dw/system/Status');
var ccvLogger = require('dw/system/Logger').getLogger('CCV', 'ccv_refunds');
var OrderMgr = require('dw/order/OrderMgr');
var Transaction = require('dw/system/Transaction');
var { checkCCVTransactions } = require('*/cartridge/scripts/services/CCVPaymentHelpers');

exports.execute = function () {
    OrderMgr.processOrders(checkRefundStatus, 'custom.ccvHasPendingRefunds=true');

    return new Status(Status.OK);
};

/**
 * Updates the CCV refund status on orders with pending refunds
 * @param {dw.order.Order} order order
 */
function checkRefundStatus(order) {
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

        var { updateOrderRefunds } = require('*/cartridge/scripts/helpers/CCVOrderHelpers');
        updateOrderRefunds(order, refunds);
    } catch (error) {
        ccvLogger.error(`Error updating CCV refund status for order ${order.orderNo}: \n ${error.message}\n${error.stack}`);
    }
}

