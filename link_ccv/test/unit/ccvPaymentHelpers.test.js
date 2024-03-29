/* eslint-disable no-unused-expressions */
const proxyquire = require('proxyquire').noCallThru().noPreserveCache();
const { expect } = require('chai');
const stubs = require('./helpers/mocks/stubs');

const {
    callCCVService,
    createCCVPayment,
    checkCCVTransaction,
    checkCCVTransactions,
    refundCCVPayment,
    getCCVPaymentMethods
} = proxyquire('../../cartridges/int_ccv/cartridge/scripts/services/CCVPaymentHelpers', {
    'dw/svc/LocalServiceRegistry': stubs.dw.LocalServiceRegistryMock,
    'dw/util/StringUtils': stubs.dw.StringUtilsMock,
    'dw/system/Transaction': stubs.dw.TransactionMock,
    'dw/value/Money': stubs.dw.Money,
    'dw/order/PaymentTransaction': stubs.dw.PaymentTransaction,
    '*/cartridge/scripts/helpers/CCVOrderHelpers': stubs.CCVOrderHelpers,
    'dw/web/URLUtils': stubs.dw.URLUtilsMock,
    'dw/system/Site': stubs.dw.SiteMock,
    'dw/web/URLAction': stubs.dw.URLActionMock,
    'dw/web/URLParameter': stubs.dw.URLParameterMock,
    'dw/system/Logger': stubs.dw.loggerMock
});
const Money = require('./helpers/mocks/dw/value/Money');
const HTTPService = require('./helpers/mocks/dw/svc/HTTPFormService');

describe('ccvPaymentHelpers', function () {
    let order;
    let amount;
    let description = 'some description';
    let lastParams;

    before(() => stubs.init());
    afterEach(() => {
        stubs.reset();
    });
    after(() => stubs.restore());

    beforeEach(() => {
        amount = null;
        lastParams = null;

        order = {
            paymentInstruments: [{
                paymentTransaction: { type: { value: 'AUTH' } }
            }],
            custom: { ccvTransactionReference: '12345' },
            addNote: () => null,
            currencyCode: 'EUR',
            totalGrossPrice: new Money(45, 'EUR')
        };

        stubs.dw.LocalServiceRegistryMock.createService.returns({ call(params) {
            lastParams = params;
            return {
                isOk: () => true,
                object: {
                    reference: 'R.123',
                    amount: params.requestBody.amount || order.totalGrossPrice.value,
                    status: 'pending',
                    currency: 'eur',
                    failureCode: null,
                    date: '1680776577052'
                }
            };
        } });
        stubs.dw.URLUtilsMock.abs.returns({ toString: () => 'some-url' });
    });
    context('#refundCCVPayment:', function () {
        it('should be a "reversal" if the transaction type is "AUTH"', () => {
            const result = refundCCVPayment({ order, amount, description });

            expect(result[0].type).to.eql('reversal');
            expect(lastParams.path).to.equal(stubs.CCVPaymentHelpersMock.CCV_CONSTANTS.PATH.REVERSAL);
        });
        it('should be a "refund" if the transaction type is "CAPTURE"', () => {
            order.paymentInstruments[0].paymentTransaction.type.value = 'CAPTURE';
            const result = refundCCVPayment({ order, amount, description });

            expect(result[0].type).to.eql('refund');
            expect(lastParams.path).to.equal(stubs.CCVPaymentHelpersMock.CCV_CONSTANTS.PATH.REFUND);
        });
        it('should not send an amount in the request if the transaction type is AUTH', () => {
            amount = 25;

            refundCCVPayment({ order, amount, description });

            expect(lastParams.requestBody.amount).to.be.undefined;
        });

        it('should add the refund to the order.custom.ccvRefunds', () => {
            refundCCVPayment({ order, amount, description });
            const parsedRefunds = JSON.parse(order.custom.ccvRefunds);

            expect(order.custom.ccvRefunds).to.be.a('string');
            expect(parsedRefunds).to.be.an('array');
            expect(parsedRefunds.length).to.eql(1);
            expect(parsedRefunds[0].amount).to.eql(order.totalGrossPrice.value);
        });

        it('should not overwrite existing order.custom.ccvRefunds', () => {
            order.paymentInstruments[0].paymentTransaction.type.value = 'CAPTURE';
            amount = 10;
            refundCCVPayment({ order, amount, description });
            amount = 20;
            refundCCVPayment({ order, amount, description });
            const parsedRefunds = JSON.parse(order.custom.ccvRefunds);

            expect(order.custom.ccvRefunds).to.be.a('string');
            expect(parsedRefunds).to.be.an('array');
            expect(parsedRefunds.length).to.eql(2);
            expect(parsedRefunds[0].amount).to.eql(10);
            expect(parsedRefunds[1].amount).to.eql(20);
        });

        it('should not change existing order.custom.ccvRefunds if the service throws', () => {
            order.paymentInstruments[0].paymentTransaction.type.value = 'CAPTURE';
            amount = 10;

            refundCCVPayment({ order, amount, description });

            const refunds1 = order.custom.ccvRefunds;
            expect(order.custom.ccvRefunds).to.be.a('string');

            stubs.dw.LocalServiceRegistryMock.createService.throws();

            refundCCVPayment({ order, amount, description });

            expect(order.custom.ccvRefunds).to.equal(refunds1);
        });
    });

    context('#createCCVPayment:', function () {
        it('should should be a POST request', () => {
            stubs.dw.LocalServiceRegistryMock.createService.returns({ call(params) {
                lastParams = params;
                return {
                    isOk: () => true,
                    object: { reference: 'R.123' }
                };
            } });
            createCCVPayment({});
            expect(lastParams.requestMethod).to.equal('POST');
        });
    });

    context('#getCCVPaymentMethods:', function () {
        it('should should be a GET request', () => {
            stubs.dw.LocalServiceRegistryMock.createService.returns({ call(params) {
                lastParams = params;
                return {
                    isOk: () => true,
                    object: []
                };
            } });
            getCCVPaymentMethods();
            expect(lastParams.requestMethod).to.equal('GET');
        });
    });

    context('#checkCCVTransaction:', function () {
        it('should be a GET request', () => {
            stubs.dw.LocalServiceRegistryMock.createService.returns({ call(params) {
                lastParams = params;
                return {
                    isOk: () => true,
                    object: { reference: 'R.123' }
                };
            } });
            checkCCVTransaction('test_ref');
            expect(lastParams.requestMethod).to.equal('GET');
        });
        it('should include the reference in the path', () => {
            const testRef = 'test_ref';
            stubs.dw.LocalServiceRegistryMock.createService.returns({ call(params) {
                lastParams = params;
                return {
                    isOk: () => true,
                    object: { reference: 'R.123' }
                };
            } });
            checkCCVTransaction(testRef);

            expect(lastParams.path).to.include(testRef);
        });

        it('should throw an error if no reference is passed', () => {
            expect(checkCCVTransaction).to.throw('Failed checking transaction: missing reference!');
        });
    });

    context('#checkCCVTransactions:', function () {
        it('should should be a GET request', () => {
            stubs.dw.LocalServiceRegistryMock.createService.returns({ call(params) {
                lastParams = params;
                return {
                    isOk: () => true,
                    object: { reference: 'R.123' }
                };
            } });
            checkCCVTransactions(['ref1', 'ref2']);
            expect(lastParams.requestMethod).to.equal('GET');
        });
        it('should include the references in the path', () => {
            const testRefs = ['test_ref1', 'test_ref2'];
            stubs.dw.LocalServiceRegistryMock.createService.returns({ call(params) {
                lastParams = params;
                return {
                    isOk: () => true,
                    object: { reference: 'R.123' }
                };
            } });
            checkCCVTransactions(testRefs);

            expect(lastParams.path).to.include(testRefs.join(','));
        });

        it('should throw an error if no references are passed', () => {
            let testRefs = null;

            expect(checkCCVTransactions.bind(this, testRefs)).to.throw('Failed checking transactions: missing references!');
            expect(checkCCVTransactions).to.throw('Failed checking transactions: missing references!');

            testRefs = [];
            expect(checkCCVTransactions.bind(this, testRefs)).to.throw('Failed checking transactions: missing references!');
        });
    });
});

describe('ccvPaymentHelpers', function () {
    let svc;

    before(() => stubs.init());
    afterEach(() => {
        stubs.reset();
    });
    after(() => stubs.restore());

    const createServiceFake = (svcName, config) => {
        svc = new HTTPService(config);
        stubs.sandbox.spy(svc);
        return svc;
    };

    beforeEach(() => {
        stubs.dw.LocalServiceRegistryMock.createService.callsFake(createServiceFake);
    });

    context('#callCCVService:', function () {
        it('should set method as POST', () => {
            callCCVService({
                path: stubs.CCV_CONSTANTS.PATH.CREATE_PAYMENT,
                requestMethod: 'POST',
                requestBody: { test: 'test' }
            });

            expect(svc.setRequestMethod).calledWith('POST');
        });

        it('should set method as GET', () => {
            callCCVService({
                path: stubs.CCV_CONSTANTS.PATH.CREATE_PAYMENT,
                requestMethod: 'GET',
                requestBody: { test: 'test' }
            });

            expect(svc.setRequestMethod).calledWith('GET');
        });

        it('should add the path to the url', () => {
            callCCVService({
                path: stubs.CCV_CONSTANTS.PATH.CREATE_PAYMENT,
                requestMethod: 'GET',
                requestBody: { test: 'test' }
            });

            expect(svc.setURL.args[0][0]).to.include(stubs.CCV_CONSTANTS.PATH.CREATE_PAYMENT);
        });

        it('should throw if the result is not "ok"', () => {
            const testErrorMsg = 'some error msg';
            const errorResultFake = () => {
                return {
                    call() {
                        return {
                            error: true,
                            errorMessage: testErrorMsg,
                            mockResult: false,
                            msg: 'msg',
                            object: {},
                            ok: false,
                            status: 'ERROR',
                            unavailableReason: 'reason',
                            isOk: () => false
                        };
                    }
                };
            };

            stubs.dw.LocalServiceRegistryMock.createService.callsFake(errorResultFake);

            const params = { path: 'test' };
            expect(callCCVService.bind(this, params)).to.throw(testErrorMsg);
        });
    });
});
