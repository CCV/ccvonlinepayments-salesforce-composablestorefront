import {checkRequiredParameters, createOcapiFetch} from '../../../../commerce-api/utils'

class OcapiCCV {
    constructor(config) {
        this.fetch = createOcapiFetch(config)
    }

    async createRedirectSession(...args) {
        const required = ['returnUrl']
        let requiredParametersError = checkRequiredParameters(args[0], required)
        if (requiredParametersError) {
            return requiredParametersError
        }
        let {
            parameters: {returnUrl}
        } = args[0]

        return this.fetch(
            `custom_objects/CustomApi/create-ccv-payment?c_returnUrl=${returnUrl}`,
            'GET',
            args,
            'createPaymentSession'
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
