var PaymentMgr = function () {};

PaymentMgr.getPaymentMethod = function () { return { getPaymentProcessor: () => 'CCV_DEFAULT' }; };
PaymentMgr.getApplicablePaymentMethods = function () {};
PaymentMgr.getPaymentCard = function () {};
PaymentMgr.getActivePaymentMethods = function () {};
PaymentMgr.prototype.paymentMethod = null;
PaymentMgr.prototype.applicablePaymentMethods = null;
PaymentMgr.prototype.paymentCard = null;
PaymentMgr.prototype.activePaymentMethods = null;

module.exports = PaymentMgr;
