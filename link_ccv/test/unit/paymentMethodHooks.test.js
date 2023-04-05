/* eslint-disable no-unused-expressions */
const proxyquire = require('proxyquire').noCallThru().noPreserveCache();
const { expect } = require('chai');

const stubs = require('./helpers/mocks/stubs');
const paymentMethodHooks = proxyquire('../../cartridges/int_ccv/cartridge/scripts/hooks/paymentMethodHooks', {
    'dw/system/Site': stubs.dw.SiteMock,
    'dw/system/CacheMgr': stubs.dw.CacheMgrMock,
    'dw/system/Status': stubs.dw.Status,
    '~/cartridge/scripts/services/CCVPaymentHelpers': stubs.CCVPaymentHelpersMock,
    '*/cartridge/scripts/util/collections': stubs.collectionsMock
});

describe('paymentMethodHooks', function () {
    this.timeout(0); // todo: remove after done

    const paymentMethodResultResponse = {
        applicablePaymentMethods: [{
            id: 'CCV_CREDIT_CARD',
            name: 'Credit Card',
            paymentProcessorId: 'CCV_DEFAULT',
            c_ccvMethodId: 'card'
        }, {
            description: 'PayPal via CCV',
            id: 'CCV_PAYPAL',
            name: 'PayPal',
            paymentProcessorId: 'CCV_DEFAULT',
            c_ccvMethodId: 'paypal'
        }, {
            id: 'CCV_IDEAL',
            name: 'iDEAL',
            paymentProcessorId: 'CCV_DEFAULT',
            c_ccvMethodId: 'ideal'
        }, {
            id: 'CCV_SOFORT',
            name: 'Sofort',
            c_ccvMethodId: 'sofort'
        }, {
            id: 'CCV_GIROPAY',
            name: 'Giropay',
            paymentProcessorId: 'CCV_DEFAULT',
            c_ccvMethodId: 'giropay'
        }, {
            description: 'Credit card hosted payment page',
            id: 'CCV_CREDIT_CARD_HPP',
            name: 'Credit card HPP',
            paymentProcessorId: 'CCV_DEFAULT',
            c_ccvMethodId: 'card'
        }, {
            id: 'CCV_BANCONTACT',
            name: 'Bancontact',
            paymentProcessorId: 'CCV_DEFAULT',
            c_ccvMethodId: 'card'
        }, {
            id: 'CCV_PAYCONIQ',
            name: 'Payconiq',
            paymentProcessorId: 'CCV_DEFAULT',
            c_ccvMethodId: 'payconiq'
        }, {
            id: 'CCV_EPS',
            name: 'EPS',
            paymentProcessorId: 'CCV_DEFAULT',
            c_ccvMethodId: 'eps'
        }, {
            id: 'NON_CCV_TEST_METHOD',
            name: 'test',
            paymentProcessorId: 'CCV_DEFAULT'
        }]
    };

    const ccvMethodsResponse = [{
        method: 'card',
        options: [{
            brand: 'visa'
        }, {
            brand: 'mastercard'
        }, {
            brand: 'maestro'
        }, {
            qr: 'true',
            brand: 'bcmc'
        }, {
            brand: 'amex'
        }]
    }, {
        method: 'ideal',
        options: [{
            issuerdescription: 'Issuer Simulation V3 - ING',
            issuerid: 'INGBNL2A',
            grouptype: 'country',
            group: 'Nederland'
        }, {
            issuerdescription: 'Issuer Simulation V3 - RABO',
            issuerid: 'RABONL2U',
            grouptype: 'country',
            group: 'Nederland'
        }]
    }, {
        method: 'paypal'
    }, {
        method: 'sofort'
    }, {
        method: 'landingpage'
    }, {
        method: 'giropay',
        options: [{
            issuerdescription: 'CCVPay GiroPay Simulator',
            issuerid: 'CCVXXX123456'
        }]
    }];

    stubs.CCVPaymentHelpersMock.getCCVPaymentMethods.returns({ toArray: () => ccvMethodsResponse });

    before(() => stubs.init());
    afterEach(() => stubs.reset());
    after(() => stubs.restore());

    context('modifyGETResponse_v2', function () {
        paymentMethodHooks.modifyGETResponse_v2(null, paymentMethodResultResponse);

        for (let method of paymentMethodResultResponse.applicablePaymentMethods) {
            const ccvMethodId = method.c_ccvMethodId;
            const ccvMethodData = ccvMethodsResponse.find(methodData => methodData.method === ccvMethodId);

            if (ccvMethodData && ccvMethodData.options) {
                it(`should add ccvOptions to the payment method (${ccvMethodId}) response`, () => {
                    expect(method.c_ccvOptions).to.equal(ccvMethodData.options);
                });
            } else if (ccvMethodData && !ccvMethodData.options) {
                it(`should not add ccvOptions to the payment method (${ccvMethodId}) response if there are no options`, () => {
                    expect(method.c_ccvOptions).to.be.undefined;
                });
            } else if (!ccvMethodId) {
                it('should not add ccvOptions for payment methods without c_ccvMethodId', () => {
                    expect(ccvMethodData.c_ccvOptions).to.be.undefined;
                });
            }
        }
    });
});
