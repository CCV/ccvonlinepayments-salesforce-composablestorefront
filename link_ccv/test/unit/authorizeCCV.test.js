/* eslint-disable no-unused-expressions */
const proxyquire = require('proxyquire').noCallThru().noPreserveCache();
const { expect } = require('chai');

const stubs = require('./helpers/mocks/stubs');

const { authorizeCCV, handleAuthorizationResult } = proxyquire('../../cartridges/int_ccv/cartridge/scripts/authorizeCCV', {
    'dw/order/Order': stubs.dw.OrderMock,
    'dw/order/OrderMgr': stubs.dw.OrderMgrMock,
    'dw/system/Transaction': stubs.dw.TransactionMock,
    'dw/order/PaymentTransaction': stubs.dw.PaymentTransaction,
    'dw/system/Status': stubs.dw.Status,
    'dw/system/Logger': stubs.dw.loggerMock,
    'dw/order/PaymentMgr': stubs.dw.PaymentMgrMock,
    'dw/system/Site': stubs.dw.SiteMock,
    'dw/system/HookMgr': stubs.dw.HookMgrMock,
    '*/cartridge/scripts/services/CCVPaymentHelpers': stubs.CCVPaymentHelpersMock
});
const Status = require('./helpers/mocks/dw/system/Status');

describe('', function () {
    this.timeout(0); // todo: remove after done
    let order;
    let paymentInstrument;

    before(() => stubs.init());
    afterEach(() => stubs.reset());
    after(() => stubs.restore());

    beforeEach(() => {
        order = new stubs.dw.OrderMock();
        order.currencyCode = 'EUR';
        order.totalGrossPrice = { value: 50.00 };

        paymentInstrument = new stubs.dw.OrderPaymentInstrumentMock();
        order.custom.ccvTransactionReference = 'testTransactionRef';
        order.paymentInstruments = [paymentInstrument];
        paymentInstrument.paymentTransaction = new stubs.dw.PaymentTransactionMock();
        paymentInstrument.paymentTransaction.amount = new stubs.dw.MoneyMock();

        stubs.CCVPaymentHelpersMock.checkCCVTransaction.returns({
            amount: 50.00,
            currency: 'eur',
            method: 'card',
            type: 'sale',
            status: 'success'
        });
    });
    context('#authorizeCCV:', function () {
        it('should update the orderPaymentInstrument\'s paymenTransaction.transactionID', () => {
            authorizeCCV(order);
            expect(paymentInstrument.paymentTransaction.setTransactionID).to.have.been.calledOnceWith('testTransactionRef');
        });

        it('should update the orderPaymentInstrument\'s paymenTransaction.paymentProcessor', () => {
            authorizeCCV(order);
            expect(paymentInstrument.paymentTransaction.paymentProcessor).to.eql('CCV_DEFAULT');
        });
        it('should update the orderPaymentInstrument\'s paymenTransaction.type = AUTH for "authorise"', () => {
            stubs.CCVPaymentHelpersMock.checkCCVTransaction.returns({
                amount: 50.00,
                currency: 'eur',
                method: 'card',
                type: 'authorise',
                status: 'success'
            });

            authorizeCCV(order);
            expect(order.paymentInstruments[0].paymentTransaction.type).to.eql('AUTH');
        });
        it('should update the orderPaymentInstrument\'s paymenTransaction.type = CAPTURE for "sale"', () => {
            authorizeCCV(order);
            expect(order.paymentInstruments[0].paymentTransaction.type).to.eql('CAPTURE');
        });

        it('should return { error } if ccvTransactionReference is missing from the order.', () => {
            order.custom.ccvTransactionReference = null;
            const result = authorizeCCV(order);
            expect(typeof result.error).to.eql('string');
        });

        it('should return { error } if the checkCCVTransaction service fails.', () => {
            stubs.CCVPaymentHelpersMock.checkCCVTransaction.throws(new Error('timeout'));

            const result = authorizeCCV(order);
            expect(typeof result.error).to.exist;
            expect(typeof result.isAuthoirzed).to.eql('undefined');
        });

        it('should return { priceMismatch: true } if SFCC price is different than CCV price.', () => {
            stubs.CCVPaymentHelpersMock.checkCCVTransaction.returns({
                amount: 25.00,
                currency: 'eur',
                method: 'card',
                type: 'authorise',
                status: 'success'
            });
            const result = authorizeCCV(order);
            expect(result.priceMismatch).to.be.true;
            expect(result.isAuthorized).to.be.false;
        });
        it('should return { currencyMismatch: true } if SFCC currency is different than CCV currency.', () => {
            stubs.CCVPaymentHelpersMock.checkCCVTransaction.returns({
                amount: 50.00,
                currency: 'usd',
                method: 'card',
                type: 'authorise',
                status: 'success'
            });
            const result = authorizeCCV(order);
            expect(result.currencyMismatch).to.be.true;
            expect(result.isAuthorized).to.be.false;
        });
        it('should return { isAuthorized: true } if ccv status is succes and there is no price or currency mismatch.', () => {
            const result = authorizeCCV(order);
            expect(result.currencyMismatch).to.be.false;
            expect(result.priceMismatch).to.be.false;
            expect(result.error).to.be.undefined;
            expect(result.isAuthorized).to.be.true;
        });
        it('should set context if it\'s passed as param', () => {
            const result = authorizeCCV(order, null, 'job');
            expect(result.context).to.eql('job');
            expect(result.isAuthorized).to.be.true;
        });
    });

    context('#handleAuthorizationResult:', function () {
        it('should return status.ERROR and fail the order if ccvTransactionReference is missing from order', () => {
            order.custom.ccvTransactionReference = null;
            const result = authorizeCCV(order);
            const handleResult = handleAuthorizationResult(result, order);
            expect(handleResult).to.be.an.instanceof(Status);
            expect(handleResult.status).to.equal(1);
            expect(stubs.dw.OrderMgrMock.failOrder).to.have.been.calledOnceWith(order);
        });

        it('should return status.ERROR and fail the order if ccvStatus=failed', () => {
            stubs.CCVPaymentHelpersMock.checkCCVTransaction.returns({
                amount: 50.00,
                currency: 'eur',
                method: 'card',
                type: 'sale',
                status: 'failed'
            });
            const result = authorizeCCV(order);
            const handleResult = handleAuthorizationResult(result, order);
            expect(handleResult).to.be.an.instanceof(Status);
            expect(handleResult.status).to.equal(1);
            expect(stubs.dw.OrderMgrMock.failOrder).to.have.been.calledOnceWith(order);
        });

        it('should return status.ERROR if ccvStatus=manualintervention', () => {
            stubs.CCVPaymentHelpersMock.checkCCVTransaction.returns({
                amount: 50.00,
                currency: 'eur',
                method: 'card',
                type: 'sale',
                status: 'manualintervention'
            });
            const result = authorizeCCV(order);
            const handleResult = handleAuthorizationResult(result, order);
            expect(handleResult).to.be.an.instanceof(Status);
            expect(handleResult.status).to.equal(1);
            expect(order.custom.ccvManualIntervention).to.be.true;
            expect(stubs.dw.OrderMgrMock.failOrder).to.not.have.been.calledOnce;
        });

        it('should return status.ERROR if there is price mismatch', () => {
            stubs.CCVPaymentHelpersMock.checkCCVTransaction.returns({
                amount: 55.00,
                currency: 'eur',
                method: 'card',
                type: 'sale',
                status: 'success'
            });
            stubs.CCVPaymentHelpersMock.refundCCVPayment.returns([{}]);

            const result = authorizeCCV(order);
            const handleResult = handleAuthorizationResult(result, order);
            expect(handleResult).to.be.an.instanceof(Status);
            expect(handleResult.status).to.equal(1);
            expect(stubs.dw.OrderMgrMock.failOrder).to.have.been.calledOnce;
        });

        it('should return status.ERROR if there is currency mismatch', () => {
            stubs.CCVPaymentHelpersMock.checkCCVTransaction.returns({
                amount: 55.00,
                currency: 'usd',
                method: 'card',
                type: 'sale',
                status: 'success'
            });
            const result = authorizeCCV(order);
            const handleResult = handleAuthorizationResult(result, order);
            expect(handleResult).to.be.an.instanceof(Status);
            expect(handleResult.status).to.equal(1);
            expect(stubs.dw.OrderMgrMock.failOrder).to.have.been.calledOnce;
        });

        it('should still fail the order on price mismatch if the refund request throws an error', () => {
            stubs.CCVPaymentHelpersMock.checkCCVTransaction.returns({
                amount: 55.00,
                currency: 'usd',
                method: 'card',
                type: 'sale',
                status: 'success'
            });
            stubs.CCVPaymentHelpersMock.refundCCVPayment.throws(new Error('timeout'));
            const result = authorizeCCV(order);
            const handleResult = handleAuthorizationResult(result, order);
            expect(handleResult).to.be.an.instanceof(Status);
            expect(handleResult.status).to.equal(1);
            expect(stubs.dw.OrderMgrMock.failOrder).to.have.been.calledOnce;
        });

        it('should return status.OK if the payment is authorized', () => {
            const result = authorizeCCV(order);
            const handleResult = handleAuthorizationResult(result, order);
            expect(handleResult).to.be.an.instanceof(Status);
            expect(handleResult.status).to.equal(0);
            expect(stubs.dw.OrderMgrMock.failOrder).to.not.have.been.called;
        });

        it('should update the paymentTransaction.amount if the payment is authorized', () => {
            const result = authorizeCCV(order);
            handleAuthorizationResult(result, order);
            expect(paymentInstrument.paymentTransaction.setAmount).to.have.been.calledOnceWith({ value: result.transactionStatusResponse.amount });
        });

        it('should not fail the order if the status ccvStatus=pending', () => {
            stubs.CCVPaymentHelpersMock.checkCCVTransaction.returns({
                amount: 50.00,
                currency: 'usd',
                method: 'card',
                type: 'sale',
                status: 'pending'
            });
            const result = authorizeCCV(order);
            const handleResult = handleAuthorizationResult(result, order);
            expect(handleResult).to.be.an.instanceof(Status);
            expect(handleResult.status).to.equal(1);
            expect(stubs.dw.OrderMgrMock.failOrder).to.not.have.been.called;
        });

        it('should call ccv.order.update.afterOrderAuthorized hook with correct params after successful auth', () => {
            const result = authorizeCCV(order, null, 'job');
            const handleResult = handleAuthorizationResult(result, order);
            expect(handleResult).to.be.an.instanceof(Status);
            expect(handleResult.status).to.equal(0);
            expect(stubs.dw.OrderMgrMock.failOrder).to.not.have.been.called;
            expect(stubs.dw.HookMgrMock.callHook).to.have.been.calledOnceWith(
                'ccv.order.update.afterOrderAuthorized',
                'afterOrderAuthorized',
                { order, context: 'job' }
            );
        });

        it('should call ccv.order.update.afterOrderFailed hook with correct params after failed order', () => {
            stubs.CCVPaymentHelpersMock.checkCCVTransaction.returns({
                amount: 50.00,
                currency: 'usd',
                method: 'card',
                type: 'sale',
                status: 'failed'
            });
            const result = authorizeCCV(order, null, 'job');
            handleAuthorizationResult(result, order);
            expect(stubs.dw.HookMgrMock.callHook).to.have.been.calledOnceWith(
                'ccv.order.update.afterOrderFailed',
                'afterOrderFailed',
                { order, context: 'job' }
            );
        });
    });
});
