var Status = require('dw/system/Status');
var ccvLogger = require('dw/system/Logger').getLogger('CCV', 'ccv');
var OrderMgr = require('dw/order/OrderMgr');
var Order = require('dw/order/Order');
var { authorizeCCV, handleAuthorizationResult } = require('*/cartridge/scripts/authorizeCCV');
var Transaction = require('dw/system/Transaction');

var jobStatus = new Status(Status.OK);

exports.execute = function () {
    OrderMgr.processOrders(checkOrderStatus, `status=${Order.ORDER_STATUS_CREATED}`);

    return jobStatus;
};

/**
 * Checks the CCV transaction status for each order and updates the order status if needed
 * @param {dw.order.Order} order order
 */
function checkOrderStatus(order) {
    try {
        Transaction.wrap(function () {
            var authResult = authorizeCCV(order, null, 'job');
            var handlerResult = handleAuthorizationResult(authResult, order);

            if (handlerResult.status === Status.OK) {
                OrderMgr.placeOrder(order);
            }
        });
    } catch (error) {
        ccvLogger.error(`Error updating status for order ${order.orderNo}: \n ${error.message}\n${error.stack}`);
        jobStatus = new Status(Status.ERROR);
    }
}

