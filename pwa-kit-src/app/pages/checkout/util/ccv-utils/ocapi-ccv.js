import {checkRequiredParameters, createOcapiFetch} from '../../../../commerce-api/utils'
import {camelCaseKeysToUnderscore} from '../../../../commerce-api/utils'
class OcapiCCV {
    constructor(config) {
        this.fetch = createOcapiFetch(config)
    }

    // based on ocapper-shopper-orders#createOrder
    async createOrder(...args) {
        const required = ['body', 'ccvReturnUrl']
        let requiredParametersError = checkRequiredParameters(args[0], required)
        if (requiredParametersError) {
            return requiredParametersError
        }

        const {
            parameters: {ccvReturnUrl},
            body
        } = args[0]

        return await this.fetch(
            `orders?ccvReturnUrl=${ccvReturnUrl}`,
            'POST',
            args,
            'createOrder',
            camelCaseKeysToUnderscore(body)
        )
    }

    async checkTransactionStatus(...args) {
        const required = ['ref', 'token']
        let requiredParametersError = checkRequiredParameters(args[0], required)
        if (requiredParametersError) {
            return requiredParametersError
        }
        let {
            parameters: {ref, token}
        } = args[0]

        return this.fetch(
            `custom_objects/CustomApi/check-transaction-status?ref=${ref}&token=${token}`,
            'GET',
            args,
            'checkTransactionStatus'
        )
    }
}
export default OcapiCCV
