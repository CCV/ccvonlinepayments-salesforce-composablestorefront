const sinon = require('sinon');
const sandbox = sinon.createSandbox();
const Order = require('./dw/order/Order');
const Basket = require('./dw/order/Basket');
const Profile = require('./dw/customer/Profile');
const CustomObjectMgr = require('./dw/object/CustomObjectMgr');
const CustomObject = require('./dw/object/CustomObject');
const PaymentInstrument = require('./dw/order/OrderPaymentInstrument');
const PaymentMethod = require('./dw/order/PaymentMethod');
const PaymentProcessor = require('./dw/order/PaymentProcessor');
const PaymentTransaction = require('./dw/order/PaymentTransaction');
const PaymentMgr = require('./dw/order/PaymentMgr');
const HookMgr = require('./dw/system/HookMgr');
const Logger = require('./dw/system/Logger');
const OrderMgr = require('./dw/order/OrderMgr');
const URLUtils = require('./dw/web/URLUtils');
const UUIDUtils = require('./dw/util/UUIDUtils');
const Status = require('./dw/system/Status');
const proxyquire = require('proxyquire').noCallThru().noPreserveCache();


class CustomObjectMock extends CustomObject {
    constructor() {
        super();
        return sandbox.createStubInstance(CustomObject);
    }
}
class OrderMock extends Order {
    constructor() {
        super();
        return sandbox.createStubInstance(Order);
    }
}

class BasketMock extends Basket {
    constructor() {
        super();
        return sandbox.createStubInstance(Basket);
    }
}

class ProfileMock extends Profile {
    constructor() {
        super();
        return sandbox.createStubInstance(Profile);
    }
}

class PaymentInstrumentMock extends PaymentInstrument {
    constructor() {
        super();
        return sandbox.createStubInstance(PaymentInstrument);
    }
}

class PaymentMethodMock extends PaymentMethod {
    constructor() {
        super();
        return sandbox.createStubInstance(PaymentMethod);
    }
}
class PaymentProcessorMock extends PaymentProcessor {
    constructor() {
        super();
        return sandbox.createStubInstance(PaymentProcessor);
    }
}

class LoggerMock extends Logger {
    constructor() {
        super();
        return sandbox.createStubInstance(Logger);
    }
}

const customMock = sandbox.stub();
const SiteMock = {
    getCurrent: () => ({
        getPreferences: () => ({
            getCustom: customMock
        }),
        getID: () => 'siteID',
        getCustomPreferenceValue: () => 'customPreference'
    })
};

const dw = {
    Status: Status,
    OrderMock: OrderMock,
    CustomObjectMgrMock: sandbox.stub(CustomObjectMgr),
    CustomObjectMock: CustomObjectMock,
    BasketMock: BasketMock,
    ProfileMock: ProfileMock,
    OrderMgrMock: sandbox.stub(OrderMgr),
    URLUtilsMock: sandbox.stub(URLUtils),
    UUIDUtilsMock: sandbox.stub(UUIDUtils),
    PaymentInstrumentMock: PaymentInstrumentMock,
    PaymentProcessorMock: PaymentProcessorMock,
    PaymentTransaction: PaymentTransaction,
    PaymentMethodMock: PaymentMethodMock,
    basketMock: {
        getProductLineItems: sandbox.stub()
    },
    basketMgrMock: {
        getCurrentBasket: sandbox.stub()
    },
    TransactionMock: {
        begin: sandbox.stub(),
        rollback: sandbox.stub(),
        commit: sandbox.stub(),
        wrap: sandbox.stub()
    },
    loggerMock: LoggerMock,
    localServiceRegistryMock: {
        createService: sandbox.stub()
    },
    Calendar: sandbox.stub(),
    PaymentMgrMock: PaymentMgr,
    HookMgrMock: sandbox.stub(HookMgr),
    Site: SiteMock
};
const CCVPaymentHelpers = proxyquire('../../../../cartridges/int_ccv/cartridge/scripts/services/CCVPaymentHelpers', {
    'dw/svc/LocalServiceRegistry': {
        createService() {
            let object = {};

            return {
                call(params) {
                    // console.log(params);
                    switch (params.path) {
                        case '/transaction?reference=ccvRefFailed':
                            object = {
                                amount: 33.17,
                                currency: 'eur',
                                method: 'card',
                                type: 'sale',
                                status: 'failed'
                            };
                            break;
                        case '/transaction?reference=ccvRefPending':
                            object = {
                                amount: 33.17,
                                currency: 'eur',
                                method: 'card',
                                type: 'sale',
                                status: 'pending'
                            };
                            break;
                        case '/transaction?reference=ccvRefSuccess':
                            object = {
                                amount: 50.00,
                                currency: 'eur',
                                method: 'card',
                                type: 'sale',
                                status: 'success'
                            };
                            break;
                        case '/transaction?reference=ccvRefManualIntervention':
                            object = {
                                amount: 50.00,
                                currency: 'eur',
                                method: 'card',
                                type: 'sale',
                                status: 'manualintervention'
                            };
                            break;
                        default:
                            break;
                    }

                    return ({ isOk: () => true, object });
                }
            };
        } },
    'dw/util/StringUtils': { encodeBase64() { return '123'; } }
});

const initMocks = function () {
    // RESETS
    sandbox.reset();
    Object.keys(dw.URLUtilsMock).map(i => dw.URLUtilsMock[i].reset());
    Object.keys(dw.loggerMock).map(i => dw.loggerMock[i].reset());
    Object.keys(dw.UUIDUtilsMock).map(i => dw.UUIDUtilsMock[i].reset());
    Object.keys(dw.OrderMgrMock).map(i => dw.OrderMgrMock[i].reset());
    Object.keys(dw.CustomObjectMgrMock).map(i => dw.CustomObjectMgrMock[i].reset());
    Object.keys(dw.CustomObjectMock).map(i => dw.CustomObjectMock[i].reset());
    Object.keys(dw.TransactionMock).map(i => dw.TransactionMock[i].reset());
    Object.keys(dw.PaymentInstrumentMock).map(i => dw.PaymentInstrumentMock[i].reset());
    Object.keys(dw.PaymentMethodMock).map(i => dw.PaymentMethodMock[i].reset());
    Object.keys(dw.PaymentProcessorMock).map(i => dw.PaymentProcessorMock[i].reset());
    // Object.keys(dw.PaymentTransactionMock).map(i => dw.PaymentTransactionMock[i].reset());
    Object.keys(dw.HookMgrMock).map(i => dw.HookMgrMock[i].reset());

    // INITIALIZE
    dw.TransactionMock.wrap.callsFake(function (cb) {
        cb();
    });
    dw.localServiceRegistryMock.createService.callsFake(function () {
        return {
            createRequest: sandbox.stub,
            parseResponse: sandbox.stub
        };
    });
    dw.OrderMgrMock.failOrder.returns(dw.statusMock);
};

module.exports = {
    sandbox: sandbox,
    dw: dw,
    CCVPaymentHelpers: CCVPaymentHelpers,
    reset: initMocks,
    init: () => {
        sandbox.restore();
        initMocks();
    },
    restore: function () { sandbox.restore(); }
};
