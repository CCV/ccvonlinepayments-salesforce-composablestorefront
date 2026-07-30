/* eslint-disable no-unused-expressions */
const { expect } = require('chai');
const stubs = require('./helpers/mocks/stubs');

const {
    getRefundAmountRemaining,
    updateOrderRefunds,
    getAddressFields,
    getCCVOrderLines,
    addAddressDetails
} = stubs.CCVOrderHelpers;

const Money = require('./helpers/mocks/dw/value/Money');
const { CCV_CONSTANTS } = stubs.CCVPaymentHelpersMock;
const { SUCCESS, FAILED, PENDING, MANUAL_INTERVENTION } = CCV_CONSTANTS.STATUS;

const allLineItems = [Object.assign(new stubs.dw.ProductLineItem(), {
    lineItemText: 'Checked Silk Tie',
    productID: '682875540326M',
    quantity: {
        value: 2,
        unit: 'piece'
    },
    basePrice: new Money(21.59, 'EUR'),
    adjustedGrossPrice: new Money(37.49, 'EUR'),
    taxRate: 0.13,
    tax: new Money(5.61, 'EUR')
}),
    Object.assign(new stubs.dw.ProductLineItem(), {
        lineItemText: 'Light Hematite Button Clip-on Earrings',
        productID: '013742335484M',
        quantity: {
            value: 1,
            unit: 'piece'
        },
        basePrice: new Money(12.96, 'EUR'),
        adjustedGrossPrice: new Money(14.64, 'EUR'),
        taxRate: 0.13,
        tax: new Money(1.68, 'EUR')
    }),
    Object.assign(new stubs.dw.ShippingLineItem(), {
                    // ShippingLineItem
        lineItemText: 'STANDARD_SHIPPING',
        adjustedGrossPrice: new Money(6.77, 'EUR'),
        taxRate: 0.13,
        tax: new Money(3.74, 'EUR')
    }),
    Object.assign(new stubs.dw.ProductShippingLineItem(), {
                    // ProductShippingLineItem
        lineItemText: 'Item Shipping Cost (Surcharge)',
        adjustedGrossPrice: new Money(11.3, 'EUR'),
        taxRate: 0.13,
        tax: new Money(1.3, 'EUR')
    }),
    Object.assign(new stubs.dw.PriceAdjustment(), {
                    // PriceAdjustment
        lineItemText: '5 Off Ties Promotion',
        adjustedGrossPrice: new Money(-10.00, 'EUR'),
        grossPrice: new Money(-10.00, 'EUR'),
        priceValue: -10,
        quantity: 1
    })

];


describe('CCVOrderHelpers', function () {
    let order;

    before(() => stubs.init());
    afterEach(() => {
        stubs.reset();
    });
    after(() => stubs.restore());

    beforeEach(() => {
        order = {
            paymentInstruments: [{
                paymentTransaction: { type: { value: 'AUTH' } }
            }],
            custom: {
                ccvTransactionReference: '12345',
                ccvRefunds: `[
                    {"reference":"P230410143730929CB8A4868.9","amount":10,"status":"pending","currency":"eur","date":1681130250931,"type":"refund"},
                    {"reference":"P230410143740426CB8A4B97.9","amount":11,"status":"pending","currency":"eur","date":1681130260428,"type":"refund"},
                    {"reference":"P230410143846026CB8A5C6E.A","amount":8,"status":"pending","currency":"eur","date":1681130326030,"type":"refund"},
                    {"reference":"P230410143846026CB8A5C6E.D","amount":8,"status":"pending","currency":"eur","date":1681130326030,"type":"refund"}
                ]`,
                ccvHasPendingRefunds: true,
                ccvManualInterventionRefund: null
            },
            addNote: () => null,
            currencyCode: 'EUR',
            totalGrossPrice: new Money(45, 'EUR'),
            customerEmail: 'tester_email@test.com',

            billingAddress: {
                address1: 'Test Address 1',
                city: 'CityTest',
                stateCode: '',
                postalCode: '1245',
                countryCode: { value: 'BE' },
                address2: '',
                phone: '1234-1234-522',
                custom: { phone_country: '024' }
            },
            shipments: [{
                shippingAddress: {
                    address1: 'Shipping Test Address 1',
                    city: 'Shipping CityTest',
                    stateCode: '',
                    postalCode: '3333',
                    countryCode: { value: 'NL' },
                    address2: '',
                    phone: '1234-313131',
                    custom: { phone_country: '024' }
                }
            }]
        };

        stubs.dw.LocalServiceRegistryMock.createService.returns({ call(params) {
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
    });

    context('#getRefundAmountRemaining:', function () {
        it('should return the full order value if there are no prior refunds', () => {
            order.custom.ccvRefunds = null;
            const remainingRefund = getRefundAmountRemaining(order);
            expect(remainingRefund.value).to.equal(order.totalGrossPrice.value);
        });
        it('should return an instance of Money', () => {
            const remainingRefund = getRefundAmountRemaining(order);
            expect(remainingRefund).to.be.an.instanceof(Money);
        });
        it('should return the same currency as the order', () => {
            const remainingRefund = getRefundAmountRemaining(order);
            expect(remainingRefund.currencyCode).to.equal(order.currencyCode);
        });
        it('should return the correct amount if there are pending refunds', () => {
            order.custom.ccvRefunds = '[{ "amount": 10, "status": "pending" }]';
            const remainingRefund1 = getRefundAmountRemaining(order);
            expect(remainingRefund1.value).to.equal(order.totalGrossPrice.value - 10);

            order.custom.ccvRefunds = '[{ "amount": 10, "status": "pending"}, {"amount": 15.15, "status": "pending" }]';
            const remainingRefund2 = getRefundAmountRemaining(order);
            expect(remainingRefund2.value).to.equal(order.totalGrossPrice.value - 25.15);
        });
        it('should not add failed refunds to the calculation', () => {
            order.custom.ccvRefunds = '[{ "amount": 10, "status": "pending"}, {"amount": 15.15, "status": "failed" }]';
            const remainingRefund2 = getRefundAmountRemaining(order);
            expect(remainingRefund2.value).to.equal(order.totalGrossPrice.value - 10);
        });
    });

    context('#updateOrderRefunds:', function () {
        it('should update the order refunds', () => {
            const newRefunds = [
                { reference: 'P230410143730929CB8A4868.9', amount: 10, status: 'success', currency: 'eur', date: 1681130250931, type: 'refund' },
                { reference: 'P230410143740426CB8A4B97.9', amount: 11, status: 'failed', currency: 'eur', date: 1681130260428, type: 'refund' },
                { reference: 'P230410143846026CB8A5C6E.A', amount: 8, status: 'pending', currency: 'eur', date: 1681130326030, type: 'refund' },
                { reference: 'P230410143846026CB8A5C6E.D', amount: 8, status: 'manualintervention', currency: 'eur', date: 1681130326030, type: 'refund' }
            ];
            updateOrderRefunds(order, newRefunds);

            const parsedRefunds = JSON.parse(order.custom.ccvRefunds);

            expect(parsedRefunds[0].status).to.eql(SUCCESS);
            expect(parsedRefunds[1].status).to.eql(FAILED);
            expect(parsedRefunds[2].status).to.eql(PENDING);
            expect(parsedRefunds[3].status).to.eql(MANUAL_INTERVENTION);
        });

        it('should set ccvHasPendingRefunds to false if no refunds are still pending', () => {
            const newRefunds = [
                { reference: 'P230410143730929CB8A4868.9', amount: 10, status: 'success', currency: 'eur', date: 1681130250931, type: 'refund' },
                { reference: 'P230410143740426CB8A4B97.9', amount: 11, status: 'failed', currency: 'eur', date: 1681130260428, type: 'refund' },
                { reference: 'P230410143846026CB8A5C6E.A', amount: 8, status: 'success', currency: 'eur', date: 1681130326030, type: 'refund' },
                { reference: 'P230410143846026CB8A5C6E.D', amount: 8, status: 'manualintervention', currency: 'eur', date: 1681130326030, type: 'refund' }
            ];

            updateOrderRefunds(order, newRefunds);
            expect(order.custom.ccvHasPendingRefunds).to.be.false;
        });

        it('should set ccvHasPendingRefunds to true if some refunds are still pending', () => {
            const newRefunds = [
                { reference: 'P230410143730929CB8A4868.9', amount: 10, status: 'success', currency: 'eur', date: 1681130250931, type: 'refund' },
                { reference: 'P230410143740426CB8A4B97.9', amount: 11, status: 'pending', currency: 'eur', date: 1681130260428, type: 'refund' },
                { reference: 'P230410143846026CB8A5C6E.A', amount: 8, status: 'success', currency: 'eur', date: 1681130326030, type: 'refund' },
                { reference: 'P230410143846026CB8A5C6E.D', amount: 8, status: 'failed', currency: 'eur', date: 1681130326030, type: 'refund' }
            ];

            updateOrderRefunds(order, newRefunds);
            expect(order.custom.ccvHasPendingRefunds).to.be.true;
        });

        it('should work for a single refund', () => {
            order.custom.ccvRefunds = JSON.stringify(JSON.parse(order.custom.ccvRefunds)[0]);
            let newRefunds = [
                { reference: 'P230410143730929CB8A4868.9', amount: 10, status: 'pending', currency: 'eur', date: 1681130250931, type: 'refund' }
            ];

            updateOrderRefunds(order, newRefunds);
            expect(order.custom.ccvHasPendingRefunds).to.be.true;

            newRefunds = [
                { reference: 'P230410143730929CB8A4868.9', amount: 10, status: 'success', currency: 'eur', date: 1681130250931, type: 'refund' }
            ];

            updateOrderRefunds(order, newRefunds);
            expect(order.custom.ccvHasPendingRefunds).to.be.false;
        });

        it('should set manualintervention to true if some refund requires manual intervention', () => {
            const newRefunds = [
                { reference: 'P230410143730929CB8A4868.9', amount: 10, status: 'success', currency: 'eur', date: 1681130250931, type: 'refund' },
                { reference: 'P230410143740426CB8A4B97.9', amount: 11, status: 'success', currency: 'eur', date: 1681130260428, type: 'refund' },
                { reference: 'P230410143846026CB8A5C6E.A', amount: 8, status: 'success', currency: 'eur', date: 1681130326030, type: 'refund' },
                { reference: 'P230410143846026CB8A5C6E.D', amount: 8, status: 'manualintervention', currency: 'eur', date: 1681130326030, type: 'refund' }
            ];

            updateOrderRefunds(order, newRefunds);
            expect(order.custom.ccvHasPendingRefunds).to.be.false;
            expect(order.custom.ccvManualInterventionRefund).to.be.true;
        });
    });

    context('#getAddressFields:', function () {
        it('return all billing and shipping fields', () => {
            const fields = getAddressFields(order);

            const billingAddress = order.billingAddress;
            const shippingAddress = order.shipments[0].shippingAddress;
            expect(fields.billingAddress).to.eql(billingAddress.address1);
            expect(fields.billingCity).to.eql(billingAddress.city);
            expect(fields.billingState).to.eql(billingAddress.stateCode);
            expect(fields.billingPostalCode).to.eql(billingAddress.postalCode);
            expect(fields.billingCountry).to.eql(billingAddress.countryCode.value);
            expect(fields.billingHouseExtension).to.eql(billingAddress.address2 || '');
            expect(fields.billingPhoneNumber).to.eql(billingAddress.phone.replace(/\D/g, ''));
            expect(fields.billingPhoneCountry).to.eql(billingAddress.custom.phone_country);
            expect(fields.billingEmail).to.eql(order.customerEmail);
            expect(fields.shippingAddress).to.eql(shippingAddress.address1);
            expect(fields.shippingCity).to.eql(shippingAddress.city);
            expect(fields.shippingState).to.eql(shippingAddress.stateCode);
            expect(fields.shippingPostalCode).to.eql(shippingAddress.postalCode);
            expect(fields.shippingCountry).to.eql(shippingAddress.countryCode.value);
            expect(fields.shippingPhoneCountry).to.eql(shippingAddress.custom.phone_country);
            expect(fields.shippingPhoneNumber).to.eql(shippingAddress.phone.replace(/\D/g, ''));
            expect(fields.shippingHouseExtension).to.eql(shippingAddress.address2 || '');
            expect(fields.shippingEmail).to.eql(order.customerEmail);
        });

        it('should set phone_country to "00" if it is not provided in the order', () => {
            order.billingAddress.custom.phone_country = null;
            order.shipments[0].shippingAddress.custom.phone_country = null;
            const fields = getAddressFields(order);
            expect(fields.billingPhoneCountry).to.eql('00');
            expect(fields.shippingPhoneCountry).to.eql('00');
        });
    });

    context('#getCCVOrderLines:', function () {
        describe('should return correct CCV line types:', function () {
            beforeEach(() => {
                order.allLineItems = [...allLineItems];
            });
            it('should return a PHYSICAL product', () => {
                const item0 = order.allLineItems[0];

                const orderLines = getCCVOrderLines(order);
                expect(orderLines.length).to.eql(5);
                const orderLine0 = orderLines[0];
                expect(orderLine0.type).to.eql('PHYSICAL');
                expect(orderLine0.name).to.eql(item0.lineItemText);
                expect(orderLine0.code).to.eql(item0.productID);
                expect(orderLine0.quantity).to.eql(item0.quantity.value);
                expect(orderLine0.unit).to.eql(item0.quantity.unit);
                expect(orderLines[1].type).to.eql('PHYSICAL');
            });

            it('should return a SHIPPING_FEE', () => {
                const item2 = order.allLineItems[2];
                const item3 = order.allLineItems[3];

                const orderLines = getCCVOrderLines(order);
                expect(orderLines.length).to.eql(5);
                const line2 = orderLines[2];
                const line3 = orderLines[3];

                expect(line2.type).to.eql('SHIPPING_FEE');
                expect(line2.name).to.eql(item2.lineItemText);
                expect(line2.quantity).to.eql(1);
                expect(line2.vatRate).to.eql(item2.taxRate * 100);
                expect(line2.vat).to.eql(item2.tax.value);
                expect(line2.totalPrice).to.eql(item2.adjustedGrossPrice.value);
                expect(line2.unitPrice).to.eql(item2.adjustedGrossPrice.value);

                expect(line3.type).to.eql('SHIPPING_FEE');
                expect(line3.name).to.eql(item3.lineItemText);
                expect(line3.quantity).to.eql(1);
                expect(line3.vatRate).to.eql(item3.taxRate * 100);
                expect(line3.vat).to.eql(item3.tax.value);
                expect(line3.totalPrice).to.eql(item3.adjustedGrossPrice.value);
                expect(line3.unitPrice).to.eql(item3.adjustedGrossPrice.value);
            });

            // todo: logic for promotions has changed, need to rework this test
            it.skip('should return a DISCOUNT', () => {
                order.adjustedMerchandizeTotalGrossPrice = new Money(78.17, 'EUR');
                const orderLines = getCCVOrderLines(order);

                const line4 = orderLines[4];
                const item4 = order.allLineItems[4];

                expect(line4.type).to.eql('DISCOUNT');
                expect(line4.name).to.eql(item4.lineItemText);
                expect(line4.quantity).to.eql(item4.quantity);
                expect(line4.totalPrice).to.eql(item4.adjustedGrossPrice.value);
                expect(line4.unitPrice).to.eql(item4.adjustedGrossPrice.value);
            });
        });

        // todo: logic for promotions has changed, need to rework this test
        it.skip('should set SURCHARGE type on price adjustments with price > 0', () => {
            order.adjustedMerchandizeTotalGrossPrice = new Money(78.17, 'EUR');

            const item1 = Object.assign(new stubs.dw.PriceAdjustment(), {
                // PriceAdjustment
                lineItemText: '10 Ties Surcharge',
                adjustedGrossPrice: new Money(10.00, 'EUR'),
                grossPrice: new Money(10.00, 'EUR'),
                priceValue: 10,
                quantity: 1
            });
            order.allLineItems = [item1];

            const orderLines = getCCVOrderLines(order);

            expect(orderLines[0].type).to.eql('SURCHARGE');
        });

        it('should set unit as "pc" if quantity.unit is undefined', () => {
            order.adjustedMerchandizeTotalGrossPrice = new Money(78.17, 'EUR');

            const item1 = Object.assign(new stubs.dw.ProductLineItem(), {
                lineItemText: 'Checked Silk Tie',
                productID: '682875540326M',
                quantity: {
                    value: 2
                },
                basePrice: new Money(21.59, 'EUR'),
                adjustedGrossPrice: new Money(37.49, 'EUR'),
                taxRate: 0.13,
                tax: new Money(5.61, 'EUR')
            });
            order.allLineItems = [item1];

            const orderLines = getCCVOrderLines(order);

            expect(orderLines[0].unit).to.eql('pc');
        });
    });

    context('#addAddressDetails', function () {
        const PLACEHOLDER = 'iDEAL | Wero pending';
        let order;
        let billingAddress;
        let shippingAddress;

        beforeEach(() => {
            billingAddress = {
                address1: PLACEHOLDER,
                firstName: PLACEHOLDER,
                lastName: PLACEHOLDER,
                city: PLACEHOLDER,
                postalCode: PLACEHOLDER
            };
            shippingAddress = Object.assign({}, billingAddress);

            order = {
                billingAddress,
                defaultShipment: { shippingAddress },
                setCustomerEmail: stubs.sandbox.stub(),
                setCustomerName: stubs.sandbox.stub()
            };
        });

        it('should apply the consumer details and report the data as complete', () => {
            const complete = addAddressDetails({
                order,
                transactionStatusResponse: {
                    consumer: {
                        emailAddress: 'jack@sparrow.com',
                        firstName: 'Jack',
                        lastName: 'Sparrow',
                        phoneNumber: '0612345678'
                    },
                    billingAddress: 'Hoofdstraat',
                    billingHouseNumber: '12',
                    billingCity: 'Amsterdam'
                }
            });

            expect(complete).to.be.true;
            expect(order.setCustomerEmail).to.have.been.calledOnceWith('jack@sparrow.com');
            expect(order.setCustomerName).to.have.been.calledOnceWith('Jack Sparrow');
            expect(billingAddress.city).to.eql('Amsterdam');
            expect(billingAddress.phone).to.eql('0612345678');
            expect(billingAddress.address1).to.eql('Hoofdstraat 12');
        });

        it('should report the data as incomplete when the consumer container is missing', () => {
            const complete = addAddressDetails({
                order,
                transactionStatusResponse: { billingCity: 'Amsterdam' }
            });

            expect(complete).to.be.false;
            expect(billingAddress.city).to.eql('Amsterdam');
            expect(order.setCustomerEmail).to.have.been.calledOnceWith('');
        });

        it('should clear the placeholder rather than showing it on the placed order', () => {
            // CCV has not returned any address data yet - the placeholder must not survive
            addAddressDetails({
                order,
                transactionStatusResponse: { consumer: { emailAddress: 'jack@sparrow.com' } }
            });

            expect(billingAddress.city).to.eql('');
            expect(shippingAddress.postalCode).to.eql('');
        });

        it('should stay blank across repeated calls when there is still no data', () => {
            addAddressDetails({ order, transactionStatusResponse: {} });
            addAddressDetails({ order, transactionStatusResponse: { consumer: { emailAddress: 'jack@sparrow.com' } } });

            expect(billingAddress.city).to.eql('');
        });
    });
});
