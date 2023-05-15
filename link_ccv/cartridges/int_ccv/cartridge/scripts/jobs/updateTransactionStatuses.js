var Status = require('dw/system/Status');
var ccvLogger = require('dw/system/Logger').getLogger('CCV', 'ccv');
var OrderMgr = require('dw/order/OrderMgr');
var Order = require('dw/order/Order');
var { authorizeCCV, handleAuthorizationResult } = require('*/cartridge/scripts/authorizeCCV');
var Transaction = require('dw/system/Transaction');

exports.execute = function (args) {
    var oneDayInMs = 24 * 60 * 60 * 1000;
    var cutOffDate = new Date(Date.now() - (args.cutoffPeriodInDays * oneDayInMs));

    // only process orders older than 1 day
    OrderMgr.processOrders(checkOrderStatus, `status=${Order.ORDER_STATUS_CREATED} AND creationDate < {0}`, cutOffDate);

    return new Status(Status.OK);
};

/**
 * Checks the CCV transaction status for each order and updates the order status if needed
 * @param {dw.order.Order} order order
 */
function checkOrderStatus(order) {
    Transaction.wrap(function () {
        try {
            var authResult = authorizeCCV(order, null, 'job');
            handleAuthorizationResult(authResult, order);
        } catch (error) {
            ccvLogger.error(`Error updating status for order ${order.orderNo}: \n ${error.message}\n${error.stack}`);
        }
    });
}

