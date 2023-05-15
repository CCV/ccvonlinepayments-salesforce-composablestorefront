/* eslint-disable no-unused-expressions */
const proxyquire = require('proxyquire').noCallThru().noPreserveCache();
const { expect } = require('chai');

const stubs = require('./helpers/mocks/stubs');

const { authorizeCCV, handleAuthorizationResult } = proxyquire('../../cartridges/int_ccv/cartridge/scripts/authorizeCCV', {
    'dw/order/Order': stubs.dw.OrderMock,
    'dw/order/OrderMgr': stubs.dw.OrderMgrMock,
    'dw/system/Transaction': stubs.dw.TransactionMock,
    'dw/system/Status': stubs.dw.Status,
    'dw/system/Logger': stubs.dw.loggerMock,
    'dw/system/Site': stubs.dw.SiteMock,
    'dw/system/HookMgr': stubs.dw.HookMgrMock,
    '*/cartridge/scripts/services/CCVPaymentHelpers': stubs.CCVPaymentHelpersMock
});

describe('authorizeCCV.js', function () {
    let order;
    let paymentInstrument;

    before(() => stubs.init());
    afterEach(() => stubs.reset());
    after(() => stubs.restore());

    beforeEach(() => {
        order = new stubs.dw.OrderMock();
        order.orderNo = '0001';
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

        stubs.dw.SiteMock.current.getCustomPreferenceValue
        .withArgs('ccvAutoRefundEnabled').returns(false);
    });
    context('#authorizeCCV:', function () {
        it('should return { missingReference } if ccvTransactionReference is missing from the order.', () => {
            order.custom.ccvTransactionReference = null;
            const result = authorizeCCV(order);
            expect(result.missingReference).to.be.true;
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
        it('should fail the order if ccvTransactionReference is missing from order', () => {
            order.custom.ccvTransactionReference = null;
            const result = authorizeCCV(order);
            handleAuthorizationResult(result, order);
            expect(stubs.dw.OrderMgrMock.failOrder).to.have.been.calledOnceWith(order);
        });

        it('should throw an error but not fail the order if there is an error with the authResult', () => {
            stubs.CCVPaymentHelpersMock.checkCCVTransaction.throws(new Error('Transaction not found!'));
            const result = authorizeCCV(order);
            expect(handleAuthorizationResult.bind(this, result, order)).to.throw('Error checking transaction status in order 0001: Error: Transaction not found!');

            expect(stubs.dw.OrderMgrMock.failOrder).not.to.have.been.called;
            expect(stubs.dw.OrderMgrMock.placeOrder).not.to.have.been.called;
        });

        it('should fail the order if ccvStatus=failed', () => {
            stubs.CCVPaymentHelpersMock.checkCCVTransaction.returns({
                amount: 50.00,
                currency: 'eur',
                method: 'card',
                type: 'sale',
                status: 'failed'
            });
            const result = authorizeCCV(order);
            handleAuthorizationResult(result, order);
            expect(stubs.dw.OrderMgrMock.failOrder).to.have.been.calledOnceWith(order);
        });

        it('should not fail the order if ccvStatus=manualintervention', () => {
            stubs.CCVPaymentHelpersMock.checkCCVTransaction.returns({
                amount: 50.00,
                currency: 'eur',
                method: 'card',
                type: 'sale',
                status: 'manualintervention'
            });
            const result = authorizeCCV(order);
            handleAuthorizationResult(result, order);
            expect(order.custom.ccvManualIntervention).to.be.true;
            expect(stubs.dw.OrderMgrMock.failOrder).to.not.have.been.called;
            expect(stubs.dw.OrderMgrMock.placeOrder).to.not.have.been.called;
        });

        it('should fail the order if there is price mismatch', () => {
            stubs.CCVPaymentHelpersMock.checkCCVTransaction.returns({
                amount: 55.00,
                currency: 'eur',
                method: 'card',
                type: 'sale',
                status: 'success'
            });
            stubs.CCVPaymentHelpersMock.refundCCVPayment.returns([{}]);

            const result = authorizeCCV(order);
            handleAuthorizationResult(result, order);
            expect(stubs.dw.OrderMgrMock.failOrder).to.have.been.calledOnce;
        });

        it('should fail the order if there is currency mismatch', () => {
            stubs.CCVPaymentHelpersMock.checkCCVTransaction.returns({
                amount: 55.00,
                currency: 'usd',
                method: 'card',
                type: 'sale',
                status: 'success'
            });
            const result = authorizeCCV(order);
            handleAuthorizationResult(result, order);
            expect(stubs.dw.OrderMgrMock.failOrder).to.have.been.calledOnce;
        });

        it('should create refund if autoRefund site pref is enabled', () => {
            stubs.CCVPaymentHelpersMock.checkCCVTransaction.returns({
                amount: 55.00,
                currency: 'usd',
                method: 'card',
                type: 'sale',
                status: 'success'
            });
            stubs.dw.SiteMock.current.getCustomPreferenceValue
            .withArgs('ccvAutoRefundEnabled').returns(true);

            stubs.CCVPaymentHelpersMock.refundCCVPayment.returns({});

            const result = authorizeCCV(order);
            handleAuthorizationResult(result, order);
            expect(stubs.CCVPaymentHelpersMock.refundCCVPayment).to.have.been.calledOnce;
        });

        it('should not create refund if autoRefund site pref is disabled', () => {
            stubs.CCVPaymentHelpersMock.checkCCVTransaction.returns({
                amount: 55.00,
                currency: 'usd',
                method: 'card',
                type: 'sale',
                status: 'success'
            });
            stubs.dw.SiteMock.current.getCustomPreferenceValue
            .withArgs('ccvAutoRefundEnabled').returns(false);

            const result = authorizeCCV(order);
            handleAuthorizationResult(result, order);
            expect(stubs.CCVPaymentHelpersMock.refundCCVPayment).to.not.have.been.called;
        });

        it('should still fail the order on price mismatch if the refund request throws an error', () => {
            stubs.dw.SiteMock.current.getCustomPreferenceValue
            .withArgs('ccvAutoRefundEnabled').returns(true);

            stubs.CCVPaymentHelpersMock.checkCCVTransaction.returns({
                amount: 55.00,
                currency: 'usd',
                method: 'card',
                type: 'sale',
                status: 'success'
            });
            stubs.CCVPaymentHelpersMock.refundCCVPayment.throws(new Error('timeout'));
            const result = authorizeCCV(order);
            handleAuthorizationResult(result, order);

            expect(stubs.CCVPaymentHelpersMock.refundCCVPayment).to.have.been.calledOnce;
            expect(stubs.dw.OrderMgrMock.failOrder).to.have.been.calledOnce;
        });

        it('should place the order if the payment is authorized', () => {
            const result = authorizeCCV(order);
            handleAuthorizationResult(result, order);
            expect(stubs.dw.OrderMgrMock.failOrder).to.not.have.been.called;
            expect(stubs.dw.OrderMgrMock.placeOrder).to.have.been.called;
        });

        it('should create a new customer payment instrument if ccvStoreCardsInVaultEnabled is enabled and there is vaultAccessToken in response', () => {
            const mockInstrument = {
                custom: {},
                setCreditCardNumber: stubs.sandbox.stub(),
                setCreditCardType: stubs.sandbox.stub(),
                setCreditCardExpirationMonth: stubs.sandbox.stub(),
                setCreditCardExpirationYear: stubs.sandbox.stub()
            };

            order.customer = { profile: { wallet: { createPaymentInstrument: () => mockInstrument } } };
            const details = {
                scaToken: true,
                maskedPan: '5555XXXXXXXX4444',
                acquirerResponseCode: '00',
                vaultAccessToken: '6C8F95B54BC251E1B92FDAA7',
                dataType: 'card',
                expirationTimestamp: 1686297131501,
                authorisedAmount: 31.49,
                acquirer: 'Valitor',
                cardholderLastName: 'Sparrow',
                authenticationProtocol: '3DS1',
                acquirerResponseCodeDescription: 'ApprovedOrCompletedSuccessfully',
                expiryDate: '0124',
                cardholderFirstName: 'Tester',
                initialTransactionId: 'xxbpj3AVzkCTT',
                expirationDuration: 'P0Y0M30DT0H0M0.000S',
                brand: 'mastercard',
                authenticationStatus: 'Y'
            };

            stubs.CCVPaymentHelpersMock.checkCCVTransaction.returns({
                amount: 50.00,
                currency: 'eur',
                method: 'card',
                type: 'sale',
                status: 'success',
                details
            });
            stubs.dw.SiteMock.current.getCustomPreferenceValue.withArgs('ccvStoreCardsInVaultEnabled').returns(true);

            const result = authorizeCCV(order);
            handleAuthorizationResult(result, order);
            expect(mockInstrument.setCreditCardNumber).to.have.been.calledOnceWith(details.maskedPan);
            expect(mockInstrument.setCreditCardType).to.have.been.calledOnceWith(details.brand);
            expect(mockInstrument.setCreditCardExpirationMonth).to.have.been.calledOnceWith(1);
            expect(mockInstrument.setCreditCardExpirationYear).to.have.been.calledOnceWith(2024);
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
            handleAuthorizationResult(result, order);
            expect(stubs.dw.OrderMgrMock.failOrder).to.not.have.been.called;
        });

        it('should call ccv.order.update.afterOrderAuthorized hook with correct context after successful auth', () => {
            const result = authorizeCCV(order, null, 'job');
            handleAuthorizationResult(result, order);
            expect(stubs.dw.OrderMgrMock.failOrder).to.not.have.been.called;
            expect(stubs.dw.HookMgrMock.callHook).to.have.been.calledOnceWith(
                'ccv.order.update.afterOrderAuthorized',
                'afterOrderAuthorized',
                { order, context: 'job' }
            );
        });

        it('should call ccv.order.update.afterOrderFailed hook with correct context after failed order', () => {
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
