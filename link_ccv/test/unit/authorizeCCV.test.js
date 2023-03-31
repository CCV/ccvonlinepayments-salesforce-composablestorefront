/* eslint-disable new-cap */
const proxyquire = require('proxyquire').noCallThru().noPreserveCache();
const { expect } = require('chai');

const stubs = require('./helpers/mocks/stubs');

const { authorizeCCV } = proxyquire('../../cartridges/int_ccv/cartridge/scripts/authorizeCCV', {
    'dw/order/Order': stubs.dw.OrderMock,
    'dw/order/OrderMgr': stubs.dw.OrderMgrMock,
    'dw/system/Transaction': stubs.dw.TransactionMock,
    'dw/order/PaymentTransaction': stubs.dw.PaymentTransaction,
    'dw/system/Status': stubs.dw.Status,
    'dw/system/Logger': stubs.dw.loggerMock,
    'dw/order/PaymentMgr': stubs.dw.PaymentMgrMock,
    'dw/system/Site': stubs.dw.SiteMock,
    '~/cartridge/scripts/services/CCVPaymentHelpers': stubs.CCVPaymentHelpers
});

const Status = require('./helpers/mocks/dw/system/Status');
const OrderPaymentInstrument = require('./helpers/mocks/dw/order/OrderPaymentInstrument');

// var { CCV_CONSTANTS, checkCCVTransaction, refundCCVPayment } = require('~/cartridge/scripts/services/CCVPaymentHelpers');

describe('authorizeCCV', function () {
    this.timeout(0); // todo: remove after done

    var order;
    var paymentInstrument;

    before(() => {
        stubs.init();
    });
    afterEach(() => stubs.reset());
    after(() => stubs.restore());

    beforeEach(function () {
        order = new stubs.dw.OrderMock();
        order.currencyCode = 'EUR';
        order.totalGrossPrice = { value: 50.00 };

        order.custom.ccvTransactionReference = '12356789';
        paymentInstrument = new OrderPaymentInstrument();
        order.paymentInstruments = [paymentInstrument];
    });

    it('should return status.ERROR when transactionReference is missing', () => {
        order.custom.ccvTransactionReference = null;

        var result = authorizeCCV((order, paymentInstrument));
        expect(result).to.be.an.instanceof(Status);
        expect(result.status).to.equal(1);
    });

    it('should fail the order on status=failed', () => {
        order.custom.ccvTransactionReference = 'ccvRefFailed';

        var result = authorizeCCV(order, paymentInstrument);
        expect(result).to.be.an.instanceof(Status);
        expect(result.status).to.equal(1);
        expect(stubs.dw.OrderMgrMock.failOrder).to.have.been.calledOnceWith(order);
    });

    it('should fail the order if there is price mismatch', () => {
        order.custom.ccvTransactionReference = 'ccvRefSuccess';
        order.totalGrossPrice = { value: 49.00 };

        var result = authorizeCCV(order, paymentInstrument);
        expect(result).to.be.an.instanceof(Status);
        expect(result.status).to.equal(1);
        expect(stubs.dw.OrderMgrMock.failOrder).to.have.been.calledOnceWith(order);
        expect(order.custom.ccvPriceOrCurrencyMismatch).to.eql(true);
    });

    it('should fail the order if there is currency mismatch', () => {
        order.custom.ccvTransactionReference = 'ccvRefSuccess';
        order.currencyCode = 'USD';

        var result = authorizeCCV(order, paymentInstrument);
        expect(result).to.be.an.instanceof(Status);
        expect(result.status).to.equal(1);
        expect(stubs.dw.OrderMgrMock.failOrder).to.have.been.calledOnceWith(order);
        expect(order.custom.ccvPriceOrCurrencyMismatch).to.eql(true);
    });
});


// ===========================================================================================
// ===========================================================================================
// const proxyquire = require('proxyquire').noCallThru().noPreserveCache();
// const { stubs } = testHelpers;

// class StatusMock {
//     constructor(status, code, message) {
//         this.status = status;
//         this.code = code;
//         this.message = message;
//     }
// }
// StatusMock.OK = 0;
// StatusMock.ERROR = 1;

// const job = proxyquire('../../../../cartridges/bm_saferpay/cartridge/scripts/jobsteps/FailExpiredOrders', {
//     'dw/order/Order': stubs.dw.OrderMock,
//     'dw/order/OrderMgr': stubs.dw.OrderMgrMock,
//     'dw/system/Transaction': stubs.dw.TransactionMock,
//     'dw/system/Status': StatusMock,
//     'dw/util/Calendar': stubs.dw.Calendar,
//     '*/cartridge/scripts/payment/paymentService': stubs.paymentServiceMock,
//     '*/cartridge/scripts/order/orderHelper': stubs.orderHelperMock,
//     '*/cartridge/scripts/checkout/checkoutServicesService': stubs.checkoutServicesServiceMock,
//     '*/cartridge/scripts/utils/logger': stubs.loggerMock,
//     '*/cartridge/scripts/utils/date': stubs.dateMock,
//     '*/cartridge/scripts/services/saferpayTransactionService': stubs.saferpayTransactionServiceMock
// });

// global.empty = stubs.sandbox.stub();

// describe('bm_saferpay/jobsteps/FailExpiredOrders', () => {
//     before(() => stubs.init());
//     afterEach(() => stubs.reset());
//     after(() => stubs.restore());
//     beforeEach(() => global.empty.returns(false));

//     it('skips the job is IsDisabled flag is set', () => {
//         expect(job.Run({ IsDisabled: true })).to.have.property('status', StatusMock.OK);
//         expect(stubs.dw.OrderMgrMock.processOrders).not.to.have.been.called();
//     });

//     it('returns error status when no parameters are passed', () => {
//         global.empty.returns(true);
//         expect(job.Run()).to.have.property('status', StatusMock.ERROR);
//         expect(stubs.dw.OrderMgrMock.processOrders).not.to.have.been.called();
//     });

//     it('fails an order that has no saferpay transaction', () => {
//         stubs.dw.OrderMgrMock.processOrders.callsFake(cb => cb('order'));
//         stubs.dateMock.addHours.returns({ getTime: () => 'date-time' });
//         stubs.saferpayTransactionServiceMock.cancelTransaction.returns({ raw: '' });
//         stubs.paymentServiceMock.getPaymentTransaction.returns(null);

//         expect(job.Run({ IsDisabled: false, ExpireAfterHours: 24 })).to.have.property('status', StatusMock.OK);
//         expect(stubs.saferpayTransactionServiceMock.cancelTransaction).not.to.have.been.called();
//         expect(stubs.orderHelperMock.failOrder).to.have.been.calledOnce()
//             .and.to.have.been.calledWith('order');
//         expect(stubs.dw.OrderMgrMock.processOrders).to.have.been.calledWith(sinon.match.func, sinon.match.string, sinon.match.number, 'date-time');
//     });
//     it('fails an order whose transaction is neither captured nor authorized', () => {
//         const transactionId = faker.random.uuid();
//         stubs.dw.OrderMgrMock.processOrders.callsFake(cb => cb('order'));
//         stubs.dateMock.addHours.returns({ getTime: () => 'date-time' });
//         stubs.saferpayTransactionServiceMock.cancelTransaction.returns({ raw: '' });
//         stubs.paymentServiceMock.getPaymentTransaction.returns({ id: transactionId, isAuthorised: () => false, isCaptured: () => false });

//         expect(job.Run({ IsDisabled: false, ExpireAfterHours: 24 })).to.have.property('status', StatusMock.OK);
//         expect(stubs.saferpayTransactionServiceMock.cancelTransaction).to.have.been.calledOnce()
//             .and.to.have.been.calledWithExactly({ transactionId: transactionId });
//         expect(stubs.orderHelperMock.failOrder).to.have.been.calledOnce()
//             .and.to.have.been.calledWith('order');
//         expect(stubs.dw.OrderMgrMock.processOrders).to.have.been.calledWith(sinon.match.func, sinon.match.string, sinon.match.number, 'date-time');
//     });
//     it('fails an authorized transaction', () => {
//         const transactionId = faker.random.uuid();
//         stubs.dw.OrderMgrMock.processOrders.callsFake(cb => cb('order'));
//         stubs.dateMock.addHours.returns({ getTime: () => 'date-time' });
//         stubs.saferpayTransactionServiceMock.cancelTransaction.returns({ raw: '' });
//         stubs.paymentServiceMock.getPaymentTransaction.returns({ id: transactionId, isAuthorised: () => true });

//         expect(job.Run({ IsDisabled: false, ExpireAfterHours: 24 })).to.have.property('status', StatusMock.OK);
//         expect(stubs.saferpayTransactionServiceMock.cancelTransaction).to.have.been.calledOnce()
//             .and.to.have.been.calledWithExactly({ transactionId: transactionId });
//         expect(stubs.orderHelperMock.failOrder).to.have.been.calledOnce()
//             .and.to.have.been.calledWith('order');
//         expect(stubs.dw.OrderMgrMock.processOrders).to.have.been.calledWith(sinon.match.func, sinon.match.string, sinon.match.number, 'date-time');
//     });
//     it('completes order for a captured transaction', () => {
//         const transactionId = faker.random.uuid();
//         stubs.dw.OrderMgrMock.processOrders.callsFake(cb => cb('order'));
//         stubs.dateMock.addHours.returns({ getTime: () => 'date-time' });
//         stubs.saferpayTransactionServiceMock.cancelTransaction.returns({ raw: '' });
//         stubs.paymentServiceMock.getPaymentTransaction.returns({ id: transactionId, isAuthorised: () => false, isCaptured: () => true });

//         expect(job.Run({ IsDisabled: false, ExpireAfterHours: 24 })).to.have.property('status', StatusMock.OK);
//         expect(stubs.orderHelperMock.setPaymentStatus).to.have.been.calledOnce()
//             .and.to.have.been.calledWith('order', stubs.dw.OrderMock.PAYMENT_STATUS_PAID);
//         expect(stubs.checkoutServicesServiceMock.placeOrder).to.have.been.calledOnce()
//             .and.to.have.been.calledWith('order');
//         expect(stubs.checkoutServicesServiceMock.sendConfirmationEmail).to.have.been.calledOnce()
//             .and.to.have.been.calledWith('order');
//         expect(stubs.saferpayTransactionServiceMock.cancelTransaction).not.to.have.been.called();
//         expect(stubs.orderHelperMock.failOrder).not.to.have.been.called();
//         expect(stubs.dw.OrderMgrMock.processOrders).to.have.been.calledWith(sinon.match.func, sinon.match.string, sinon.match.number, 'date-time');
//     });
//     it('returns error status when something goes wrong', () => {
//         stubs.dw.OrderMgrMock.processOrders.throws(new Error('BOOM'));
//         expect(job.Run({ IsDisabled: false, ExpireAfterHours: 24 })).to.have.property('status', StatusMock.ERROR);
//     });
// });

