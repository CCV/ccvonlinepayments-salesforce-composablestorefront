const ccvVersion  = require('../package.json').version

const ccvConfig = {
    ccvVersion: `CCVOnlinePayments:${ccvVersion}`,
    applePayMerchantLabel: 'Merchant Name',
    applePaySupportedNetworks: ['MasterCard', 'Visa']
}

export default ccvConfig
