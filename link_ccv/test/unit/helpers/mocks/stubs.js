const sinon = require('sinon');
const sandbox = sinon.createSandbox();
const Order = require('./dw/order/Order');
const Basket = require('./dw/order/Basket');
const Profile = require('./dw/customer/Profile');
const CustomObjectMgr = require('./dw/object/CustomObjectMgr');
const CustomObject = require('./dw/object/CustomObject');
const OrderPaymentInstrument = require('./dw/order/OrderPaymentInstrument');
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
const Money = require('./dw/value/Money');
const StringUtils = require('./dw/util/StringUtils');
const LocalServiceRegistry = require('./dw/svc/LocalServiceRegistry');
const ArrayList = require('./dw/util/ArrayList');
const proxyquire = require('proxyquire').noCallThru().noPreserveCache();
const { CCV_CONSTANTS } = proxyquire('../../../../cartridges/int_ccv/cartridge/scripts/services/CCVPaymentHelpers', {
    'dw/svc/LocalServiceRegistry': {},
    'dw/util/StringUtils': {},
    'dw/system/Transaction': {},
    'dw/value/Money': Money
});
CCV_CONSTANTS.reset = () => {};

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

class OrderPaymentInstrumentMock extends OrderPaymentInstrument {
    constructor() {
        super();
        return sandbox.createStubInstance(OrderPaymentInstrument);
    }
}

class PaymentMethodMock extends PaymentMethod {
    constructor() {
        super();
        return sandbox.createStubInstance(PaymentMethod);
    }
}
class PaymentTransactionMock extends PaymentTransaction {
    constructor() {
        super();
        return sandbox.createStubInstance(PaymentTransaction);
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

class MoneyMock extends Money {
    constructor() {
        super();
        return sandbox.createStubInstance(Money);
    }
}

class StringUtilsMock extends StringUtils {
    constructor() {
        super();
        return sandbox.createStubInstance(StringUtils);
    }
}

class LocalServiceRegistryMock extends LocalServiceRegistry {
    constructor() {
        super();
        return sandbox.createStubInstance(LocalServiceRegistry);
    }
}

const CCVPaymentHelpersMock = {
    callCCVService: sandbox.stub(),
    CCV_CONSTANTS: CCV_CONSTANTS,
    createCCVPayment: sandbox.stub(),
    checkCCVTransaction: sandbox.stub(),
    checkCCVTransactions: sandbox.stub(),
    getCCVPaymentMethods: sandbox.stub(),
    refundCCVPayment: sandbox.stub(),
    getRefundAmountRemaining: sandbox.stub()
};

const ocapiServiceMock = {
    createOcapiService: sandbox.stub()
};

const customMock = sandbox.stub();
const Site = {
    getCurrent: () => ({
        getPreferences: () => ({
            getCustom: customMock
        }),
        getID: () => 'siteID',
        getCustomPreferenceValue: sandbox.stub()
    }),
    current: {
        getPreferences: () => ({
            getCustom: customMock
        }),
        getID: () => 'siteID',
        getCustomPreferenceValue: sandbox.stub()
    }
};

const CacheMgrMock = {
    getCache() {
        return {
            get(entryId, generatorFunc) {
                return generatorFunc();
            }
        };
    }
};

const collectionsMock = {
    map: (collection, callback) => collection.map(callback)
};

const dw = {
    ArrayList,
    Status: Status,
    OrderMock: OrderMock,
    CustomObjectMgrMock: sandbox.stub(CustomObjectMgr),
    CustomObjectMock: CustomObjectMock,
    BasketMock: BasketMock,
    ProfileMock: ProfileMock,
    OrderMgrMock: sandbox.stub(OrderMgr),
    URLUtilsMock: sandbox.stub(URLUtils),
    UUIDUtilsMock: sandbox.stub(UUIDUtils),
    OrderPaymentInstrumentMock,
    PaymentProcessorMock,
    PaymentTransactionMock,
    PaymentTransaction: PaymentTransaction,
    PaymentMethodMock,
    MoneyMock,
    basketMock: {
        getProductLineItems: sandbox.stub()
    },
    BasketMgrMock: {
        getCurrentBasket: sandbox.stub()
    },
    TransactionMock: {
        begin: sandbox.stub(),
        rollback: sandbox.stub(),
        commit: sandbox.stub(),
        wrap: sandbox.stub()
    },
    loggerMock: LoggerMock,
    LocalServiceRegistryMock,
    Calendar: sandbox.stub(),
    PaymentMgrMock: PaymentMgr,
    HookMgrMock: sandbox.stub(HookMgr),
    SiteMock: sandbox.stub(Site),
    StringUtilsMock,
    CacheMgrMock
};

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
    Object.keys(dw.OrderPaymentInstrumentMock).map(i => dw.OrderPaymentInstrumentMock[i].reset());
    Object.keys(dw.PaymentMethodMock).map(i => dw.PaymentMethodMock[i].reset());
    Object.keys(dw.PaymentProcessorMock).map(i => dw.PaymentProcessorMock[i].reset());
    Object.keys(dw.PaymentTransactionMock).map(i => dw.PaymentTransactionMock[i].reset());
    Object.keys(dw.HookMgrMock).map(i => dw.HookMgrMock[i].reset());
    Object.keys(dw.MoneyMock).map(i => dw.MoneyMock[i].reset());
    Object.keys(dw.StringUtilsMock).map(i => dw.StringUtilsMock[i].reset());
    Object.keys(dw.LocalServiceRegistryMock).map(i => dw.LocalServiceRegistryMock[i].reset());
    Object.keys(CCVPaymentHelpersMock).map(i => CCVPaymentHelpersMock[i].reset());
    Object.keys(ocapiServiceMock).map(i => ocapiServiceMock[i].reset());


    // INITIALIZE
    dw.TransactionMock.wrap.callsFake(function (cb) {
        cb();
    });
    dw.OrderMgrMock.failOrder.returns(dw.statusMock);
};

module.exports = {
    sandbox: sandbox,
    dw: dw,
    ocapiServiceMock: ocapiServiceMock,
    CCVPaymentHelpersMock: CCVPaymentHelpersMock,
    collectionsMock,
    reset: initMocks,
    init: () => {
        sandbox.restore();
        initMocks();
    },
    restore: function () { sandbox.restore(); }
};
