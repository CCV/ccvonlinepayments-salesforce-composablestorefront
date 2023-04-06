var Status = require('dw/system/Status');
var ccvLogger = require('dw/system/Logger').getLogger('CCV', 'ccv_refunds');
var OrderMgr = require('dw/order/OrderMgr');
var Transaction = require('dw/system/Transaction');
var { CCV_CONSTANTS, checkCCVTransactions } = require('~/cartridge/scripts/services/CCVPaymentHelpers');

exports.execute = function () {
    OrderMgr.processOrders(checkRefundStatus, 'custom.ccvHasPendingRefunds=true');

    return new Status(Status.OK);
};

/**
 * Checks the CCV transaction status for each order and updates the order status if needed
 * @param {dw.order.Order} order order
 */
function checkRefundStatus(order) {
    ccvLogger.info(`Processing refund for order ${order.orderNo}`);
    try {
        var refunds = JSON.parse(order.custom.ccvRefunds || '[]');

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

        var hasPendingRefunds = refunds.some(refund => refund.status === CCV_CONSTANTS.STATUS.PENDING || refund.status === CCV_CONSTANTS.STATUS.MANUAL_INTERVENTION);

        Transaction.wrap(() => {
            order.custom.ccvRefunds = JSON.stringify(refunds); // eslint-disable-line no-param-reassign
            order.custom.ccvHasPendingRefunds = hasPendingRefunds; // eslint-disable-line no-param-reassign
        });
    } catch (error) {
        ccvLogger.error(`Error updating status for order ${order.orderNo}: \n ${error.message}\n${error.stack}`);
    }
}

