var _super = require('../object/ExtensibleObject');
var Money = require('../value/Money');
var PaymentTransaction = function () {};

PaymentTransaction.prototype = new _super();

PaymentTransaction.prototype.getType = function () {};
PaymentTransaction.prototype.getAmount = function () {};
PaymentTransaction.prototype.getPaymentInstrument = function () {};
PaymentTransaction.prototype.getTransactionID = function () {};
PaymentTransaction.prototype.setTransactionID = function () {};
PaymentTransaction.prototype.setPaymentProcessor = function () {};
PaymentTransaction.prototype.setAmount = function (amount) { this.amount = amount; };
PaymentTransaction.prototype.getPaymentProcessor = function () {};
PaymentTransaction.prototype.setType = function () {};
PaymentTransaction.prototype.type = null;
PaymentTransaction.prototype.amount = this.amount || new Money();
PaymentTransaction.prototype.paymentInstrument = null;
PaymentTransaction.prototype.transactionID = null;
PaymentTransaction.prototype.paymentProcessor = null;
PaymentTransaction.TYPE_AUTH = 'AUTH';
PaymentTransaction.TYPE_CAPTURE = 'CAPTURE';

module.exports = PaymentTransaction;
