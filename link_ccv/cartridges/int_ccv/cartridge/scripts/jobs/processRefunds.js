var Status = require('dw/system/Status');
var OrderMgr = require('dw/order/OrderMgr');
var { checkRefundStatus } = require('*/cartridge/scripts/helpers/CCVOrderHelpers');

exports.execute = function () {
    OrderMgr.processOrders(checkRefundStatus, 'custom.ccvHasPendingRefunds=true');

    return new Status(Status.OK);
};
